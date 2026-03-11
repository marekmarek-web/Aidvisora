"use server";

import { requireAuthInAction } from "@/lib/auth/require-auth";
import { db } from "db";
import { memberships, roles } from "db";
import { eq, asc } from "db";

export type TenantMemberRow = {
  membershipId: string;
  userId: string;
  roleName: string;
  joinedAt: Date;
};

/** List members of the current user's tenant (for Settings > Tým). */
export async function listTenantMembers(): Promise<TenantMemberRow[]> {
  const auth = await requireAuthInAction();
  const rows = await db
    .select({
      membershipId: memberships.id,
      userId: memberships.userId,
      roleName: roles.name,
      joinedAt: memberships.joinedAt,
    })
    .from(memberships)
    .innerJoin(roles, eq(memberships.roleId, roles.id))
    .where(eq(memberships.tenantId, auth.tenantId))
    .orderBy(asc(memberships.joinedAt));
  return rows.map((r) => ({
    membershipId: r.membershipId,
    userId: r.userId,
    roleName: r.roleName,
    joinedAt: r.joinedAt,
  }));
}
