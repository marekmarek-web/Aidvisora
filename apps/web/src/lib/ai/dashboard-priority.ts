import { db } from "db";
import {
  tasks,
  contacts,
  contracts,
  opportunities,
  opportunityStages,
  contractUploadReviews,
} from "db";
import { eq, and, isNull, sql, asc, desc } from "db";
import type {
  UrgentItem,
  UrgentItemSeverity,
  TaskDueItem,
  ClientNeedingAttention,
  SuggestedAction,
} from "./dashboard-types";

const PENDING_REVIEW_DAYS_OLD = 3;

function toSeverity(score: number): UrgentItemSeverity {
  if (score >= 0.75) return "high";
  if (score >= 0.45) return "medium";
  return "low";
}

/**
 * Compute priority/urgent items for the dashboard. Tenant-scoped.
 */
export async function computePriorityItems(tenantId: string): Promise<UrgentItem[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);
  const threeDaysAgo = new Date(today);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - PENDING_REVIEW_DAYS_OLD);
  const items: UrgentItem[] = [];

  // Overdue tasks – high
  const overdueRows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      dueDate: tasks.dueDate,
      contactFirstName: contacts.firstName,
      contactLastName: contacts.lastName,
    })
    .from(tasks)
    .leftJoin(contacts, eq(tasks.contactId, contacts.id))
    .where(
      and(
        eq(tasks.tenantId, tenantId),
        isNull(tasks.completedAt),
        sql`${tasks.dueDate}::date < ${todayStr}::date`
      )
    )
    .orderBy(asc(tasks.dueDate))
    .limit(20);
  for (const r of overdueRows) {
    const contactName =
      r.contactFirstName && r.contactLastName
        ? `${r.contactFirstName} ${r.contactLastName}`
        : null;
    items.push({
      type: "task",
      entityId: r.id,
      score: 1.0,
      severity: "high",
      title: r.title ?? "Úkol",
      description: `Po termínu${contactName ? ` · ${contactName}` : ""}`,
      recommendedAction: "Dokončit úkol",
      source: "tasks",
    });
  }

  // Due today tasks – high
  const dueTodayRows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      dueDate: tasks.dueDate,
      contactFirstName: contacts.firstName,
      contactLastName: contacts.lastName,
    })
    .from(tasks)
    .leftJoin(contacts, eq(tasks.contactId, contacts.id))
    .where(
      and(
        eq(tasks.tenantId, tenantId),
        isNull(tasks.completedAt),
        sql`${tasks.dueDate}::date = ${todayStr}::date`
      )
    )
    .orderBy(asc(tasks.dueDate))
    .limit(15);
  for (const r of dueTodayRows) {
    if (items.some((i) => i.type === "task" && i.entityId === r.id)) continue;
    const contactName =
      r.contactFirstName && r.contactLastName
        ? `${r.contactFirstName} ${r.contactLastName}`
        : null;
    items.push({
      type: "task",
      entityId: r.id,
      score: 0.85,
      severity: "high",
      title: r.title ?? "Úkol",
      description: `Dnes${contactName ? ` · ${contactName}` : ""}`,
      recommendedAction: "Zkontrolovat úkol",
      source: "tasks",
    });
  }

  // Pending contract reviews
  const reviewRows = await db
    .select({
      id: contractUploadReviews.id,
      fileName: contractUploadReviews.fileName,
      processingStatus: contractUploadReviews.processingStatus,
      confidence: contractUploadReviews.confidence,
      createdAt: contractUploadReviews.createdAt,
    })
    .from(contractUploadReviews)
    .where(
      and(
        eq(contractUploadReviews.tenantId, tenantId),
        eq(contractUploadReviews.reviewStatus, "pending")
      )
    )
    .orderBy(desc(contractUploadReviews.createdAt))
    .limit(20);
  for (const r of reviewRows) {
    const createdAt = r.createdAt ? new Date(r.createdAt) : null;
    const isOld = createdAt && createdAt < threeDaysAgo;
    const lowConfidence = r.confidence != null && r.confidence < 0.7;
    let score = 0.5;
    if (isOld && lowConfidence) score = 0.8;
    else if (isOld) score = 0.7;
    else if (lowConfidence) score = 0.65;
    items.push({
      type: "review",
      entityId: r.id,
      score,
      severity: toSeverity(score),
      title: r.fileName,
      description: `Smlouva čeká na kontrolu${lowConfidence ? " · nízká confidence" : ""}`,
      recommendedAction: "Otevřít review",
      source: "contract_upload_reviews",
    });
  }

  // Pipeline at risk
  const atRiskRows = await db
    .select({
      id: opportunities.id,
      title: opportunities.title,
      expectedCloseDate: opportunities.expectedCloseDate,
      contactFirstName: contacts.firstName,
      contactLastName: contacts.lastName,
    })
    .from(opportunities)
    .leftJoin(contacts, eq(opportunities.contactId, contacts.id))
    .where(
      and(
        eq(opportunities.tenantId, tenantId),
        isNull(opportunities.closedAt),
        sql`${opportunities.expectedCloseDate}::date < ${todayStr}::date`
      )
    )
    .orderBy(asc(opportunities.expectedCloseDate))
    .limit(10);
  for (const o of atRiskRows) {
    const contactName =
      o.contactFirstName && o.contactLastName
        ? `${o.contactFirstName} ${o.contactLastName}`
        : null;
    items.push({
      type: "opportunity",
      entityId: o.id,
      score: 0.6,
      severity: "medium",
      title: o.title ?? "Obchod",
      description: `Po plánovaném termínu uzavření${contactName ? ` · ${contactName}` : ""}`,
      recommendedAction: "Zkontrolovat obchod",
      source: "opportunities",
    });
  }

  // Service due (next 7 days)
  const in7 = new Date(today);
  in7.setDate(in7.getDate() + 7);
  const in7Str = in7.toISOString().slice(0, 10);
  const serviceRows = await db
    .select({
      id: contacts.id,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      nextServiceDue: contacts.nextServiceDue,
    })
    .from(contacts)
    .where(
      and(
        eq(contacts.tenantId, tenantId),
        sql`${contacts.nextServiceDue}::date >= ${todayStr}::date`,
        sql`${contacts.nextServiceDue}::date <= ${in7Str}::date`
      )
    )
    .orderBy(asc(contacts.nextServiceDue))
    .limit(5);
  for (const c of serviceRows) {
    const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || "Klient";
    items.push({
      type: "client",
      entityId: c.id,
      score: 0.45,
      severity: "medium",
      title: name,
      description: `Servis due ${c.nextServiceDue ?? ""}`,
      recommendedAction: "Kontaktovat klienta",
      source: "contacts",
    });
  }

  // Sort by score desc, then take top N
  items.sort((a, b) => b.score - a.score);
  return items.slice(0, 25);
}

