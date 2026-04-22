import { pgTable, uuid, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";

/**
 * Per-tenant perzistence štítků Boardu. Nahrazuje localStorage klíč
 * `aidvisora_labels`, aby se sady synchronizovaly mezi desktopem a mobilním
 * WebView (Capacitor má vlastní WebKit localStorage).
 *
 * `id` si zachovává původní `label_<timestamp>` formát, aby byly existující
 * reference v `contracts.statusLabel`, `contacts.statusLabel` apod. zpětně
 * kompatibilní.
 */
export const boardLabels = pgTable("board_labels", {
  id: text("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  name: text("name").notNull().default(""),
  color: text("color").notNull(),
  isClosedDeal: boolean("is_closed_deal").notNull().default(false),
  sortIndex: integer("sort_index").notNull().default(0),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type BoardLabelRow = typeof boardLabels.$inferSelect;
export type NewBoardLabelRow = typeof boardLabels.$inferInsert;
