/**
 * CRM write operations for the advisor AI assistant (tenant-scoped, permission-checked).
 */

import { createHash } from "crypto";
import { db, opportunities, opportunityStages, tasks, contacts, eq, and, sql, asc } from "db";
import { hasPermission, type RoleName } from "@/shared/rolePermissions";
import { logAudit } from "@/lib/audit";
import type { AssistantIntent } from "./assistant-intent";
import { computeNextTuesdayDatePrague } from "./assistant-intent";

export type AssistantCrmWriteInput = {
  tenantId: string;
  userId: string;
  roleName: RoleName;
  contactId: string;
  intent: AssistantIntent;
  now?: Date;
};

export type AssistantCrmWriteOk = {
  ok: true;
  dealId: string;
  taskId: string;
  idempotencyKey: string;
  dueDate: string;
  payloadHash: string;
};

export type AssistantCrmWriteErr = {
  ok: false;
  error: string;
  idempotencyKey: string;
};

export type AssistantCrmWriteResult = AssistantCrmWriteOk | AssistantCrmWriteErr;

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

async function getFirstStageIdForTenant(tenantId: string): Promise<string | null> {
  const rows = await db
    .select({ id: opportunityStages.id })
    .from(opportunityStages)
    .where(eq(opportunityStages.tenantId, tenantId))
    .orderBy(asc(opportunityStages.sortOrder))
    .limit(1);
  return rows[0]?.id ?? null;
}

async function findOpportunityByIdempotency(
  tenantId: string,
  idempotencyKey: string,
): Promise<{ id: string; customFields: Record<string, unknown> | null } | null> {
  const rows = await db
    .select({
      id: opportunities.id,
      customFields: opportunities.customFields,
    })
    .from(opportunities)
    .where(
      and(
        eq(opportunities.tenantId, tenantId),
        sql`(${opportunities.customFields}->'aiAssistant'->>'idempotencyKey') = ${idempotencyKey}`,
      ),
    )
    .limit(1);
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    customFields: (r.customFields as Record<string, unknown> | null) ?? null,
  };
}

function formatAmountCs(n: number): string {
  return new Intl.NumberFormat("cs-CZ").format(n);
}

function buildDealTitle(params: {
  amount: number;
  contactDisplayName: string;
  bank: string;
  ltv: number;
}): string {
  return `HypotĂ©ka ${formatAmountCs(params.amount)} â€“ ${params.contactDisplayName} â€“ ${params.bank} â€“ LTV ${params.ltv}%`;
}

