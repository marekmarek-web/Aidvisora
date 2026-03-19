import { requireAuth } from "@/lib/auth/require-auth";
import { db, contacts, and, eq } from "db";
import { getClientHouseholdForContact } from "@/app/actions/households";
import { ProfileClientView } from "./ProfileClientView";

export default async function ClientProfilePage() {
  const auth = await requireAuth();
  if (auth.roleName !== "Client" || !auth.contactId) return null;

  const [profile, household] = await Promise.all([
    db
      .select({
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        email: contacts.email,
        phone: contacts.phone,
        street: contacts.street,
        city: contacts.city,
        zip: contacts.zip,
      })
      .from(contacts)
      .where(and(eq(contacts.tenantId, auth.tenantId), eq(contacts.id, auth.contactId)))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    getClientHouseholdForContact(auth.contactId),
  ]);

  if (!profile) return null;

  return <ProfileClientView profile={profile} household={household} />;
}
