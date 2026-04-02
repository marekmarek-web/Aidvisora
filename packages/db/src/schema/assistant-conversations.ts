import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const assistantConversations = pgTable("assistant_conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  userId: uuid("user_id").notNull(),
  channel: text("channel"),
  assistantMode: text("assistant_mode").default("quick_assistant"),
  lockedContactId: uuid("locked_contact_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const assistantMessages = pgTable("assistant_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => assistantConversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  intentSnapshot: jsonb("intent_snapshot"),
  executionPlanSnapshot: jsonb("execution_plan_snapshot"),
  referencedEntities: jsonb("referenced_entities"),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
