"use server";

import { withAuthContext } from "@/lib/auth/with-auth-context";
import { hasPermission } from "@/lib/auth/permissions";
import { emailTemplates, contacts, contracts, eq, and, sql } from "db";

/**
 * F5 — vygeneruje draft "Náš společný rok" pro daný rok a vrátí HTML / subject
 * s vyplněnými čísly za celý segment (nebo pro konkrétní kontakt).
 *
 * Tato akce nic neposílá — pouze vrátí připravený body / subject, který frontend
 * použije pro vytvoření `email_campaigns` draftu (a uživatel může upravit).
 *
 * B3.1 — agreguje i úspory z accepted `advisor_proposals.savings_annual`,
 * úspory z income-protection analýz (`financial_analyses.payload` walk),
 * počet schůzek z `events`, a interní BJ snapshot (poradci, ne do klientského HTML).
 */

export type YearInReviewDraft = {
  subject: string;
  preheader: string;
  bodyHtml: string;
  stats: {
    contactsCount: number;
    contractsCount: number;
    meetingsCount: number;
    /** Suma ročního pojistného (premium_annual) u smluv uzavřených v roce. */
    totalPremiumCzk: number;
    /** Suma `savings_annual` u accepted návrhů v daném roce. */
    totalProposalSavingsCzk: number;
    /** Odhadované úspory z protection review (jsonb walk nad analýzami). */
    protectionSavingsCzk: number;
    productList: string[];
    /** Interní — BJ body pro poradce; do klientského HTML se neinjektuje. */
    bjUnitsInternal: number;
  };
};

