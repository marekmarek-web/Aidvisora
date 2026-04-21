import "server-only";
import { db } from "@/lib/db-client";
import { userTermsAcceptance } from "db";
import {
  LEGAL_DOCUMENT_VERSION,
  type LegalAcceptanceContext,
} from "@/app/legal/legal-meta";

/**
 * Legal acceptance ledger (delta A10). Použití:
 *
 *   import { recordTermsAcceptance } from "@/lib/legal/terms-acceptance";
 *   await recordTermsAcceptance({
 *     userId: session.userId,
 *     context: "register",
 *     documents: ["terms", "privacy"],
 *     request,
 *   });
 *
 * `request` (Next.js Request) je volitelné — pokud je přítomno, vytáhneme
 * IP (z `x-forwarded-for`), user-agent, accept-language a uložíme to jako
 * důkaz v době přijetí.
 *
 * Append-only: žádné update / delete (DB trigger).
 */

export type RecordTermsAcceptanceInput = {
  userId?: string | null;
  contactId?: string | null;
  tenantId?: string | null;
  context: LegalAcceptanceContext;
  documents: Array<"terms" | "privacy" | "dpa" | "ai-disclaimer" | "cookies" | "beta-terms">;
  version?: string;
  request?: Request | null;
  /**
   * Ruční override IP/UA pro testy nebo servisní kontexty (když není k dispozici
   * originální request).
   */
  ipAddress?: string | null;
  userAgent?: string | null;
  locale?: string | null;
};

function firstValueOf(header: string | null): string | null {
  if (!header) return null;
  const first = header.split(",")[0]?.trim();
  return first && first.length > 0 ? first : null;
}

function maskIp(raw: string | null): string | null {
  if (!raw) return null;
  // IPv4: 1.2.3.4 → 1.2.3.0 (poslední oktet nula — GDPR-friendly lift).
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(raw)) {
    return raw.replace(/\.\d{1,3}$/, ".0");
  }
  // IPv6: keep first 4 hextets, mask rest.
  if (raw.includes(":")) {
    const parts = raw.split(":");
    const kept = parts.slice(0, 4).join(":");
    return `${kept}::`;
  }
  return raw;
}

function readRequestMeta(request: Request | null | undefined): {
  ip: string | null;
  userAgent: string | null;
  locale: string | null;
} {
  if (!request) return { ip: null, userAgent: null, locale: null };
  const headers = request.headers;
  const xff = firstValueOf(headers.get("x-forwarded-for"));
  const cfIp = headers.get("cf-connecting-ip");
  const ip = cfIp || xff;
  return {
    ip: maskIp(ip ?? null),
    userAgent: (headers.get("user-agent") ?? "").slice(0, 300) || null,
    locale: (headers.get("accept-language") ?? "").split(",")[0]?.slice(0, 16) ?? null,
  };
}

export async function recordTermsAcceptance(input: RecordTermsAcceptanceInput): Promise<void> {
  if (!input.userId && !input.contactId) {
    throw new Error("recordTermsAcceptance: either userId or contactId must be provided");
  }
  const reqMeta = readRequestMeta(input.request);
  try {
    await db.insert(userTermsAcceptance).values({
      userId: input.userId ?? null,
      contactId: input.contactId ?? null,
      tenantId: input.tenantId ?? null,
      context: input.context,
      version: input.version ?? LEGAL_DOCUMENT_VERSION,
      documents: input.documents,
      userAgent: input.userAgent ?? reqMeta.userAgent,
      ipAddress: input.ipAddress ?? reqMeta.ip,
      locale: input.locale ?? reqMeta.locale,
    });
  } catch (err) {
    // Logování se nesmí zlomit o auth flow — ale je kritické pro GDPR DD.
    console.error("[terms-acceptance] insert failed", {
      context: input.context,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Rychlý lookup "akceptoval tento user aktuální verzi dokumentů?". Používá se
 * pro `re-prompt` (po nové verzi LEGAL_DOCUMENT_VERSION) — pokud `null`, musíme
 * ukázat consent modal znovu.
 */
export async function findLatestAcceptance(params: {
  userId?: string | null;
  contactId?: string | null;
  minVersion?: string;
}) {
  const rows = await db.query.userTermsAcceptance.findMany({
    where: (t, ops) => {
      const conds = [];
      if (params.userId) conds.push(ops.eq(t.userId, params.userId));
      if (params.contactId) conds.push(ops.eq(t.contactId, params.contactId));
      if (params.minVersion) conds.push(ops.gte(t.version, params.minVersion));
      return ops.and(...conds);
    },
    orderBy: (t, { desc }) => [desc(t.acceptedAt)],
    limit: 1,
  });
  return rows[0] ?? null;
}
