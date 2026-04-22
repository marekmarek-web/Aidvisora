"use server";

/**
 * Klientská strana: čtení a reakce na "Návrhy od poradce" v Klientské zóně.
 * Všechny funkce předpokládají roli `Client` + `contactId` v session.
 *
 * Poznámka ke compliance:
 * - Klient reaguje na ruční návrh poradce, ne na AI doporučení.
 * - "Chci probrat" vytvoří standardní požadavek v `/client/requests`
 *   (stejný kanál jako existující klientský flow), nejde o automatický úkon.
 */

import { revalidatePath } from "next/cache";
import { and, desc, eq } from "db";
import { db } from "db";
import {
  advisorProposals,
  type AdvisorProposalBenefit,
  type AdvisorProposalSegment,
  type AdvisorProposalStatus,
} from "db";
import { requireAuthInAction } from "@/lib/auth/require-auth";
import { withTenantContextFromAuth } from "@/lib/auth/with-auth-context";
import { createClientPortalRequest } from "./client-portal-requests";

export type ClientAdvisorProposal = {
  id: string;
  segment: AdvisorProposalSegment;
  title: string;
  summary: string | null;
  currentAnnualCost: number | null;
  proposedAnnualCost: number | null;
  savingsAnnual: number | null;
  currency: string;
  benefits: AdvisorProposalBenefit[] | null;
  validUntil: string | null;
  status: AdvisorProposalStatus;
  publishedAt: string | null;
  firstViewedAt: string | null;
  respondedAt: string | null;
  responseRequestId: string | null;
};

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function toIso(v: Date | string | null | undefined): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

/**
 * Klient vidí jen publikované / zobrazené / zodpovězené návrhy pro svůj kontakt.
 * Poradcovské drafty a withdrawn se klientovi nikdy nezobrazí.
 */
export async function listClientAdvisorProposals(): Promise<ClientAdvisorProposal[]> {
  const auth = await requireAuthInAction();
  if (auth.roleName !== "Client" || !auth.contactId) return [];

  // B2.1: RLS-consistent — nastaví PG GUCs přes withTenantContextFromAuth.
  const rows = await withTenantContextFromAuth(auth, (tx) =>
    tx
      .select({
        id: advisorProposals.id,
        segment: advisorProposals.segment,
        title: advisorProposals.title,
        summary: advisorProposals.summary,
        currentAnnualCost: advisorProposals.currentAnnualCost,
        proposedAnnualCost: advisorProposals.proposedAnnualCost,
        savingsAnnual: advisorProposals.savingsAnnual,
        currency: advisorProposals.currency,
        benefits: advisorProposals.benefits,
        validUntil: advisorProposals.validUntil,
        status: advisorProposals.status,
        publishedAt: advisorProposals.publishedAt,
        firstViewedAt: advisorProposals.firstViewedAt,
        respondedAt: advisorProposals.respondedAt,
        responseRequestId: advisorProposals.responseRequestId,
      })
      .from(advisorProposals)
      .where(
        and(
          eq(advisorProposals.tenantId, auth.tenantId),
          eq(advisorProposals.contactId, auth.contactId!)
        )
      )
      .orderBy(desc(advisorProposals.publishedAt), desc(advisorProposals.createdAt)),
  );

  return rows
    .filter((r) => ["published", "viewed", "accepted", "declined", "expired"].includes(r.status))
    .map((r) => ({
      id: r.id,
      segment: r.segment as AdvisorProposalSegment,
      title: r.title,
      summary: r.summary,
      currentAnnualCost: toNumber(r.currentAnnualCost),
      proposedAnnualCost: toNumber(r.proposedAnnualCost),
      savingsAnnual: toNumber(r.savingsAnnual),
      currency: r.currency,
      benefits: (r.benefits as AdvisorProposalBenefit[] | null) ?? null,
      validUntil: r.validUntil ?? null,
      status: r.status as AdvisorProposalStatus,
      publishedAt: toIso(r.publishedAt),
      firstViewedAt: toIso(r.firstViewedAt),
      respondedAt: toIso(r.respondedAt),
      responseRequestId: r.responseRequestId,
    }));
}

/** Počet aktivních (nepotvrzených) návrhů pro badge v sidebaru. */
export async function getActiveAdvisorProposalCountForClient(): Promise<number> {
  const auth = await requireAuthInAction();
  if (auth.roleName !== "Client" || !auth.contactId) return 0;
  const rows = await withTenantContextFromAuth(auth, (tx) =>
    tx
      .select({ status: advisorProposals.status })
      .from(advisorProposals)
      .where(
        and(
          eq(advisorProposals.tenantId, auth.tenantId),
          eq(advisorProposals.contactId, auth.contactId!)
        )
      ),
  );
  return rows.filter((r) => r.status === "published" || r.status === "viewed").length;
}

/** Označ návrh jako zobrazený (první otevření detailu). */
export async function markAdvisorProposalViewed(
  proposalId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const auth = await requireAuthInAction();
  if (auth.roleName !== "Client" || !auth.contactId) {
    return { success: false, error: "Forbidden" };
  }
  const [row] = await withTenantContextFromAuth(auth, (tx) =>
    tx
      .select({ id: advisorProposals.id, status: advisorProposals.status })
      .from(advisorProposals)
      .where(
        and(
          eq(advisorProposals.tenantId, auth.tenantId),
          eq(advisorProposals.contactId, auth.contactId!),
          eq(advisorProposals.id, proposalId)
        )
      )
      .limit(1),
  );
  if (!row) return { success: false, error: "Návrh nebyl nalezen." };
  if (row.status !== "published") return { success: true };
  await withTenantContextFromAuth(auth, (tx) =>
    tx
      .update(advisorProposals)
      .set({ status: "viewed", firstViewedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(advisorProposals.tenantId, auth.tenantId),
          eq(advisorProposals.id, proposalId)
        )
      ),
  );
  try {
    revalidatePath("/client/navrhy");
    revalidatePath("/client");
  } catch {
    /* ignore */
  }
  return { success: true };
}