export async function generateYearInReviewDraft(input: {
  year?: number;
  contactId?: string | null;
}): Promise<YearInReviewDraft> {
  const year = input.year ?? new Date().getFullYear();

  return withAuthContext(async (auth, tx) => {
    if (!hasPermission(auth.roleName, "contacts:read")) {
      throw new Error("Nemáte oprávnění.");
    }

    const [template] = await tx
      .select({
        subject: emailTemplates.subject,
        preheader: emailTemplates.preheader,
        bodyHtml: emailTemplates.bodyHtml,
      })
      .from(emailTemplates)
      .where(
        and(eq(emailTemplates.kind, "year_in_review"), eq(emailTemplates.isArchived, false)),
      )
      .limit(1);
    if (!template) {
      throw new Error("Šablona 'year_in_review' nebyla nalezena.");
    }

    const yearStart = `${year}-01-01`;
    const yearEnd = `${year + 1}-01-01`;

    // ───────── Contracts: count + premium + product list ─────────
    const filter = input.contactId
      ? and(
          eq(contracts.tenantId, auth.tenantId),
          eq(contracts.contactId, input.contactId),
          sql`${contracts.createdAt} >= ${yearStart} AND ${contracts.createdAt} < ${yearEnd}`,
        )
      : and(
          eq(contracts.tenantId, auth.tenantId),
          sql`${contracts.createdAt} >= ${yearStart} AND ${contracts.createdAt} < ${yearEnd}`,
        );

    const [contractStats] = await tx
      .select({
        total: sql<number>`count(*)::int`,
        totalPremium: sql<number>`coalesce(sum(premium_annual)::numeric, 0)::int`,
      })
      .from(contracts)
      .where(filter!);

    const products = await tx
      .select({
        name: contracts.productName,
        count: sql<number>`count(*)::int`,
      })
      .from(contracts)
      .where(filter!)
      .groupBy(contracts.productName)
      .limit(10);

    // ───────── Contacts count (per segment / per contact) ─────────
    const contactFilter = input.contactId
      ? and(eq(contacts.tenantId, auth.tenantId), eq(contacts.id, input.contactId))
      : eq(contacts.tenantId, auth.tenantId);

    const [contactStats] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(contacts)
      .where(contactFilter!);

    // ───────── Accepted proposal savings (advisor_proposals.savings_annual) ─────────
    const proposalContactClause = input.contactId
      ? sql`AND p.contact_id = ${input.contactId}::uuid`
      : sql``;
    const proposalSavingsRows = (await tx.execute(sql`
      SELECT coalesce(sum(p.savings_annual), 0)::numeric AS savings
      FROM advisor_proposals p
      WHERE p.tenant_id = ${auth.tenantId}::uuid
        AND p.status = 'accepted'
        AND p.responded_at >= ${yearStart}::timestamptz
        AND p.responded_at <  ${yearEnd}::timestamptz
        ${proposalContactClause}
    `)) as unknown as Array<{ savings: string | number }>;
    const totalProposalSavingsCzk = Math.round(
      Number(proposalSavingsRows[0]?.savings ?? 0),
    );

    // ───────── Protection savings — JSONB walk nad financial_analyses.payload ─────────
    // Struktura: payload.data.incomeProtection.persons[*].funding.benefitVsSalaryComparison.estimatedSavings
    // Používáme jsonb_path_query aby se iterovalo přes persons[*] pole.
    const analysesContactClause = input.contactId
      ? sql`AND fa.contact_id = ${input.contactId}::uuid`
      : sql``;
    let protectionSavingsCzk = 0;
    try {
      const rows = (await tx.execute(sql`
        SELECT coalesce(sum(
          COALESCE(
            (jsonb_path_query_first(
              fa.payload,
              '$.data.incomeProtection.persons[*].funding.benefitVsSalaryComparison.estimatedSavings'
            ))::numeric,
            0
          )
        ), 0)::numeric AS savings
        FROM financial_analyses fa
        WHERE fa.tenant_id = ${auth.tenantId}::uuid
          AND fa.created_at >= ${yearStart}::timestamptz
          AND fa.created_at <  ${yearEnd}::timestamptz
          ${analysesContactClause}
      `)) as unknown as Array<{ savings: string | number }>;
      protectionSavingsCzk = Math.round(Number(rows[0]?.savings ?? 0));
    } catch (err) {
      // Některé Postgres verze / data-shape mohou zbortit jsonb_path_query —
      // úspory z protection jsou bonus, nefailuj celou akci.
      console.warn("[year-in-review] protection savings aggregation failed", err);
    }

    // ───────── Meetings count ─────────
    const meetingsContactClause = input.contactId
      ? sql`AND e.contact_id = ${input.contactId}::uuid`
      : sql``;
    const meetingsRows = (await tx.execute(sql`
      SELECT count(*)::int AS total
      FROM events e
      WHERE e.tenant_id = ${auth.tenantId}::uuid
        AND e.event_type = 'schuzka'
        AND e.start_at >= ${yearStart}::timestamptz
        AND e.start_at <  ${yearEnd}::timestamptz
        ${meetingsContactClause}
    `)) as unknown as Array<{ total: number }>;
    const meetingsCount = Number(meetingsRows[0]?.total ?? 0);

    // ───────── Interní BJ snapshot (jen pro poradce v response; ne do HTML) ─────────
    // BJ points schema: contracts má jsonb `bj_calculation` s klíčem `totalUnits`.
    let bjUnitsInternal = 0;
    try {
      const rows = (await tx.execute(sql`
        SELECT coalesce(sum(COALESCE((bj_calculation->>'totalUnits')::numeric, 0)), 0)::numeric AS total
        FROM contracts
        WHERE tenant_id = ${auth.tenantId}::uuid
          AND created_at >= ${yearStart}::timestamptz
          AND created_at <  ${yearEnd}::timestamptz
          ${input.contactId ? sql`AND client_id = ${input.contactId}::uuid` : sql``}
      `)) as unknown as Array<{ total: string | number }>;
      bjUnitsInternal = Math.round(Number(rows[0]?.total ?? 0));
    } catch (err) {
      console.warn("[year-in-review] BJ aggregation skipped", err);
    }

    const productList = products.map((p) => p.name ?? "—").filter((n) => n && n !== "—");
    const productListText =
      productList.length > 0 ? productList.slice(0, 5).join(", ") : "—";

    const stats = {
      contactsCount: contactStats?.total ?? 0,
      contractsCount: contractStats?.total ?? 0,
      meetingsCount,
      totalPremiumCzk: Math.round(contractStats?.totalPremium ?? 0),
      totalProposalSavingsCzk,
      protectionSavingsCzk,
      productList,
      bjUnitsInternal,
    };

    // Celkové úspory = proposal savings + protection savings (pokud existují).
    const totalSavings = stats.totalProposalSavingsCzk + stats.protectionSavingsCzk;
    const formattedSavings = totalSavings
      ? `${totalSavings.toLocaleString("cs-CZ")} Kč`
      : stats.totalPremiumCzk
        ? `${stats.totalPremiumCzk.toLocaleString("cs-CZ")} Kč`
        : "—";
    const formattedProtectionSavings = stats.protectionSavingsCzk
      ? `${stats.protectionSavingsCzk.toLocaleString("cs-CZ")} Kč`
      : "—";

    const bodyHtml = template.bodyHtml
      .replaceAll("{{year_savings_total}}", formattedSavings)
      .replaceAll("{{savings_from_protection_review}}", formattedProtectionSavings)
      .replaceAll("{{products_list}}", productListText)
      .replaceAll("{{meetings_count}}", String(stats.meetingsCount))
      .replaceAll(
        "{{advisor_note}}",
        "Pokud bude mít cokoliv, co bychom měli probrat, jsem Vám k dispozici.",
      );

    const subject = template.subject.replace("{{rok}}", String(year));
    const preheader = (template.preheader ?? "").replace("{{rok}}", String(year));

    return { subject, preheader, bodyHtml, stats };
  });
}
