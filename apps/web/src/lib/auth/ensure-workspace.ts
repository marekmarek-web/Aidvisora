import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/auth/get-membership";
import { perfLog } from "@/lib/perf-log";
import { withUserContext } from "@/lib/db/with-tenant-context";
import { sql } from "drizzle-orm";
import { DEFAULT_TRIAL_PLAN, getTrialDurationDays } from "@/lib/billing/plan-catalog";

export type EnsureMembershipResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string; redirectTo?: string };

function mapProvisionError(msg: string): string {
  if (msg.includes("relation") && msg.includes("does not exist")) {
    return "V databázi chybí tabulky. V repozitáři spusť: pnpm db:apply-schema (s DATABASE_URL na tento Supabase projekt).";
  }
  if (
    msg.includes("function public.provision_workspace_v1") ||
    msg.includes("function provision_workspace_v1")
  ) {
    return "Bootstrap funkce chybí. Spusť migraci rls-m8-bootstrap-provision-and-gaps.sql na příslušném Supabase projektu.";
  }
  if (msg.includes("connection") || msg.includes("ECONNREFUSED") || msg.includes("timeout")) {
    return "Nepodařilo se připojit k databázi. Zkontrolujte DATABASE_URL na Vercelu a že Supabase projekt běží.";
  }
  if (msg.includes("authentication") || msg.includes("password")) {
    return "Chyba přihlášení k databázi. Zkontrolujte heslo v DATABASE_URL na Vercelu.";
  }
  if (msg.includes("SUPABASE") || msg.includes("supabase") || msg.includes("NEXT_PUBLIC")) {
    return "Chybí nebo je špatně nastavená proměnná Supabase (NEXT_PUBLIC_SUPABASE_URL a anon nebo publishable klíč).";
  }
  if (msg.includes("DATABASE_URL")) {
    return "Na Vercelu v Environment Variables přidej DATABASE_URL (celý connection string z Supabase → Database).";
  }
  if (msg.includes("MaxClients") || msg.includes("max clients") || msg.toLowerCase().includes("pool")) {
    return "Server je momentálně přetížen. Zkuste to za minutu znovu.";
  }
  return msg || "Nepodařilo se dokončit registraci.";
}

/**
 * Po prvním přihlášení vytvoří tenant, role, membership a výchozí pipeline fáze.
 *
 * Implementační poznámka (WS-2 Batch M1-A):
 * - Runtime po cutoveru poběží pod `aidvisora_app` (NOBYPASSRLS). Přímé INSERTy
 *   do `tenants`/`roles`/`memberships`/`opportunity_stages` bez aktivního tenant
 *   GUC by narazily na RLS WITH CHECK (u `tenants` navíc není žádný scope, na
 *   který se dá před prvním membership napojit — klasický chicken-and-egg).
 * - Celý bootstrap je proto delegován do SECURITY DEFINER funkce
 *   `public.provision_workspace_v1(...)`, která běží pod ownerem (BYPASSRLS
 *   implicitně uvnitř těla), atomicky vytvoří všechny řádky a vrátí
 *   `{ tenant_id, slug }`. Volajícímu stačí `withUserContext(userId)` pro
 *   auditní logiku (`current_setting('app.user_id')`).
 * - Funkce je definována v migraci
 *   `packages/db/migrations/rls-m8-bootstrap-provision-and-gaps.sql`
 *   (viz todo `m1-sql-gap-migration`).
 */
export async function provisionWorkspaceIfNeeded(): Promise<EnsureMembershipResult> {
  const t0 = Date.now();
  try {
    let supabase;
    try {
      supabase = await createClient();
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      perfLog("ensureMembership", t0);
      return { ok: false, error: m || "Chyba připojení k Supabase." };
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      perfLog("ensureMembership", t0);
      return { ok: false, error: "Nejprve se přihlaste.", redirectTo: "/" };
    }
    const existing = await getMembership(user.id);
    if (existing) {
      const redirectTo = existing.roleName === "Client" ? "/client" : "/portal/today";
      perfLog("ensureMembership", t0);
      return { ok: true, redirectTo };
    }

    const email = user.email ?? "";
    const slugBase =
      email.replace(/@.*/, "").replace(/[^a-z0-9]/gi, "-").toLowerCase().slice(0, 20) || "workspace";
    const slug = slugBase + "-" + Math.random().toString(36).slice(2, 8);

    const trialDays = getTrialDurationDays();

    await withUserContext(user.id, async (tx) => {
      await tx.execute(sql`
        select public.provision_workspace_v1(
          ${user.id}::uuid,
          ${email}::text,
          ${slug}::text,
          ${DEFAULT_TRIAL_PLAN}::text,
          ${trialDays}::int
        )
      `);
    });

    perfLog("ensureMembership", t0);
    return { ok: true, redirectTo: "/portal/today" };
  } catch (e) {
    perfLog("ensureMembership", t0);
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: mapProvisionError(msg) };
  }
}