function segmentToCaseType(segment: AdvisorProposalSegment): {
  caseType: string;
  caseTypeLabel: string;
} {
  switch (segment) {
    case "insurance_auto":
    case "insurance_property":
    case "insurance_life":
      return { caseType: "pojištění", caseTypeLabel: "Pojištění" };
    case "mortgage":
      return { caseType: "hypotéka", caseTypeLabel: "Hypotéka" };
    case "credit":
      return { caseType: "úvěr", caseTypeLabel: "Úvěr" };
    case "investment":
      return { caseType: "investice", caseTypeLabel: "Investice" };
    case "pension":
      return { caseType: "investice", caseTypeLabel: "Investice" };
    case "other":
    default:
      return { caseType: "jiné", caseTypeLabel: "Jiné" };
  }
}

function formatKc(n: number | null, currency: string): string {
  if (n === null) return "—";
  const rounded = Math.round(n).toLocaleString("cs-CZ");
  return `${rounded} ${currency}`;
}

/**
 * Klient reaguje "Chci to probrat":
 *  1) Vytvoří `client_portal_request` (opportunity) se strukturovaným popisem.
 *  2) Návrh přepne na `accepted`, uloží `responded_at` a `response_request_id`.
 *  3) Notifikace poradci zajišťuje existující `createClientPortalRequest`.
 */
export async function respondInterestedToAdvisorProposal(
  proposalId: string,
  note?: string | null
): Promise<
  | { success: true; requestId: string }
  | { success: false; error: string }
> {
  const auth = await requireAuthInAction();
  if (auth.roleName !== "Client" || !auth.contactId) {
    return { success: false, error: "Forbidden" };
  }

  const [row] = await withTenantContextFromAuth(auth, (tx) =>
    tx
      .select()
      .from(advisorProposals)
      .where(
        and(
          eq(advisorProposals.tenantId, auth.tenantId),
          eq(advisorProposals.contactId, auth.contactId!),
          eq(advisorProposals.id, proposalId)
        )
      )
      .limit(1),
  );
  if (!row) return { success: false, error: "Návrh nebyl nalezen." };
  if (!["published", "viewed", "declined"].includes(row.status)) {
    return { success: false, error: "K tomuto návrhu už není možné zareagovat." };
  }

  const { caseType, caseTypeLabel } = segmentToCaseType(row.segment as AdvisorProposalSegment);
  const subject = `Reakce na návrh: ${row.title}`;
  const currentN = toNumber(row.currentAnnualCost);
  const proposedN = toNumber(row.proposedAnnualCost);
  const savingsN = toNumber(row.savingsAnnual);
  const descLines = [
    `Dobrý den, mám zájem probrat návrh „${row.title}“ (${caseTypeLabel}).`,
    "",
    row.summary ? `Shrnutí návrhu: ${row.summary}` : null,
    currentN !== null ? `Aktuální roční náklad: ${formatKc(currentN, row.currency)}` : null,
    proposedN !== null ? `Navržený roční náklad: ${formatKc(proposedN, row.currency)}` : null,
    savingsN !== null && savingsN > 0 ? `Možná úspora: ${formatKc(savingsN, row.currency)} / rok` : null,
    row.validUntil ? `Platnost návrhu do: ${row.validUntil}` : null,
    note?.trim() ? "" : null,
    note?.trim() ? `Poznámka ode mě: ${note.trim()}` : null,
  ].filter((x): x is string => x !== null);

  const created = await createClientPortalRequest({
    caseType,
    subject,
    description: descLines.join("\n"),
  });
  if (!created.success) return created;

  const now = new Date();
  await withTenantContextFromAuth(auth, (tx) =>
    tx
      .update(advisorProposals)
      .set({
        status: "accepted",
        responseRequestId: created.id,
        respondedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(advisorProposals.tenantId, auth.tenantId),
          eq(advisorProposals.id, proposalId)
        )
      ),
  );

  try {
    revalidatePath("/client/navrhy");
    revalidatePath("/client");
    revalidatePath("/client/requests");
  } catch {
    /* ignore */
  }

  return { success: true, requestId: created.id };
}

/** Klient odmítne — návrh zůstává v archivu, ale už se nepočítá do badge. */
export async function declineAdvisorProposal(
  proposalId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const auth = await requireAuthInAction();
  if (auth.roleName !== "Client" || !auth.contactId) {
    return { success: false, error: "Forbidden" };
  }
  const [row] = await withTenantContextFromAuth(auth, (tx) =>
    tx
      .select({ status: advisorProposals.status })
      .from(advisorProposals)
      .where(
        and(
          eq(advisorProposals.tenantId, auth.tenantId),
          eq(advisorProposals.contactId, auth.contactId!),
          eq(advisorProposals.id, proposalId)
        )
      )
      .limit(1),
  );
  if (!row) return { success: false, error: "Návrh nebyl nalezen." };
  if (!["published", "viewed"].includes(row.status)) {
    return { success: false, error: "Tento návrh už má stav, který nelze odmítnout." };
  }

  const now = new Date();
  await withTenantContextFromAuth(auth, (tx) =>
    tx
      .update(advisorProposals)
      .set({ status: "declined", respondedAt: now, updatedAt: now })
      .where(
        and(
          eq(advisorProposals.tenantId, auth.tenantId),
          eq(advisorProposals.id, proposalId)
        )
      ),
  );

  try {
    revalidatePath("/client/navrhy");
    revalidatePath("/client");
  } catch {
    /* ignore */
  }
  return { success: true };
}
