import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  listMembershipsForUser,
  PREFERRED_TENANT_COOKIE,
} from "@/lib/auth/get-membership";

/**
 * B3.10 — tenant picker pro uživatele s vícenásobným membershipem.
 *
 * Dřív `getMembership()` tiše vybrala nejstarší (asc joinedAt) a jen zalogovala
 * warning do Sentry. To je nebezpečné, protože:
 *   - při cross-tenant invite (typicky advisor + admin, nebo advisor u dvou
 *     podniků) uživatel viděl data „nesprávného" tenantu bez možnosti přepnout,
 *   - v extrémním případě šlo o data leak.
 *
 * Tato stránka načte všechny memberships, nechá uživatele vybrat a uloží
 * preferenci do cookie `preferred_tenant_id`. Server action níže pak jen
 * zapíše cookie a pošle redirect na `/dashboard`.
 */

export const dynamic = "force-dynamic";
export const metadata = { title: "Vyberte workspace | Aidvisora" };

async function setPreferredTenant(formData: FormData) {
  "use server";
  const tenantId = String(formData.get("tenantId") ?? "").trim();
  if (!tenantId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // Bezpečnostní kontrola: uživatel může zvolit jen tenant, ke kterému má
  // membership. Bez tohoto checku by curl uložil libovolné UUID do cookie
  // a později by jiná vrstva (např. RLS) musela problém zachytit.
  const memberships = await listMembershipsForUser(user.id);
  const allowed = memberships.some((m) => m.tenantId === tenantId);
  if (!allowed) {
    redirect("/choose-tenant");
  }

  const jar = await cookies();
  const isProd = process.env.NODE_ENV === "production";
  jar.set({
    name: PREFERRED_TENANT_COOKIE,
    value: tenantId,
    httpOnly: false,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/dashboard");
}

export default async function ChooseTenantPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const memberships = await listMembershipsForUser(user.id);

  if (memberships.length === 0) {
    return (
      <main className="mx-auto min-h-screen max-w-xl px-4 py-12">
        <h1 className="text-2xl font-bold">Nemáte přiřazený workspace</h1>
        <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">
          Váš účet nemá žádný aktivní membership. Kontaktujte administrátora svého workspace,
          aby vám přidal přístup.
        </p>
      </main>
    );
  }

  if (memberships.length === 1) {
    // Žádná volba — jeden tenant. Rovnou redirect.
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto min-h-screen max-w-xl px-4 py-12">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
        Vyberte workspace
      </h1>
      <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">
        Váš účet je členem více workspaceů. Zvolte ten, se kterým chcete pracovat.
        Volbu můžete kdykoli změnit v nastavení účtu.
      </p>

      <ul className="mt-8 space-y-3">
        {memberships.map((m) => (
          <li
            key={m.tenantId}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/40"
          >
            <form action={setPreferredTenant} className="flex items-center justify-between gap-4">
              <input type="hidden" name="tenantId" value={m.tenantId} />
              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  {m.tenantName ?? "(workspace bez názvu)"}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Role: {m.roleName}
                </div>
              </div>
              <button
                type="submit"
                className="min-h-[44px] rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Vybrat
              </button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
