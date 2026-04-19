import { pgTable, uuid, text, timestamp, date, numeric, jsonb } from "drizzle-orm/pg-core";
import { contacts, households } from "./contacts";
import { calculatorRuns } from "./calculator-runs";
import { opportunities } from "./pipeline";

/**
 * Návrhy od poradce publikované klientovi do portálu (úspora/modelace, kterou klient
 * na schůzce neakceptoval, ale poradce ji chce držet viditelnou v klientské zóně).
 *
 * **Důležité:** Nejde o AI doporučení platformy klientovi. Obsah píše a publikuje
 * poradce ručně. Klient může reagovat → vytvoří se `opportunities` požadavek.
 */
export const advisorProposalSegments = [
  "insurance_auto",
  "insurance_property",
  "insurance_life",
  "mortgage",
  "credit",
  "investment",
  "pension",
  "other",
] as const;
export type AdvisorProposalSegment = (typeof advisorProposalSegments)[number];

export const advisorProposalStatuses = [
  "draft",
  "published",
  "viewed",
  "accepted",
  "declined",
  "expired",
  "withdrawn",
] as const;
export type AdvisorProposalStatus = (typeof advisorProposalStatuses)[number];

export type AdvisorProposalBenefit = {
  label: string;
  delta?: string | null;
};

export const advisorProposals = pgTable("advisor_proposals", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  contactId: uuid("contact_id")
    .notNull()
    .references(() => contacts.id, { onDelete: "cascade" }),
  householdId: uuid("household_id").references(() => households.id, { onDelete: "set null" }),
  createdBy: text("created_by").notNull(),
  segment: text("segment").$type<AdvisorProposalSegment>().notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  currentAnnualCost: numeric("current_annual_cost", { precision: 12, scale: 2 }),
  proposedAnnualCost: numeric("proposed_annual_cost", { precision: 12, scale: 2 }),
  /** GENERATED ALWAYS — read-only v aplikaci, dopočítává Postgres. */
  savingsAnnual: numeric("savings_annual", { precision: 12, scale: 2 }),
  currency: text("currency").notNull().default("CZK"),
  benefits: jsonb("benefits").$type<AdvisorProposalBenefit[] | null>(),
  validUntil: date("valid_until", { mode: "string" }),
  status: text("status").$type<AdvisorProposalStatus>().notNull().default("draft"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  firstViewedAt: timestamp("first_viewed_at", { withTimezone: true }),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  responseRequestId: uuid("response_request_id").references(() => opportunities.id, {
    onDelete: "set null",
  }),
  sourceCalculatorRunId: uuid("source_calculator_run_id").references(() => calculatorRuns.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
