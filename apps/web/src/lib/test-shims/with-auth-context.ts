/** Vitest shim pro `@/lib/auth/with-auth-context`. Viz `with-tenant-context.ts`. */
import { db } from "db";

export type AuthContext = {
  tenantId: string;
  userId: string;
  roleName: string;
  contactId?: string | null;
};

export type TenantContextDb = typeof db;

export async function withAuthContext<T>(
  fn: (ctx: { auth: AuthContext; tx: TenantContextDb }) => Promise<T>,
): Promise<T> {
  const auth: AuthContext = {
    tenantId: process.env.TEST_TENANT_ID ?? "00000000-0000-0000-0000-000000000001",
    userId: process.env.TEST_USER_ID ?? "user_test",
    roleName: "Admin",
  };
  return fn({ auth, tx: db });
}

export async function withTenantContextFromAuth<T>(
  _auth: AuthContext,
  fn: (tx: TenantContextDb) => Promise<T>,
): Promise<T> {
  return fn(db);
}

export async function withClientAuthContext<T>(
  fn: (ctx: { auth: AuthContext; tx: TenantContextDb }) => Promise<T>,
): Promise<T> {
  const auth: AuthContext = {
    tenantId: process.env.TEST_TENANT_ID ?? "00000000-0000-0000-0000-000000000001",
    userId: process.env.TEST_USER_ID ?? "user_test",
    roleName: "Client",
    contactId: process.env.TEST_CONTACT_ID ?? "00000000-0000-0000-0000-000000000aaa",
  };
  return fn({ auth, tx: db });
}
