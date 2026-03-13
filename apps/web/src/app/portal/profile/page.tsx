import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { db, tenants, advisorPreferences } from "db";
import { eq, and } from "db";
import { AdvisorProfileView } from "./AdvisorProfileView";

export default async function ProfilePage() {
  const auth = await requireAuth();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email ?? "";
  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? null;

  const [tenantRow] = await db
    .select({ name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, auth.tenantId))
    .limit(1);
  const tenantName = tenantRow?.name ?? "—";

  const [prefsRow] = await db
    .select({
      phone: advisorPreferences.phone,
      website: advisorPreferences.website,
      reportLogoUrl: advisorPreferences.reportLogoUrl,
    })
    .from(advisorPreferences)
    .where(
      and(
        eq(advisorPreferences.tenantId, auth.tenantId),
        eq(advisorPreferences.userId, auth.userId)
      )
    )
    .limit(1);

  return (
    <AdvisorProfileView
      initial={{
        email,
        fullName,
        roleName: auth.roleName,
        tenantName,
        phone: prefsRow?.phone ?? "",
        website: prefsRow?.website ?? "",
        reportLogoUrl: prefsRow?.reportLogoUrl ?? null,
      }}
    />
  );
}
