import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/auth/get-membership";
import { db, tenants, eq } from "db";
import { withTenantContext } from "@/lib/db/with-tenant-context";
import { AccountDeletionCard } from "./AccountDeletionCard";

export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/prihlaseni");

  const membership = await getMembership(user.id);

  let tenantName: string | null = null;
  if (membership) {
    const rows = await withTenantContext(
      { tenantId: membership.tenantId, userId: user.id },
      (tx) =>
        tx
          .select({ name: tenants.name })
          .from(tenants)
          .where(eq(tenants.id, membership.tenantId))
          .limit(1),
    );
    tenantName = rows[0]?.name ?? null;
  }

  return (
    <div className="mx-auto w-full max-w-[900px] space-y-6 p-4 md:p-6">
      <div>
        <Link
          href="/portal/today"
          className="text-xs font-bold text-[color:var(--wp-text-tertiary)] hover:text-[color:var(--wp-text)]"
        >
          ← Zpět do portálu
        </Link>
        <h1 className="mt-2 text-2xl font-black text-[color:var(--wp-text)]">
          Nastavení účtu
        </h1>
        <p className="mt-1 text-sm text-[color:var(--wp-text-secondary)]">
          Přehled přihlášeného uživatele a správa účtu.
        </p>
      </div>

      <section className="rounded-2xl border border-[color:var(--wp-surface-card-border)] bg-white p-5 shadow-sm">
        <h2 className="text-sm font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">
          Profil
        </h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-bold uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">
              E-mail
            </dt>
            <dd className="mt-1 font-bold text-[color:var(--wp-text)]">
              {user.email ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">
              Workspace
            </dt>
            <dd className="mt-1 font-bold text-[color:var(--wp-text)]">
              {tenantName ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">
              Role
            </dt>
            <dd className="mt-1 font-bold text-[color:var(--wp-text)]">
              {membership?.roleName ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">
              ID uživatele
            </dt>
            <dd className="mt-1 break-all font-mono text-xs text-[color:var(--wp-text-secondary)]">
              {user.id}
            </dd>
          </div>
        </dl>
      </section>

      <AccountDeletionCard
        isSoleAdmin={membership?.roleName === "Admin"}
      />
    </div>
  );
}
