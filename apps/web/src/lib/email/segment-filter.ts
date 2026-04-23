import { sql, type SQL } from "drizzle-orm";

/**
 * Shape of segment filter JSON stored in `email_campaigns.segment_filter` /
 * `email_automation_rules.segment_filter`. Visual builder na frontendu pracuje
 * s touto strukturou; server ji převádí na SQL.
 */
export type SegmentOperator = "AND" | "OR";

/** Hodnoty pro `contracts.segment` — viz `packages/db/src/schema/contracts.ts`. */
export const CONTRACT_SEGMENT_VALUES = [
  "ZP",
  "MAJ",
  "ODP",
  "ODP_ZAM",
  "AUTO_PR",
  "AUTO_HAV",
  "CEST",
  "INV",
  "DIP",
  "DPS",
  "HYPO",
  "UVER",
  "FIRMA_POJ",
] as const;
export type ContractSegmentValue = (typeof CONTRACT_SEGMENT_VALUES)[number];

/** Common lifecycle stages — plynou z onboarding / CRM konvencí. Free text v DB. */
export const LIFECYCLE_STAGE_VALUES = [
  "lead",
  "prospect",
  "client",
  "past_client",
  "vip",
] as const;
export type LifecycleStageValue = (typeof LIFECYCLE_STAGE_VALUES)[number];

export type SegmentRule =
  | { field: "tag"; op: "includes" | "excludes"; value: string }
  | { field: "city"; op: "is" | "isNot"; value: string }
  | { field: "birthMonth"; op: "is"; value: number /* 1..12 */ }
  | { field: "createdWithinDays"; op: "lte" | "gte"; value: number }
  | { field: "hasActiveContract"; op: "is"; value: boolean }
  | { field: "hasEmail"; op: "is"; value: boolean }
  // B2.2 — nová pole
  | { field: "lifecycleStage"; op: "is" | "isNot"; value: string }
  | { field: "contractSegment"; op: "has" | "hasNot"; value: string }
  | { field: "ageRange"; op: "between"; value: { min: number; max: number } }
  | { field: "hasOpenOpportunity"; op: "is"; value: boolean };

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
    case "lifecycleStage": {
      // Hodnoty jsou v DB free-text, porovnáváme case-insensitive.
      return rule.op === "is"
        ? sql`lower(coalesce(contacts.lifecycle_stage, '')) = lower(${rule.value})`
        : sql`lower(coalesce(contacts.lifecycle_stage, '')) <> lower(${rule.value})`;
    }
    case "contractSegment": {
      // „Má alespoň jednu neaktivní smlouvu v daném segmentu."
      // Povolujeme aktivní i pending, pouze archived vynecháme.
      if (!CONTRACT_SEGMENT_VALUES.includes(rule.value as ContractSegmentValue)) {
        return null;
      }
      const exists = sql`EXISTS (
        SELECT 1 FROM contracts ct
        WHERE ct.client_id = contacts.id
          AND ct.tenant_id = contacts.tenant_id
          AND ct.archived_at IS NULL
          AND ct.segment = ${rule.value}
      )`;
      return rule.op === "has" ? exists : sql`NOT (${exists})`;
    }
    case "ageRange": {
      const min = Math.max(0, Math.min(120, Math.floor(Number(rule.value?.min) || 0)));
      const max = Math.max(min, Math.min(120, Math.floor(Number(rule.value?.max) || 120)));
      return sql`EXTRACT(YEAR FROM age(contacts.birth_date))::int BETWEEN ${min} AND ${max}`;
    }
    case "hasOpenOpportunity": {
      const exists = sql`EXISTS (
        SELECT 1 FROM opportunities o
        WHERE o.contact_id = contacts.id
          AND o.tenant_id = contacts.tenant_id
          AND o.closed_at IS NULL
      )`;
      return rule.value ? exists : sql`NOT (${exists})`;
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
  valueType: "text" | "number" | "month" | "boolean" | "ageRange" | "lifecycle" | "contractSegment";
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
  {
    field: "lifecycleStage",
    label: "Fáze vztahu",
    ops: [
      { id: "is", label: "je" },
      { id: "isNot", label: "není" },
    ],
    valueType: "lifecycle",
  },
  {
    field: "contractSegment",
    label: "Má smlouvu v segmentu",
    ops: [
      { id: "has", label: "má" },
      { id: "hasNot", label: "nemá" },
    ],
    valueType: "contractSegment",
  },
  {
    field: "ageRange",
    label: "Věk (roky)",
    ops: [{ id: "between", label: "mezi" }],
    valueType: "ageRange",
  },
  {
    field: "hasOpenOpportunity",
    label: "Má otevřenou příležitost",
    ops: [{ id: "is", label: "je" }],
    valueType: "boolean",
  },
];
