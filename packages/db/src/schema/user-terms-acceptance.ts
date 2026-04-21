import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { contacts } from "./contacts";

export const userTermsAcceptance = pgTable(
  "user_terms_acceptance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id"),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    tenantId: uuid("tenant_id"),
    context: text("context").notNull(),
    version: text("version").notNull(),
    documents: text("documents").array().notNull(),
    userAgent: text("user_agent"),
    locale: text("locale"),
    ipAddress: text("ip_address"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    byUser: index("user_terms_acceptance_user_idx").on(t.userId, t.acceptedAt),
    byContact: index("user_terms_acceptance_contact_idx").on(t.contactId, t.acceptedAt),
    byTenant: index("user_terms_acceptance_tenant_idx").on(t.tenantId, t.acceptedAt),
  }),
);
