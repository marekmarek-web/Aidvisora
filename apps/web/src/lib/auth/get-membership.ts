import "server-only";

import { db, memberships, roles, clientContacts, contacts, tenants, sql } from "db";
import { eq, and, asc } from "db";
import { cookies } from "next/headers";
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
 * B3.10 — cookie, ve které uživatel (nebo `/choose-tenant` page) uloží zvolený
 * tenant ID. Musí být HttpOnly není třeba (ne-sensitivní; tenant IDs jsou UUID),
 * ale nastavíme `SameSite=Lax` a `Secure` v produkci. Life je ~30 dní.
 */
export const PREFERRED_TENANT_COOKIE = "preferred_tenant_id";

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
    // B2.3: Multi-tenant safeguard — načteme všechny memberships (až 10 stačí;
    // nechceme bod záseku, ale ani se nám nepotkáme > 10). Vrátíme preferovaný
    // tenant (pokud uživatel má `preferred_tenant_id` cookie), jinak nejstarší.
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
      .limit(10);
  });
  if (rows.length === 0) return null;

  // B3.10 — pokud má user > 1 membership, honoruj `preferred_tenant_id` cookie
  // (nastavuje ji `/choose-tenant` page). Pokud cookie není nebo neodpovídá
  // žádnému membershipu, fallback na první podle `joinedAt`.
  let chosen = rows[0]!;
  if (rows.length > 1) {
    try {
      const jar = await cookies();
      const preferred = jar.get(PREFERRED_TENANT_COOKIE)?.value;
      if (preferred) {
        const match = rows.find((r) => r.tenantId === preferred);
        if (match) chosen = match;
      }
    } catch {
      // cookies() může selhat v kontextech bez request scope; silentně fallbackneme.
    }

    // eslint-disable-next-line no-console
    console.warn("[getMembership] multi-membership user", {
      userId,
      chosenTenantId: chosen.tenantId,
      totalMemberships: rows.length,
    });
    try {
      void import("@sentry/nextjs").then((Sentry) => {
        Sentry.captureMessage("multi_membership_user_detected", {
          level: "warning",
          tags: { area: "auth", type: "multi-membership" },
          extra: {
            userId,
            chosenTenantId: chosen.tenantId,
            totalMemberships: rows.length,
            tenantIds: rows.map((r) => r.tenantId),
          },
        });
      }).catch(() => {});
    } catch {
      // no-op
    }
  }

  return {
    membershipId: chosen.membershipId,
    tenantId: chosen.tenantId,
    roleId: chosen.roleId,
    roleName: chosen.roleName as RoleName,
    contactId: chosen.contactId ?? undefined,
  };
}

/**
 * B3.10 — vrátí všechny memberships uživatele (pro `/choose-tenant` page).
 * Bez preferred cookie selekce — vrací seznam v pořadí `joinedAt`.
 */
export async function listMembershipsForUser(userId: string): Promise<
  Array<MembershipResult & { tenantName: string | null }>
> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);
    const rows = await tx
      .select({
        membershipId: memberships.id,
        tenantId: memberships.tenantId,
        roleId: memberships.roleId,
        roleName: roles.name,
        contactId: clientContacts.contactId,
        tenantName: tenants.name,
      })
      .from(memberships)
      .innerJoin(roles, eq(memberships.roleId, roles.id))
      .leftJoin(tenants, eq(tenants.id, memberships.tenantId))
      .leftJoin(
        clientContacts,
        and(eq(memberships.tenantId, clientContacts.tenantId), eq(memberships.userId, clientContacts.userId))
      )
      .where(eq(memberships.userId, userId))
      .orderBy(asc(memberships.joinedAt))
      .limit(10);
    return rows.map((r) => ({
      membershipId: r.membershipId,
      tenantId: r.tenantId,
      roleId: r.roleId,
      roleName: r.roleName as RoleName,
      contactId: r.contactId ?? undefined,
      tenantName: r.tenantName ?? null,
    }));
  });
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
