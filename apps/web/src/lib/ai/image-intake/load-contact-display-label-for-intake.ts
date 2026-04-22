import { contacts, eq, and } from "db";
import { withTenantContext } from "@/lib/db/with-tenant-context";

/** Display label for image-intake identity vs. route context checks (same tenant). */
export async function loadContactDisplayLabelForIntake(
  tenantId: string,
  contactId: string,
): Promise<string | null> {
  try {
    const rows = await withTenantContext({ tenantId }, (tx) =>
      tx
        .select({
          firstName: contacts.firstName,
          lastName: contacts.lastName,
        })
        .from(contacts)
        .where(and(eq(contacts.tenantId, tenantId), eq(contacts.id, contactId)))
        .limit(1),
    );
    const row = rows[0];
    if (!row) return null;
    const label = `${row.firstName} ${row.lastName}`.trim();
    return label.length ? label : null;
  } catch {
    return null;
  }
}

export type ContactFieldsForDiff = Record<string, string | null | undefined>;

/** Loads contact fields needed for field-level diff preview (same tenant). */
export async function loadContactFieldsForDiff(
  tenantId: string,
  contactId: string,
): Promise<ContactFieldsForDiff> {
  try {
    const rows = await withTenantContext({ tenantId }, (tx) =>
      tx
        .select({
          firstName: contacts.firstName,
          lastName: contacts.lastName,
          email: contacts.email,
          phone: contacts.phone,
          title: contacts.title,
          birthDate: contacts.birthDate,
          personalId: contacts.personalId,
          street: contacts.street,
          city: contacts.city,
          zip: contacts.zip,
        })
        .from(contacts)
        .where(and(eq(contacts.tenantId, tenantId), eq(contacts.id, contactId)))
        .limit(1),
    );
    const row = rows[0];
    if (!row) return {};
    return {
      firstName: row.firstName ?? undefined,
      lastName: row.lastName ?? undefined,
      email: row.email ?? undefined,
      phone: row.phone ?? undefined,
      title: row.title ?? undefined,
      birthDate: row.birthDate ?? undefined,
      personalId: row.personalId ?? undefined,
      street: row.street ?? undefined,
      city: row.city ?? undefined,
      zip: row.zip ?? undefined,
    };
  } catch {
    return {};
  }
}
