import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { contacts } from "./contacts";

/** Jednoduchá e-mailová kampaň (MVP newsletter) — jeden tenant, hromadné odeslání přes Resend. */
export const emailCampaigns = pgTable("email_campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  createdByUserId: text("created_by_user_id").notNull(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  bodyHtml: text("body_html").notNull(),
  /** draft | sending | sent | failed */
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
});

export const emailCampaignRecipients = pgTable("email_campaign_recipients", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => emailCampaigns.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id")
    .notNull()
    .references(() => contacts.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  /** pending | sent | failed | skipped */
  status: text("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  providerMessageId: text("provider_message_id"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
