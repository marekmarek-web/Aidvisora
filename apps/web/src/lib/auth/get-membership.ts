import "server-only";

import { db, memberships, roles, clientContacts, contacts, sql } from "db";
import { eq, and, asc } from "db";
import { withTenantContext } from "@/lib/db/with-tenant-context";
import type { RoleName } from "@/shared/rolePermissions";

export type { RoleName } from "@/shared/rolePermissions";

export type MembershipResult = {
  membershipId: string;
  tenantId: string;
  roleId: string;
  roleName: RoleName;
  contactId?: string | null;
};

/**
 * Bootstrap lookup klient↔tenant↔role.
 *
 * Běží PŘED `withTenantContext`, takže nastavuje jen `app.user_id` GUC (nikoli
 * `app.tenant_id`). WS-2 Batch 3 RLS policies na `memberships` / `roles` /
 * `client_contacts` přesně tento scénář akceptují — bez user_id + bez tenant_id
 * by po přepnutí runtime na `aidvisora_app` getMembership vrátila 0 řádků a
 * login flow by se zasekl.
 */
export async function getMembership(userId: string): Promise<MembershipResult | null> {
  const rows = await db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);
    return tx
      .select({
        membershipId: memberships.id,
        tenantId: memberships.tenantId,
        roleId: memberships.roleId,
        roleName: roles.name,
        contactId: clientContacts.contactId,
      })
      .from(memberships)
      .innerJoin(roles, eq(memberships.roleId, roles.id))
      .leftJoin(
        clientContacts,
        and(eq(memberships.tenantId, clientContacts.tenantId), eq(memberships.userId, clientContacts.userId))
      )
      .where(eq(memberships.userId, userId))
      .orderBy(asc(memberships.joinedAt))
      .limit(1);
  });
  const row = rows[0];
  if (!row) return null;
  return {
    membershipId: row.membershipId,
    tenantId: row.tenantId,
    roleId: row.roleId,
    roleName: row.roleName as RoleName,
    contactId: row.contactId ?? undefined,
  };
}

export async function requireMembership(userId: string) {
  const m = await getMembership(userId);
  if (!m) throw new Error("Unauthorized: no tenant membership");
  return m;
}

/** V demo režimu: vrátí první kontakt tenanta (pro zobrazení klientského portálu bez přihlášení). */
export async function getDemoClientContactId(tenantId: string): Promise<string | null> {
  const rows = await withTenantContext({ tenantId }, (tx) =>
    tx
      .select({ id: contacts.id })
      .from(contacts)
      .where(eq(contacts.tenantId, tenantId))
      .limit(1),
  );
  return rows[0]?.id ?? null;
}
