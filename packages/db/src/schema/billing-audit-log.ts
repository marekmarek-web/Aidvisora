import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

/**
 * Append-only audit trail pro billingové události (WS-1).
 * Zápisy výhradně přes service-role (serverový kód), RLS brání klientskému zápisu.
 */
export const billingAuditLog = pgTable(
  "billing_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    /** Stabilní kód události — viz BillingAuditAction. */
    action: text("action").notNull(),
    /** user | system | webhook */
    actorKind: text("actor_kind").notNull(),
    actorUserId: text("actor_user_id"),
    fromState: jsonb("from_state"),
    toState: jsonb("to_state"),
    stripeEventId: text("stripe_event_id"),
    stripeObjectId: text("stripe_object_id"),
    metadata: jsonb("metadata"),
    ipAddress: text("ip_address"),
    at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    tenantAtIdx: index("billing_audit_log_tenant_at_idx").on(t.tenantId, t.at),
    actionAtIdx: index("billing_audit_log_action_at_idx").on(t.action, t.at),
  }),
);
