"use server";

import { withAuthContext } from "@/lib/auth/with-auth-context";
import { hasPermission } from "@/lib/auth/permissions";
import {
  emailAutomationRules,
  emailAutomationRuns,
  emailTemplates,
  eq,
  and,
  desc,
  sql,
} from "db";
import { isValidSegmentFilter, type SegmentFilter } from "@/lib/email/segment-filter";

export type AutomationTriggerType =
  | "birthday"
  | "inactive_client"
  | "year_in_review"
  | "contract_anniversary"
  | "service_due"
  | "proposal_accepted"
  | "contract_activated"
  | "analysis_completed"
  | "referral_ask_after_proposal";

export type AutomationRuleRow = {
  id: string;
  name: string;
  description: string | null;
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  segmentFilter: SegmentFilter | null;
  templateId: string | null;
  templateName: string | null;
  scheduleOffsetDays: number;
  sendHour: number;
  isActive: boolean;
  lastRunAt: Date | null;
  lastMatchedCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export async function listAutomationRules(): Promise<AutomationRuleRow[]> {
  return withAuthContext(async (auth, tx) => {
    if (!hasPermission(auth.roleName, "contacts:read")) {
      throw new Error("Nemáte oprávnění.");
    }
    const rows = await tx
      .select({
        id: emailAutomationRules.id,
        name: emailAutomationRules.name,
        description: emailAutomationRules.description,
        triggerType: emailAutomationRules.triggerType,
        triggerConfig: emailAutomationRules.triggerConfig,
        segmentFilter: emailAutomationRules.segmentFilter,
        templateId: emailAutomationRules.templateId,
        templateName: emailTemplates.name,
        scheduleOffsetDays: emailAutomationRules.scheduleOffsetDays,
        sendHour: emailAutomationRules.sendHour,
        isActive: emailAutomationRules.isActive,
        lastRunAt: emailAutomationRules.lastRunAt,
        lastMatchedCount: emailAutomationRules.lastMatchedCount,
        createdAt: emailAutomationRules.createdAt,
        updatedAt: emailAutomationRules.updatedAt,
      })
      .from(emailAutomationRules)
      .leftJoin(emailTemplates, eq(emailTemplates.id, emailAutomationRules.templateId))
      .where(eq(emailAutomationRules.tenantId, auth.tenantId))
      .orderBy(desc(emailAutomationRules.updatedAt));

    return rows.map((r) => ({
      ...r,
      triggerConfig: (r.triggerConfig ?? {}) as Record<string, unknown>,
      segmentFilter: (r.segmentFilter as SegmentFilter | null) ?? null,
    }));
  });
}

export type UpsertAutomationInput = {
  id?: string;
  name: string;
  description?: string | null;
  triggerType: AutomationTriggerType;
  triggerConfig?: Record<string, unknown>;
  segmentFilter?: SegmentFilter | null;
  templateId: string;
  scheduleOffsetDays?: number;
  sendHour?: number;
  isActive?: boolean;
};

export async function upsertAutomationRule(input: UpsertAutomationInput): Promise<{ id: string }> {
  return withAuthContext(async (auth, tx) => {
    if (!hasPermission(auth.roleName, "contacts:write")) {
      throw new Error("Nemáte oprávnění.");
    }
    const name = input.name.trim();
    if (!name) throw new Error("Název pravidla je povinný.");
    if (!input.templateId) throw new Error("Vyberte šablonu.");

    const segmentFilter =
      input.segmentFilter && isValidSegmentFilter(input.segmentFilter)
        ? input.segmentFilter
        : null;

    const payload = {
      tenantId: auth.tenantId,
      createdByUserId: auth.userId,
      name,
      description: input.description?.trim() || null,
      triggerType: input.triggerType,
      triggerConfig: (input.triggerConfig ?? {}) as Record<string, unknown>,
      segmentFilter: segmentFilter as unknown as Record<string, unknown> | null,
      templateId: input.templateId,
      scheduleOffsetDays: Math.max(-30, Math.min(30, input.scheduleOffsetDays ?? 0)),
      sendHour: Math.max(0, Math.min(23, input.sendHour ?? 9)),
      isActive: input.isActive ?? false,
      updatedAt: new Date(),
    };

    if (input.id) {
      const [existing] = await tx
        .select({ id: emailAutomationRules.id })
        .from(emailAutomationRules)
        .where(
          and(
            eq(emailAutomationRules.id, input.id),
            eq(emailAutomationRules.tenantId, auth.tenantId),
          ),
        )
        .limit(1);
      if (!existing) throw new Error("Pravidlo nebylo nalezeno.");
      await tx
        .update(emailAutomationRules)
        .set(payload)
        .where(eq(emailAutomationRules.id, input.id));
      return { id: input.id };
    }

    const [created] = await tx
      .insert(emailAutomationRules)
      .values(payload)
      .returning({ id: emailAutomationRules.id });
    return { id: created!.id };
  });
}

export async function toggleAutomationRule(id: string, isActive: boolean): Promise<{ ok: true }> {
  return withAuthContext(async (auth, tx) => {
    if (!hasPermission(auth.roleName, "contacts:write")) {
      throw new Error("Nemáte oprávnění.");
    }
    await tx
      .update(emailAutomationRules)
      .set({ isActive, updatedAt: new Date() })
      .where(
        and(eq(emailAutomationRules.id, id), eq(emailAutomationRules.tenantId, auth.tenantId)),
      );
    return { ok: true };
  });
}

export async function deleteAutomationRule(id: string): Promise<{ ok: true }> {
  return withAuthContext(async (auth, tx) => {
    if (!hasPermission(auth.roleName, "contacts:write")) {
      throw new Error("Nemáte oprávnění.");
    }
    await tx
      .delete(emailAutomationRules)
      .where(
        and(eq(emailAutomationRules.id, id), eq(emailAutomationRules.tenantId, auth.tenantId)),
      );
    return { ok: true };
  });
}

export type AutomationStatsRow = {
  ruleId: string;
  name: string;
  last30Runs: number;
  last30Queued: number;
  last30Skipped: number;
  last30Failed: number;
};

export async function getAutomationStats(): Promise<AutomationStatsRow[]> {
  return withAuthContext(async (auth, tx) => {
    if (!hasPermission(auth.roleName, "contacts:read")) return [];
    const rows = await tx
      .select({
        ruleId: emailAutomationRules.id,
        name: emailAutomationRules.name,
        last30Runs: sql<number>`count(${emailAutomationRuns.id})::int`,
        last30Queued: sql<number>`count(*) filter (where ${emailAutomationRuns.status} = 'queued')::int`,
        last30Skipped: sql<number>`count(*) filter (where ${emailAutomationRuns.status} = 'skipped')::int`,
        last30Failed: sql<number>`count(*) filter (where ${emailAutomationRuns.status} = 'failed')::int`,
      })
      .from(emailAutomationRules)
      .leftJoin(
        emailAutomationRuns,
        and(
          eq(emailAutomationRuns.ruleId, emailAutomationRules.id),
          sql`${emailAutomationRuns.runAt} >= now() - interval '30 days'`,
        ),
      )
      .where(eq(emailAutomationRules.tenantId, auth.tenantId))
      .groupBy(emailAutomationRules.id, emailAutomationRules.name);
    return rows;
  });
}
