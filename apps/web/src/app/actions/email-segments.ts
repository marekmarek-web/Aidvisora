"use server";

import { withAuthContext } from "@/lib/auth/with-auth-context";
import { hasPermission } from "@/lib/auth/permissions";
import { contacts, eq, and, isNull, sql } from "db";
import {
  buildSegmentFilterSql,
  isValidSegmentFilter,
  type SegmentFilter,
} from "@/lib/email/segment-filter";

/**
 * F4 — živý preview počtu kontaktů, které spadají do daného segmentFilter
 * (po aplikaci baseline filtrů: platný email, ne doNotEmail, ne unsubscribed).
 */
export async function previewSegmentCount(
  filter: SegmentFilter | null,
): Promise<{ count: number; sampleNames: string[] }> {
  return withAuthContext(async (auth, tx) => {
    if (!hasPermission(auth.roleName, "contacts:read")) {
      throw new Error("Nemáte oprávnění.");
    }
    const customFilter =
      filter && isValidSegmentFilter(filter) ? buildSegmentFilterSql(filter) : sql`true`;

    const [row] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(contacts)
      .where(
        and(
          eq(contacts.tenantId, auth.tenantId),
          isNull(contacts.archivedAt),
          eq(contacts.doNotEmail, false),
          isNull(contacts.notificationUnsubscribedAt),
          sql`${contacts.email} IS NOT NULL AND trim(${contacts.email}) <> ''`,
          customFilter,
        ),
      );

    const sample = await tx
      .select({ firstName: contacts.firstName, lastName: contacts.lastName })
      .from(contacts)
      .where(
        and(
          eq(contacts.tenantId, auth.tenantId),
          isNull(contacts.archivedAt),
          eq(contacts.doNotEmail, false),
          isNull(contacts.notificationUnsubscribedAt),
          sql`${contacts.email} IS NOT NULL AND trim(${contacts.email}) <> ''`,
          customFilter,
        ),
      )
      .limit(5);

    const sampleNames = sample.map((r) =>
      `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() || "—",
    );
    return { count: row?.total ?? 0, sampleNames };
  });
}
