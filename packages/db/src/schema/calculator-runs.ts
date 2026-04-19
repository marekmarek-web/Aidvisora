import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { contacts } from "./contacts";

/**
 * Historie propočtů z kalkulaček (hypotéka / úvěr / investice / penze / životní pojištění apod.).
 * Uchováváme jen vstupy a orientační výstup – nejedná se o poradenství klientovi.
 */
export const calculatorRuns = pgTable("calculator_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  createdBy: text("created_by").notNull(),
  contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  calculatorType: text("calculator_type").notNull(),
  label: text("label"),
  inputs: jsonb("inputs"),
  outputs: jsonb("outputs"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
