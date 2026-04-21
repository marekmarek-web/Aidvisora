import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { contacts } from "./contacts";

/**
 * Append-first log všech outbound notifikací (mail/push/sms). Provider
 * `messageId` slouží jako korelační klíč pro webhooky (Resend bounce/complaint).
 * `lastStatus` se aktualizuje přes webhook — proto není v této tabulce
 * unikátní append-only: updates jen sloupců `last_status`, `last_status_at`,
 * `last_error` a `meta` přes match na `provider_message_id`.
 */
export const notificationLog = pgTable(
  "notification_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull(),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    channel: text("channel").notNull().default("email"),
    template: text("template"),
    subject: text("subject"),
    recipient: text("recipient"),
    status: text("status").notNull().default("sent"),
    providerMessageId: text("provider_message_id"),
    lastStatus: text("last_status"),
    lastStatusAt: timestamp("last_status_at", { withTimezone: true }),
    lastError: text("last_error"),
    meta: jsonb("meta"),
    sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    byProviderId: index("notification_log_provider_message_id_idx").on(t.providerMessageId),
    byTenantSent: index("notification_log_tenant_sent_at_idx").on(t.tenantId, t.sentAt),
  }),
);
