/**
 * Vitest shim pro `@/lib/db/with-tenant-context`.
 *
 * Důvod: Refaktoring M4 (WS-2 Batch 6) všechny tenant-scoped helpery obalil
 * do `withTenantContext{From,User,ServiceTenant}Context(...)` wrapperů, které
 * interně dělají `db.transaction(async (tx) => ...)`. Unit testy předtím
 * mockovaly `db` (přes vitest alias `db` → `src/lib/db.ts`) a ověřovaly
 * `db.select/insert/update/delete` přímo.
 *
 * Kdyby wrapper použil skutečný `db-client` (náš real Postgres-js pool) uvnitř
 * testu, Drizzle by dostal cached schema objekty z mocku — z toho pak recurze
 * v `orderSelectedFields` nebo `Maximum call stack size exceeded`.
 *
 * Řešení: v Vitest aliasu (`vitest.config.ts`) přesměrujeme import
 * `@/lib/db/with-tenant-context` na tento shim. Každý wrapper jen předá
 * mocked `db` jako `tx` do callbacku — tests dostanou stejný mock, jaký už
 * očekávají z `vi.mock("db", ...)`.
 *
 * Production runtime tenhle shim NEpoužívá — vitest alias ho přidává jen
 * v test env (`vitest.config.ts.resolve.alias`).
 */

import { db } from "db";

export type TenantContextDb = typeof db;

export type WithTenantContextOptions = {
  tenantId: string;
  userId?: string | null;
};

export async function withTenantContext<T>(
  _options: WithTenantContextOptions,
  fn: (tx: TenantContextDb) => Promise<T>,
): Promise<T> {
  return fn(db);
}

export async function withUserContext<T>(
  _userId: string,
  fn: (tx: TenantContextDb) => Promise<T>,
): Promise<T> {
  return fn(db);
}

export async function getCurrentTenantIdFromGuc(): Promise<string | null> {
  return null;
}

export async function getCurrentUserIdFromGuc(): Promise<string | null> {
  return null;
}
