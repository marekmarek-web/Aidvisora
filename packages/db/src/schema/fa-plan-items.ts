import { pgTable, uuid, text, timestamp, decimal, jsonb, index } from "drizzle-orm/pg-core";
import { financialAnalyses } from "./financial-analyses";
import { contacts } from "./contacts";
import { opportunities } from "./pipeline";

export const FA_PLAN_ITEM_TYPES = [
  "insurance_plan",
  "investment",
  "goal",
  "credit",
  "pension",
] as const;
export type FaPlanItemType = (typeof FA_PLAN_ITEM_TYPES)[number];

export const FA_PLAN_ITEM_STATUSES = [
  "recommended",
  "in_progress",
  "waiting_signature",
  "sold",
  "not_relevant",
  "cancelled",
] as const;
export type FaPlanItemStatus = (typeof FA_PLAN_ITEM_STATUSES)[number];

export const faPlanItems = pgTable(
  "fa_plan_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull(),
    analysisId: uuid("analysis_id")
      .notNull()
      .references(() => financialAnalyses.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    opportunityId: uuid("opportunity_id").references(() => opportunities.id, { onDelete: "set null" }),
    itemType: text("item_type").notNull(),
    itemKey: text("item_key"),
    segmentCode: text("segment_code"),
    label: text("label"),
    provider: text("provider"),
    amountMonthly: decimal("amount_monthly", { precision: 14, scale: 2 }),
    amountAnnual: decimal("amount_annual", { precision: 14, scale: 2 }),
    status: text("status").notNull().default("recommended"),
    sourcePayload: jsonb("source_payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("fa_plan_items_analysis_idx").on(t.analysisId),
    index("fa_plan_items_contact_idx").on(t.contactId),
  ]
);
