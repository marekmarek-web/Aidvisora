import "server-only";

import { db, advisorPreferences, tenants, userProfiles, events, contacts, eq, and, lt, or, isNull, ne, sql } from "db";
import type { BookingWeeklyAvailability } from "db";
import type { BusyInterval } from "./slots";

export type ResolvedPublicBookingAdvisor = {
  tenantId: string;
  userId: string;
  tenantName: string;
  advisorName: string;
  slotMinutes: number;
  bufferMinutes: number;
  availability: BookingWeeklyAvailability;
};

export async function resolveEnabledPublicBooking(
  token: string,
): Promise<ResolvedPublicBookingAdvisor | null> {
  const t = token.trim();
  if (!t || t.length > 80) return null;

  const rows = await db
    .select({
      tenantId: advisorPreferences.tenantId,
      userId: advisorPreferences.userId,
      slotMinutes: advisorPreferences.bookingSlotMinutes,
      bufferMinutes: advisorPreferences.bookingBufferMinutes,
      availability: advisorPreferences.bookingAvailability,
      tenantName: tenants.name,
    })
    .from(advisorPreferences)
    .innerJoin(tenants, eq(advisorPreferences.tenantId, tenants.id))
    .where(
      and(
        eq(advisorPreferences.publicBookingToken, t),
        eq(advisorPreferences.publicBookingEnabled, true),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const [profile] = await db
    .select({ fullName: userProfiles.fullName })
    .from(userProfiles)
    .where(eq(userProfiles.userId, row.userId))
    .limit(1);

  const availability = (row.availability ?? null) as BookingWeeklyAvailability | null;
  if (!availability || Object.keys(availability).length === 0) return null;

  return {
    tenantId: row.tenantId,
    userId: row.userId,
    tenantName: row.tenantName?.trim() || "—",
    advisorName: profile?.fullName?.trim() || "Poradce",
    slotMinutes: row.slotMinutes ?? 30,
    bufferMinutes: row.bufferMinutes ?? 0,
    availability,
  };
}

export async function loadBusyIntervalsForAdvisor(
  tenantId: string,
  userId: string,
  rangeStartUtc: Date,
  rangeEndUtc: Date,
): Promise<BusyInterval[]> {
  const rows = await db
    .select({
      startAt: events.startAt,
      endAt: events.endAt,
      status: events.status,
    })
    .from(events)
    .where(
      and(
        eq(events.tenantId, tenantId),
        eq(events.assignedTo, userId),
        lt(events.startAt, rangeEndUtc),
        or(isNull(events.status), ne(events.status, "cancelled")),
      ),
    );

  const out: BusyInterval[] = [];
  const rangeStartMs = rangeStartUtc.getTime();
  const rangeEndMs = rangeEndUtc.getTime();

  for (const r of rows) {
    const end = r.endAt ?? new Date(r.startAt.getTime() + 60 * 60 * 1000);
    const startMs = r.startAt.getTime();
    const endMs = end.getTime();
    if (endMs <= rangeStartMs || startMs >= rangeEndMs) continue;
    out.push({ startMs, endMs });
  }
  return out;
}

export async function findContactIdByEmail(tenantId: string, email: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const [row] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(
      and(eq(contacts.tenantId, tenantId), sql`lower(trim(${contacts.email})) = ${normalized}`),
    )
    .limit(1);
  return row?.id ?? null;
}
