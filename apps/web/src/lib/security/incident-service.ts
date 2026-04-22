/**
 * Incident management service (Plan 9C.2).
 * Wires the incidentLogs DB schema with typed CRUD operations,
 * status transitions, and resolution tracking.
 */

import { incidentLogs, eq, and, desc } from "db";

import { withTenantContext } from "@/lib/db/with-tenant-context";

export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type IncidentStatus = "open" | "investigating" | "mitigated" | "resolved" | "closed";

export type CreateIncidentParams = {
  tenantId: string;
  title: string;
  description?: string;
  severity: IncidentSeverity;
  reportedBy: string;
  meta?: Record<string, unknown>;
};

export type IncidentRow = {
  id: string;
  tenantId: string;
  title: string;
  description: string | null;
  severity: IncidentSeverity;
  status: IncidentStatus;
  reportedBy: string;
  reportedAt: string;
  resolvedAt: string | null;
  meta: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

const VALID_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  open: ["investigating", "mitigated", "resolved", "closed"],
  investigating: ["mitigated", "resolved", "closed"],
  mitigated: ["resolved", "closed", "investigating"],
  resolved: ["closed"],
  closed: [],
};

export function isValidTransition(from: IncidentStatus, to: IncidentStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export async function createIncident(params: CreateIncidentParams): Promise<IncidentRow> {
  return withTenantContext({ tenantId: params.tenantId, userId: params.reportedBy }, async (tx) => {
    const [row] = await tx
      .insert(incidentLogs)
      .values({
        tenantId: params.tenantId,
        title: params.title,
        description: params.description ?? null,
        severity: params.severity,
        status: "open",
        reportedBy: params.reportedBy,
        meta: params.meta ?? {},
      })
      .returning();

    return mapRow(row);
  });
}

export async function getIncident(tenantId: string, incidentId: string): Promise<IncidentRow | null> {
  return withTenantContext({ tenantId }, async (tx) => {
    const [row] = await tx
      .select()
      .from(incidentLogs)
      .where(and(eq(incidentLogs.tenantId, tenantId), eq(incidentLogs.id, incidentId)))
      .limit(1);

    return row ? mapRow(row) : null;
  });
}

export async function updateIncidentStatus(
  tenantId: string,
  incidentId: string,
  newStatus: IncidentStatus,
  options?: { meta?: Record<string, unknown> }
): Promise<IncidentRow> {
  return withTenantContext({ tenantId }, async (tx) => {
    const [existingRaw] = await tx
      .select()
      .from(incidentLogs)
      .where(and(eq(incidentLogs.tenantId, tenantId), eq(incidentLogs.id, incidentId)))
      .limit(1);
    if (!existingRaw) throw new Error(`Incident ${incidentId} not found`);
    const existing = mapRow(existingRaw);

    if (!isValidTransition(existing.status, newStatus)) {
      throw new Error(
        `Invalid status transition: ${existing.status} -> ${newStatus} for incident ${incidentId}`
      );
    }

    const [row] = await tx
      .update(incidentLogs)
      .set({
        status: newStatus,
        updatedAt: new Date(),
        meta: options?.meta ? { ...existing.meta, ...options.meta } : existing.meta,
      })
      .where(and(eq(incidentLogs.tenantId, tenantId), eq(incidentLogs.id, incidentId)))
      .returning();

    return mapRow(row);
  });
}

export async function resolveIncident(
  tenantId: string,
  incidentId: string,
  resolution?: string
): Promise<IncidentRow> {
  return withTenantContext({ tenantId }, async (tx) => {
    const [existingRaw] = await tx
      .select()
      .from(incidentLogs)
      .where(and(eq(incidentLogs.tenantId, tenantId), eq(incidentLogs.id, incidentId)))
      .limit(1);
    if (!existingRaw) throw new Error(`Incident ${incidentId} not found`);
    const existing = mapRow(existingRaw);

    if (!isValidTransition(existing.status, "resolved")) {
      throw new Error(`Cannot resolve incident in status ${existing.status}`);
    }

    const [row] = await tx
      .update(incidentLogs)
      .set({
        status: "resolved",
        resolvedAt: new Date(),
        updatedAt: new Date(),
        meta: resolution ? { ...existing.meta, resolution } : existing.meta,
      })
      .where(and(eq(incidentLogs.tenantId, tenantId), eq(incidentLogs.id, incidentId)))
      .returning();

    return mapRow(row);
  });
}

export async function listIncidents(
  tenantId: string,
  options: {
    status?: IncidentStatus | IncidentStatus[];
    severity?: IncidentSeverity;
    limit?: number;
  } = {}
): Promise<IncidentRow[]> {
  const { limit = 50 } = options;

  const conditions = [eq(incidentLogs.tenantId, tenantId)];
  if (options.severity) {
    conditions.push(eq(incidentLogs.severity, options.severity));
  }
  if (options.status) {
    const statuses = Array.isArray(options.status) ? options.status : [options.status];
    if (statuses.length === 1) {
      conditions.push(eq(incidentLogs.status, statuses[0]));
    }
  }

  return withTenantContext({ tenantId }, async (tx) => {
    const rows = await tx
      .select()
      .from(incidentLogs)
      .where(and(...conditions))
      .orderBy(desc(incidentLogs.reportedAt))
      .limit(limit);

    return rows.map(mapRow);
  });
}

function mapRow(row: typeof incidentLogs.$inferSelect): IncidentRow {
  return {
    id: row.id,
    tenantId: row.tenantId,
    title: row.title,
    description: row.description ?? null,
    severity: row.severity as IncidentSeverity,
    status: row.status as IncidentStatus,
    reportedBy: row.reportedBy,
    reportedAt: row.reportedAt ? row.reportedAt.toISOString() : new Date().toISOString(),
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
    meta: (row.meta ?? {}) as Record<string, unknown>,
    createdAt: row.createdAt ? row.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : new Date().toISOString(),
  };
}
