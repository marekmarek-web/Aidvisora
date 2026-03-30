import { pgTable, text, uuid, timestamp, jsonb, unique, integer, boolean } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

/** ISO weekday 1 = Monday … 7 = Sunday; each day has ordered non-overlapping windows "HH:mm". */
export type BookingWeeklyAvailability = Record<string, { start: string; end: string }[]>;

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
    phone: text("phone"),
    website: text("website"),
    reportLogoUrl: text("report_logo_url"),
    publicBookingToken: text("public_booking_token"),
    publicBookingEnabled: boolean("public_booking_enabled").default(false).notNull(),
    bookingAvailability: jsonb("booking_availability").$type<BookingWeeklyAvailability | null>(),
    bookingSlotMinutes: integer("booking_slot_minutes").default(30).notNull(),
    bookingBufferMinutes: integer("booking_buffer_minutes").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique("advisor_preferences_tenant_user").on(t.tenantId, t.userId)]
);
