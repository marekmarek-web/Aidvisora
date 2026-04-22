/**
 * Tenant-scoped contact search for the internal AI assistant (no server-action auth).
 */

import { contacts, eq, and, or, isNull, sql, desc } from "db";
import { withTenantContext } from "@/lib/db/with-tenant-context";
import { maskPersonalId } from "./assistant-context-builder";
import {
  escapeIlikeLiteral,
  normalizeNameSearchQuery,
  splitNameSearchTokens,
} from "./assistant-contact-search-normalize";

export type AssistantContactMatch = {
  id: string;
  displayName: string;
  hint: string;
};

export { escapeIlikeLiteral, normalizeNameSearchQuery, splitNameSearchTokens };

function emailDomainHint(email: string | null | undefined): string | null {
  if (!email?.trim()) return null;
  const at = email.indexOf("@");
  if (at <= 0) return null;
  return `…${email.slice(at)}`;
}

function phoneLast4Hint(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;
  const d = phone.replace(/\s/g, "");
  if (d.length < 4) return null;
  return `tel. …${d.slice(-4)}`;
}

function buildHint(row: {
  email: string | null;
  phone: string | null;
  city: string | null;
  personalId: string | null;
}): string {
  const parts: string[] = [];
  const em = emailDomainHint(row.email);
  if (em) parts.push(em);
  if (row.city?.trim()) parts.push(row.city.trim());
  const ph = phoneLast4Hint(row.phone);
  if (ph) parts.push(ph);
  if (row.personalId?.trim()) {
    parts.push(`r.č. ${maskPersonalId(row.personalId)}`);
  }
  return parts.join(" · ") || "—";
}

const DEFAULT_LIMIT = 12;

export type AssistantContactSearchMatchMode = "all" | "name_only";

function tokenPattern(token: string): string {
  return `%${escapeIlikeLiteral(token)}%`;
}

function sqlTokenMatch(token: string, mode: AssistantContactSearchMatchMode) {
  const pattern = tokenPattern(token);
  const nameOr = or(
    sql`concat(${contacts.firstName}, ' ', ${contacts.lastName}) ILIKE ${pattern} ESCAPE '\\'`,
    sql`${contacts.firstName} ILIKE ${pattern} ESCAPE '\\'`,
    sql`${contacts.lastName} ILIKE ${pattern} ESCAPE '\\'`,
  );
  if (mode === "name_only") {
    return nameOr;
  }
  return or(
    nameOr,
    sql`COALESCE(${contacts.email}, '') ILIKE ${pattern} ESCAPE '\\'`,
    sql`COALESCE(${contacts.phone}, '') ILIKE ${pattern} ESCAPE '\\'`,
  );
}

/**
 * ILIKE search — scoped to tenant, non-archived only.
 * Uses normalized query + per-token AND (names; optional email/phone per token when match=all).
 */
export async function searchContactsForAssistant(
  tenantId: string,
  rawQuery: string,
  limit = DEFAULT_LIMIT,
  opts?: { match?: AssistantContactSearchMatchMode },
): Promise<AssistantContactMatch[]> {
  const trimmed = rawQuery.trim();
  if (!trimmed) return [];

  const mode: AssistantContactSearchMatchMode = opts?.match ?? "all";
  const normalized = normalizeNameSearchQuery(trimmed);
  const searchBasis = normalized || trimmed;

  let tokens = splitNameSearchTokens(searchBasis);
  if (tokens.length === 0 && searchBasis.length > 0) {
    tokens = [searchBasis];
  }
  if (tokens.length === 0) return [];

  const tokenConds = tokens.map((t) => sqlTokenMatch(t, mode));
  const matchClause =
    tokenConds.length === 1 ? tokenConds[0]! : and(...tokenConds);

  const rows = await withTenantContext({ tenantId }, (tx) =>
    tx
      .select({
        id: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        email: contacts.email,
        phone: contacts.phone,
        city: contacts.city,
        personalId: contacts.personalId,
        updatedAt: contacts.updatedAt,
      })
      .from(contacts)
      .where(and(eq(contacts.tenantId, tenantId), isNull(contacts.archivedAt), matchClause))
      .orderBy(desc(contacts.updatedAt))
      .limit(Math.min(Math.max(limit, 1), 25)),
  );

  return rows.map((r) => ({
    id: r.id,
    displayName: `${r.firstName} ${r.lastName}`.trim(),
    hint: buildHint({
      email: r.email,
      phone: r.phone,
      city: r.city,
      personalId: r.personalId,
    }),
  }));
}
