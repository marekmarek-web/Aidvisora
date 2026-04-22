import { sql, type SQL } from "drizzle-orm";

/**
 * Shape of segment filter JSON stored in `email_campaigns.segment_filter` /
 * `email_automation_rules.segment_filter`. Visual builder na frontendu pracuje
 * s touto strukturou; server ji převádí na SQL.
 */
export type SegmentOperator = "AND" | "OR";

export type SegmentRule =
  | { field: "tag"; op: "includes" | "excludes"; value: string }
  | { field: "city"; op: "is" | "isNot"; value: string }
  | { field: "birthMonth"; op: "is"; value: number /* 1..12 */ }
  | { field: "createdWithinDays"; op: "lte" | "gte"; value: number }
  | { field: "hasActiveContract"; op: "is"; value: boolean }
  | { field: "hasEmail"; op: "is"; value: boolean };

export type SegmentFilter = {
  operator: SegmentOperator;
  rules: SegmentRule[];
};

export function isValidSegmentFilter(val: unknown): val is SegmentFilter {
  if (!val || typeof val !== "object") return false;
  const v = val as { operator?: unknown; rules?: unknown };
  if (v.operator !== "AND" && v.operator !== "OR") return false;
  if (!Array.isArray(v.rules)) return false;
  return v.rules.every((r) => r && typeof r === "object");
}

/**
 * Převede filter na SQL WHERE expresi aplikovanou na tabulku `contacts`.
 * Vrací `sql\`true\`` pro prázdný filtr.
 *
 * Filtr odkazuje na tabulku `contacts` přímo (bez aliasu). Callsite musí mít
 * `.from(contacts)` bez aliasu — Drizzle pak používá plné jméno tabulky.
 */
export function buildSegmentFilterSql(filter: SegmentFilter | null | undefined): SQL {
  if (!filter || filter.rules.length === 0) return sql`true`;

  const parts: SQL[] = [];
  for (const rule of filter.rules) {
    const clause = ruleToSql(rule);
    if (clause) parts.push(clause);
  }
  if (parts.length === 0) return sql`true`;

  const joiner = filter.operator === "OR" ? sql` OR ` : sql` AND `;
  const chunks: SQL[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (i > 0) chunks.push(joiner);
    chunks.push(sql`(${parts[i]})`);
  }
  return sql.join(chunks, sql``);
}

function ruleToSql(rule: SegmentRule): SQL | null {
  switch (rule.field) {
    case "tag": {
      const v = rule.value.toLowerCase();
      const exists = sql`EXISTS (
        SELECT 1 FROM unnest(coalesce(contacts.tags, ARRAY[]::text[])) AS t(tag)
        WHERE lower(t.tag) = ${v}
      )`;
      return rule.op === "includes" ? exists : sql`NOT (${exists})`;
    }
    case "city": {
      return rule.op === "is"
        ? sql`lower(coalesce(contacts.city, '')) = lower(${rule.value})`
        : sql`lower(coalesce(contacts.city, '')) <> lower(${rule.value})`;
    }
    case "birthMonth": {
      const m = Math.max(1, Math.min(12, Number(rule.value) || 0));
      return sql`EXTRACT(MONTH FROM contacts.birth_date) = ${m}`;
    }
    case "createdWithinDays": {
      const d = Math.max(1, Math.floor(Number(rule.value) || 1));
      return rule.op === "lte"
        ? sql`contacts.created_at >= now() - (${d}::int || ' days')::interval`
        : sql`contacts.created_at < now() - (${d}::int || ' days')::interval`;
    }
    case "hasActiveContract": {
      const exists = sql`EXISTS (
        SELECT 1 FROM contracts ct
        WHERE ct.client_id = contacts.id
          AND ct.tenant_id = contacts.tenant_id
          AND ct.archived_at IS NULL
          AND ct.portfolio_status = 'active'
      )`;
      return rule.value ? exists : sql`NOT (${exists})`;
    }
    case "hasEmail": {
      const hasEmail = sql`contacts.email IS NOT NULL AND trim(contacts.email) <> ''`;
      return rule.value ? hasEmail : sql`NOT (${hasEmail})`;
    }
    default:
      return null;
  }
}

/** Denormalized list of field definitions for UI builder. */
export const SEGMENT_FIELDS: Array<{
  field: SegmentRule["field"];
  label: string;
  ops: Array<{ id: string; label: string }>;
  valueType: "text" | "number" | "month" | "boolean";
}> = [
  {
    field: "tag",
    label: "Štítek",
    ops: [
      { id: "includes", label: "obsahuje" },
      { id: "excludes", label: "neobsahuje" },
    ],
    valueType: "text",
  },
  {
    field: "city",
    label: "Město",
    ops: [
      { id: "is", label: "je" },
      { id: "isNot", label: "není" },
    ],
    valueType: "text",
  },
  {
    field: "birthMonth",
    label: "Měsíc narození",
    ops: [{ id: "is", label: "je" }],
    valueType: "month",
  },
  {
    field: "createdWithinDays",
    label: "Vznik kontaktu",
    ops: [
      { id: "lte", label: "max. před X dny" },
      { id: "gte", label: "déle než X dny" },
    ],
    valueType: "number",
  },
  {
    field: "hasActiveContract",
    label: "Má aktivní smlouvu",
    ops: [{ id: "is", label: "je" }],
    valueType: "boolean",
  },
  {
    field: "hasEmail",
    label: "Má e-mail",
    ops: [{ id: "is", label: "je" }],
    valueType: "boolean",
  },
];
