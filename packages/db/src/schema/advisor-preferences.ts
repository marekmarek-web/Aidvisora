import { pgTable, text, uuid, timestamp, jsonb, unique } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

/** Per-user (advisor) preferences; quick_actions drives the "+ Nový" menu in the header. */
export const advisorPreferences = pgTable(
  "advisor_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    quickActions: jsonb("quick_actions").$type<{ order: string[]; visible: Record<string, boolean> }>(),
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique("advisor_preferences_tenant_user").on(t.tenantId, t.userId)]
);
