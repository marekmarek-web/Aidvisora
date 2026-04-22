import { requireClientZoneAuth } from "@/lib/auth/require-auth";
import { contacts, and, eq } from "db";
import { withTenantContext } from "@/lib/db/with-tenant-context";
import { getClientHouseholdForContact } from "@/app/actions/households";
import { ProfileClientView } from "./ProfileClientView";

export default async function ClientProfilePage() {
  const auth = await requireClientZoneAuth();
  if (!auth.contactId) return null;

  let profile: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    street: string | null;
    city: string | null;
    zip: string | null;
  } | null = null;
  let household: Awaited<ReturnType<typeof getClientHouseholdForContact>> = null;
  try {
    [profile, household] = await Promise.all([
      withTenantContext({ tenantId: auth.tenantId, userId: auth.userId }, (tx) =>
        tx
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
          .where(and(eq(contacts.tenantId, auth.tenantId), eq(contacts.id, auth.contactId!)))
          .limit(1)
          .then((rows) => rows[0] ?? null),
      ),
      getClientHouseholdForContact(auth.contactId),
    ]);
  } catch {
    profile = null;
    household = null;
  }

  if (!profile) return null;

  const safeProfile = {
    ...profile,
    firstName: profile.firstName ?? "",
    lastName: profile.lastName ?? "",
  };

  return <ProfileClientView profile={safeProfile} household={household} />;
}
