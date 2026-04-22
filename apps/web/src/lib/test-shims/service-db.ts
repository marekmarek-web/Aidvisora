/** Vitest shim pro `@/lib/db/service-db`. Viz `with-tenant-context.ts`. */
import { db } from "db";

export type TenantContextDb = typeof db;

export const dbService = db;

export async function withServiceTenantContext<T>(
  _options: { tenantId: string; userId?: string | null },
  fn: (tx: TenantContextDb) => Promise<T>,
): Promise<T> {
  return fn(db);
}
