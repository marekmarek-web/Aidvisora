import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/lib/db-client";

/**
 * Runtime vrstva tenant izolace pro Drizzle / Postgres-js.
 *
 * Nastaví GUC `app.tenant_id` lokálně v transakci (přes `set_config(..., true)`),
 * takže případné RLS policy tvaru
 *
 *   tenant_id = current_setting('app.tenant_id', true)::uuid
 *
 * pracují se správným tenantem. Setting je `is_local = true`, takže se resetuje
 * na commit/rollback a je bezpečné ho používat v pgbouncer transaction pooling režimu
 * (viz `apps/web/src/lib/db-client.ts`, `pgbouncer=true`, `prepare: false`).
 *
 * **Interní bezpečnostní vrstva, ne doporučení klientovi.**
 *
 * UPOZORNĚNÍ:
 * - Runtime DB user je aktuálně Supabase `postgres` role → má BYPASSRLS.
 *   Tento helper je proto sám o sobě „no-op z pohledu vymáhání“, dokud:
 *     a) nepřepneme runtime na non-superuser roli, nebo
 *     b) na chráněné tabulky nenasadíme `ALTER TABLE ... FORCE ROW LEVEL SECURITY`.
 *   Helper je nicméně nutný základ — bez něj nelze RLS vůbec zapnout bez výpadku.
 * - `set_config('app.tenant_id', ..., true)` nepoužívá `SET LOCAL` syntaxi (která
 *   neakceptuje bind parameters) → bez rizika SQL injection.
 */

export type TenantContextDb = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type WithTenantContextOptions = {
  /** Tenant UUID (musí být validní UUID; helper ověří hrubý formát). */
  tenantId: string;
  /** Volitelný user id, uložený do GUC `app.user_id` pro audit triggery. */
  userId?: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(value: string, fieldName: string): void {
  if (!UUID_RE.test(value)) {
    throw new Error(`withTenantContext: ${fieldName} není validní UUID (${JSON.stringify(value)}).`);
  }
}

/**
 * Spustí callback v transakci s nastavenými tenant GUCs.
 *
 * Používej všude, kde se z budoucího ne-superuser runtime odesílá query
 * na tenant-izolovanou tabulku. Tenant_id musí pocházet z ověřeného zdroje
 * (membership / JWT), nikdy z uživatelského vstupu přímo.
 */
export async function withTenantContext<T>(
  options: WithTenantContextOptions,
  fn: (tx: TenantContextDb) => Promise<T>
): Promise<T> {
  assertUuid(options.tenantId, "tenantId");
  const userId = options.userId ?? null;
  if (userId !== null && typeof userId !== "string") {
    throw new Error("withTenantContext: userId musí být string nebo null.");
  }

  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${options.tenantId}, true)`);
    if (userId) {
      await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);
    }
    return fn(tx);
  });
}

/**
 * Bootstrap varianta — nastaví pouze `app.user_id`, bez `app.tenant_id`.
 *
 * Použití: `getMembership()` a další lookupy, které se dějí ještě PŘED vyřešením
 * tenantu ze session. Bootstrap RLS policies (memberships/user_profiles/roles/
 * tenants/client_contacts) akceptují toto nastavení místo tenant GUC.
 *
 * Po swapu runtime na `aidvisora_app` bez tohoto helperu by RLS lookup pro
 * ne-auth.uid() userId (Supabase auth v Drizzle runtime NEmá `auth.uid()`)
 * vracela 0 řádků a login flow by se zasekl na výběru tenantu.
 */
export async function withUserContext<T>(
  userId: string,
  fn: (tx: TenantContextDb) => Promise<T>
): Promise<T> {
  if (typeof userId !== "string" || userId.length === 0) {
    throw new Error("withUserContext: userId musí být neprázdný string.");
  }
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);
    return fn(tx);
  });
}

/**
 * Varianta, která čte aktuální hodnotu GUC `app.tenant_id` (vrací null, pokud není nastaveno).
 * Určeno pro diagnostiku v logging / audit vrstvě.
 */
export async function readTenantContext(tx: TenantContextDb): Promise<string | null> {
  const rows = (await tx.execute(sql`select current_setting('app.tenant_id', true) as tenant_id`)) as unknown as Array<{
    tenant_id: string | null;
  }>;
  const value = rows?.[0]?.tenant_id ?? null;
  return value && value.length > 0 ? value : null;
}
