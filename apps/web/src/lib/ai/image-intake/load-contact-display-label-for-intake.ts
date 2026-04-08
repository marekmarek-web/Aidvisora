import { db, contacts, eq, and } from "db";

/** Display label for image-intake identity vs. route context checks (same tenant). */
export async function loadContactDisplayLabelForIntake(
  tenantId: string,
  contactId: string,
): Promise<string | null> {
  try {
    const rows = await db
      .select({
        firstName: contacts.firstName,
        lastName: contacts.lastName,
      })
      .from(contacts)
      .where(and(eq(contacts.tenantId, tenantId), eq(contacts.id, contactId)))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    const label = `${row.firstName} ${row.lastName}`.trim();
    return label.length ? label : null;
  } catch {
    return null;
  }
}
