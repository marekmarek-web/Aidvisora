import "server-only";

import {
  requireAuthInAction,
  requireClientZoneAuth,
  type AuthContext,
} from "@/lib/auth/require-auth";
import { withTenantContext, type TenantContextDb } from "@/lib/db/with-tenant-context";

/**
 * Canonical wrapper: resolve advisor/staff auth a spustí callback v transakci,
 * kde jsou nastavené GUC `app.tenant_id` + `app.user_id`. Tenant-scoped čtení /
 * zápisy se musí dělat přes `tx` — globální `db` by po přepnutí runtime na
 * `aidvisora_app` (non-bypass, FORCE RLS) vrátilo 0 řádků nebo selhalo při WITH
 * CHECK.
 *
 * Používej ve všech server actions / route handlerech /
 * server komponentách, které dělají tenant-scoped DB práci po přihlášení.
 *
 * Poznámka: `requireAuthInAction` dál sama redirectuje na `/register/complete`
 * pro uživatele bez membership — chování se nemění.
 */
export async function withAuthContext<T>(
  fn: (auth: AuthContext, tx: TenantContextDb) => Promise<T>,
): Promise<T> {
  const auth = await requireAuthInAction();
  return withTenantContext(
    { tenantId: auth.tenantId, userId: auth.userId },
    (tx) => fn(auth, tx),
  );
}

/**
 * Varianta pro klientský portál — projde guard `requireClientZoneAuth`
 * (včetně pending password flow a vynucení role `Client`), pak nastaví GUCs.
 */
export async function withClientAuthContext<T>(
  fn: (auth: AuthContext, tx: TenantContextDb) => Promise<T>,
): Promise<T> {
  const auth = await requireClientZoneAuth();
  return withTenantContext(
    { tenantId: auth.tenantId, userId: auth.userId },
    (tx) => fn(auth, tx),
  );
}

/**
 * Varianta, když už máme vyřešený AuthContext jinde (např. bundled server actions,
 * cron joby, interní helpery) a chceme jen nastavit tenant GUCs kolem konkrétního
 * query bloku. `userId` je volitelný — v cron / interních helperech nemusí být
 * nutně znám, ale tenant musí být vždy ověřený.
 */
export async function withTenantContextFromAuth<T>(
  auth: { tenantId: string; userId?: string | null } | Pick<AuthContext, "tenantId" | "userId">,
  fn: (tx: TenantContextDb) => Promise<T>,
): Promise<T> {
  return withTenantContext(
    { tenantId: auth.tenantId, userId: auth.userId ?? null },
    fn,
  );
}
