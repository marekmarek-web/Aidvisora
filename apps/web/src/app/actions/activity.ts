"use server";

import { requireAuthInAction } from "@/lib/auth/require-auth";
import { db, activityLog, eq, and, desc } from "db";

// Monorepo: schema from db package can type-conflict with db client's drizzle instance at type-check
const _activityLog = activityLog as any;

export type ActivityRow = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  meta: Record<string, unknown> | null;
  createdAt: Date;
};

export async function logActivity(
  entityType: string,
  entityId: string,
  action: string,
  meta?: Record<string, unknown>,
) {
  const auth = await requireAuthInAction();
  await db.insert(_activityLog).values({
    tenantId: auth.tenantId,
    userId: auth.userId,
    entityType,
    entityId,
    action,
    meta: (meta ?? null) as Record<string, unknown>,
  });
}

export async function getActivityForEntity(
  entityType: string,
  entityId: string,
): Promise<ActivityRow[]> {
  const auth = await requireAuthInAction();
  const rows = await db
    .select({
      id: _activityLog.id,
      entityType: _activityLog.entityType,
      entityId: _activityLog.entityId,
      action: _activityLog.action,
      meta: _activityLog.meta,
      createdAt: _activityLog.createdAt,
    })
    .from(_activityLog)
    .where(
      and(
        eq(_activityLog.tenantId, auth.tenantId),
        eq(_activityLog.entityType, entityType),
        eq(_activityLog.entityId, entityId),
      ) as any,
    )
    .orderBy(desc(_activityLog.createdAt) as any)
    .limit(50);
  return rows as ActivityRow[];
}

export async function getActivityForContact(
  contactId: string,
): Promise<ActivityRow[]> {
  const auth = await requireAuthInAction();
  const rows = await db
    .select({
      id: _activityLog.id,
      entityType: _activityLog.entityType,
      entityId: _activityLog.entityId,
      action: _activityLog.action,
      meta: _activityLog.meta,
      createdAt: _activityLog.createdAt,
    })
    .from(_activityLog)
    .where(
      and(
        eq(_activityLog.tenantId, auth.tenantId),
        eq(_activityLog.entityType, "contact"),
        eq(_activityLog.entityId, contactId),
      ) as any,
    )
    .orderBy(desc(_activityLog.createdAt) as any)
    .limit(50);
  return rows as ActivityRow[];
}

export async function getRecentActivity(
  limit: number = 10,
): Promise<ActivityRow[]> {
  const auth = await requireAuthInAction();
  const rows = await db
    .select({
      id: _activityLog.id,
      entityType: _activityLog.entityType,
      entityId: _activityLog.entityId,
      action: _activityLog.action,
      meta: _activityLog.meta,
      createdAt: _activityLog.createdAt,
    })
    .from(_activityLog)
    .where(eq(_activityLog.tenantId, auth.tenantId) as any)
    .orderBy(desc(_activityLog.createdAt) as any)
    .limit(limit);
  return rows as ActivityRow[];
}
