import { pgTable, uuid, text, timestamp, boolean, unique } from "drizzle-orm/pg-core";
import { contacts } from "./contacts";
import { contracts } from "./contracts";
import { opportunities } from "./pipeline";

/** Stav položky pokrytí – systémové hodnoty. */
export const COVERAGE_STATUSES = ["done", "in_progress", "none", "not_relevant", "opportunity"] as const;
export type CoverageStatus = (typeof COVERAGE_STATUSES)[number];

/**
 * Explicitní stav pokrytí klienta po položkách (item_key z COVERAGE_CATEGORIES).
 * Sloučí se s odvozením ze smluv a obchodů v coverage engine.
 */
export const contactCoverage = pgTable(
  "contact_coverage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    itemKey: text("item_key").notNull(),
    segmentCode: text("segment_code").notNull(),
    status: text("status").notNull(),
    linkedContractId: uuid("linked_contract_id").references(() => contracts.id, { onDelete: "set null" }),
    linkedOpportunityId: uuid("linked_opportunity_id").references(() => opportunities.id, { onDelete: "set null" }),
    notes: text("notes"),
    isRelevant: boolean("is_relevant").default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedBy: text("updated_by"),
  },
  (t) => [unique("contact_coverage_tenant_contact_item").on(t.tenantId, t.contactId, t.itemKey)]
);