/** Tasks due today and overdue for dashboard summary. */
export async function getTasksDueAndOverdue(tenantId: string): Promise<{
  overdueTasks: TaskDueItem[];
  tasksDueToday: TaskDueItem[];
}> {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [overdueRows, dueTodayRows] = await Promise.all([
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        dueDate: tasks.dueDate,
        contactFirstName: contacts.firstName,
        contactLastName: contacts.lastName,
      })
      .from(tasks)
      .leftJoin(contacts, eq(tasks.contactId, contacts.id))
      .where(
        and(
          eq(tasks.tenantId, tenantId),
          isNull(tasks.completedAt),
          sql`${tasks.dueDate}::date < ${todayStr}::date`
        )
      )
      .orderBy(asc(tasks.dueDate))
      .limit(20),
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        dueDate: tasks.dueDate,
        contactFirstName: contacts.firstName,
        contactLastName: contacts.lastName,
      })
      .from(tasks)
      .leftJoin(contacts, eq(tasks.contactId, contacts.id))
      .where(
        and(
          eq(tasks.tenantId, tenantId),
          isNull(tasks.completedAt),
          sql`${tasks.dueDate}::date = ${todayStr}::date`
        )
      )
      .orderBy(asc(tasks.dueDate))
      .limit(20),
  ]);
  const mapRow = (r: (typeof overdueRows)[0]): TaskDueItem => ({
    id: r.id,
    title: r.title ?? "Úkol",
    dueDate: r.dueDate ?? todayStr,
    contactName:
      r.contactFirstName && r.contactLastName
        ? `${r.contactFirstName} ${r.contactLastName}`
        : null,
  });
  return {
    overdueTasks: overdueRows.map(mapRow),
    tasksDueToday: dueTodayRows.map(mapRow),
  };
}

/** Clients needing attention (service due) for dashboard summary. */
export async function getClientsNeedingAttention(
  tenantId: string
): Promise<ClientNeedingAttention[]> {
  const todayStr = new Date().toISOString().slice(0, 10);
  const in7 = new Date();
  in7.setDate(in7.getDate() + 7);
  const in7Str = in7.toISOString().slice(0, 10);
  const rows = await db
    .select({
      id: contacts.id,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      nextServiceDue: contacts.nextServiceDue,
    })
    .from(contacts)
    .where(
      and(
        eq(contacts.tenantId, tenantId),
        sql`${contacts.nextServiceDue}::date >= ${todayStr}::date`,
        sql`${contacts.nextServiceDue}::date <= ${in7Str}::date`
      )
    )
    .orderBy(asc(contacts.nextServiceDue))
    .limit(10);
  return rows.map((c) => ({
    id: c.id,
    name: [c.firstName, c.lastName].filter(Boolean).join(" ") || "Klient",
    reason: "Servis due",
    detail: c.nextServiceDue ?? undefined,
  }));
}

/** Build suggested actions from urgent items for fallback / chat. */
export function buildSuggestedActionsFromUrgent(
  urgentItems: UrgentItem[]
): SuggestedAction[] {
  const seen = new Set<string>();
  const actions: SuggestedAction[] = [];
  for (const u of urgentItems.slice(0, 8)) {
    const key = `${u.type}:${u.entityId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (u.type === "review") {
      actions.push({
        type: "open_review",
        label: `Otevřít review: ${u.title.slice(0, 40)}`,
        payload: { reviewId: u.entityId },
      });
    } else if (u.type === "client") {
      actions.push({
        type: "view_client",
        label: `Klient: ${u.title}`,
        payload: { clientId: u.entityId },
      });
      actions.push({
        type: "draft_email",
        label: `Návrh e-mailu: ${u.title}`,
        payload: { clientId: u.entityId },
      });
    } else if (u.type === "task") {
      actions.push({
        type: "open_task",
        label: u.title.slice(0, 50),
        payload: { taskId: u.entityId },
      });
    }
  }
  return actions.slice(0, 10);
}