export async function executeMortgageDealAndFollowUpTask(
  input: AssistantCrmWriteInput,
): Promise<AssistantCrmWriteResult> {
  const { tenantId, userId, roleName, contactId, intent } = input;
  const now = input.now ?? new Date();

  if (!hasPermission(roleName, "opportunities:write")) {
    return {
      ok: false,
      error: "ChybĂ­ oprĂˇvnÄ›nĂ­ k zĂˇpisu do pipeline (opportunities:write).",
      idempotencyKey: "",
    };
  }
  if (!hasPermission(roleName, "contacts:write") && !hasPermission(roleName, "tasks:*")) {
    return {
      ok: false,
      error: "ChybĂ­ oprĂˇvnÄ›nĂ­ k vytvĂˇĹ™enĂ­ ĂşkolĹŻ.",
      idempotencyKey: "",
    };
  }

  const amount = intent.amount ?? 4_000_000;
  const ltv = intent.ltv ?? 90;
  const bank = (intent.bank ?? "ÄŚS").trim() || "ÄŚS";
  const rate = intent.rateGuess ?? 4.99;
  const purpose = (intent.purpose ?? "").trim() || "koupÄ› bytu + rekonstrukce";

  const [contactRow] = await db
    .select({
      firstName: contacts.firstName,
      lastName: contacts.lastName,
    })
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.tenantId, tenantId)))
    .limit(1);

  if (!contactRow) {
    return { ok: false, error: "Kontakt nebyl nalezen v tenantovi.", idempotencyKey: "" };
  }

  const contactDisplayName =
    [contactRow.firstName, contactRow.lastName].filter(Boolean).join(" ").trim() || "Klient";

  const title = buildDealTitle({ amount, contactDisplayName, bank, ltv });
  const stablePayload = {
    tenantId,
    contactId,
    title,
    caseType: "hypo",
    amount,
    ltv,
    bank,
    rate,
    purpose,
  };
  const idempotencyKey = sha256Hex(JSON.stringify(stablePayload));
  const payloadHash = sha256Hex(JSON.stringify({ ...stablePayload, idempotencyKey }));

  const existing = await findOpportunityByIdempotency(tenantId, idempotencyKey);
  if (existing?.customFields) {
    const ai = existing.customFields.aiAssistant as Record<string, unknown> | undefined;
    const taskId = typeof ai?.taskId === "string" ? ai.taskId : null;
    if (taskId) {
      const dueDate = computeNextTuesdayDatePrague(now);
      return {
        ok: true,
        dealId: existing.id,
        taskId,
        idempotencyKey,
        dueDate,
        payloadHash,
      };
    }
  }

  const stageId = await getFirstStageIdForTenant(tenantId);
  if (!stageId) {
    return {
      ok: false,
      error: "V tenantovi nejsou ĹľĂˇdnĂ© stupnÄ› pipeline â€” nelze zaloĹľit obchod.",
      idempotencyKey,
    };
  }

  const dueDate = computeNextTuesdayDatePrague(now);

  const customFieldsBase: Record<string, unknown> = {
    ltv,
    bank,
    rate,
    note: "ÄŤekĂˇme potvrzenĂ­",
    purpose,
    aiAssistant: {
      idempotencyKey,
      version: 1,
    },
  };

  let dealId: string;
  let taskId: string;

  try {
    const [oppRow] = await db
      .insert(opportunities)
      .values({
        tenantId,
        contactId,
        caseType: "hypo",
        title,
        stageId,
        expectedValue: String(amount),
        customFields: customFieldsBase,
      })
      .returning({ id: opportunities.id });

    dealId = oppRow?.id ?? "";
    if (!dealId) {
      return { ok: false, error: "ZĂˇpis obchodu se nepodaĹ™il.", idempotencyKey };
    }

    const taskTitle = `Follow-up ${bank} nabĂ­dka (ÄŤekĂˇme potvrzenĂ­, ${String(rate).replace(".", ",")}%)`;
    const taskDescription = [
      "[Priorita: vysokĂˇ]",
      `ĂšÄŤel: ${purpose}.`,
      `Odkaz na obchod: ${dealId}.`,
      `TermĂ­n follow-up: ${dueDate} 10:00 (Europe/Prague).`,
    ].join(" ");

    const [taskRow] = await db
      .insert(tasks)
      .values({
        tenantId,
        contactId,
        opportunityId: dealId,
        title: taskTitle,
        description: taskDescription,
        dueDate,
        assignedTo: userId,
        createdBy: userId,
      })
      .returning({ id: tasks.id });

    taskId = taskRow?.id ?? "";
    if (!taskId) {
      return { ok: false, error: "Obchod byl zaloĹľen, ale Ăşkol se nepodaĹ™ilo vytvoĹ™it.", idempotencyKey };
    }

    const mergedCustom = {
      ...customFieldsBase,
      aiAssistant: {
        ...(customFieldsBase.aiAssistant as object),
        taskId,
        dealId,
      },
    };

    await db
      .update(opportunities)
      .set({
        customFields: mergedCustom,
        updatedAt: new Date(),
      })
      .where(and(eq(opportunities.id, dealId), eq(opportunities.tenantId, tenantId)));

    await logAudit({
      tenantId,
      userId,
      action: "ai_assistant:write",
      entityType: "opportunity",
      entityId: dealId,
      meta: {
        toolName: "executeMortgageDealAndFollowUpTask",
        idempotencyKey,
        payloadHash,
        createdEntityIds: [dealId, taskId],
      },
    });

    return {
      ok: true,
      dealId,
      taskId,
      idempotencyKey,
      dueDate,
      payloadHash,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg || "ZĂˇpis do CRM selhal.", idempotencyKey };
  }
}


