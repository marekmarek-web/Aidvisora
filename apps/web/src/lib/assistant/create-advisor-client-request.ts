/**
 * 3F: Shared advisor-side client request create helper.
 *
 * Both the assistant write adapter and future advisor UI flows call this
 * single function so that auditing, activity logging, and advisor
 * in-app notifications are always consistent.
 *
 * NOTE: this is a server-side helper, not a Next.js Server Action.
 * It is called from contexts that already have auth verified (the caller
 * is responsible for auth checks before invoking this helper).
 */

import { opportunities, opportunityStages, contacts, auditLog, tenants, advisorNotifications } from "db";
import { eq, and, asc } from "db";
import { logActivity } from "@/app/actions/activity";
import { sendEmail, logNotification } from "@/lib/email/send-email";
import { newPortalRequestAdvisorTemplate } from "@/lib/email/templates";
import { caseTypeToLabel } from "@/lib/client-portal/case-type-labels";
import { getTargetAdvisorUserIdForContact } from "@/app/actions/client-dashboard";
import { withTenantContext } from "@/lib/db/with-tenant-context";
import { withServiceTenantContext } from "@/lib/db/service-db";

export type AdvisorClientRequestInput = {
  tenantId: string;
  userId: string;
  contactId: string;
  caseType: string;
  subject: string;
  description?: string | null;
  /** Set to true when created by advisor via AI assistant. */
  advisorCreated?: boolean;
};

export type AdvisorClientRequestResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/**
 * Creates a portal-tagged client request (opportunity with client_portal_request flag)
 * from the advisor side, with the same side effects as the portal create flow:
 * logActivity + auditLog + advisor in-app notification + e-mail.
 */
export async function createAdvisorClientRequest(
  input: AdvisorClientRequestInput,
): Promise<AdvisorClientRequestResult> {
  const { tenantId, userId, contactId, caseType, subject, description, advisorCreated } = input;

  const subjectTrim = subject.trim();
  const descTrim = description?.trim() ?? "";

  const createResult = await withTenantContext({ tenantId, userId }, async (tx) => {
    const [firstStage] = await tx
      .select({ id: opportunityStages.id })
      .from(opportunityStages)
      .where(eq(opportunityStages.tenantId, tenantId))
      .orderBy(asc(opportunityStages.sortOrder))
      .limit(1);

    if (!firstStage) {
      return { ok: false as const, error: "Žádný krok pipeline není k dispozici." };
    }

    const [row] = await tx
      .insert(opportunities)
      .values({
        tenantId,
        contactId,
        title: subjectTrim || `Požadavek klienta: ${caseTypeToLabel(caseType)}`,
        caseType: caseType.trim() || "jiné",
        stageId: firstStage.id,
        customFields: {
          client_portal_request: true,
          client_request_subject: subjectTrim || null,
          client_description: descTrim || null,
          ...(advisorCreated ? { advisor_created_request: true } : {}),
        },
      })
      .returning({ id: opportunities.id });

    const id = row?.id;
    if (!id) return { ok: false as const, error: "Nepodařilo se vytvořit požadavek." };
    return { ok: true as const, id };
  });

  if (!createResult.ok) return createResult;
  const newId = createResult.id;

  try {
    await logActivity("opportunity", newId, "create", {
      title: subjectTrim,
      contactId,
      source: advisorCreated ? "advisor_assistant" : "advisor",
    });
  } catch {
    /* non-fatal */
  }

  try {
    await withServiceTenantContext({ tenantId, userId }, async (tx) => {
      await tx.insert(auditLog).values({
        tenantId,
        userId,
        action: "advisor_client_request_create",
        entityType: "opportunity",
        entityId: newId,
        meta: { contactId, caseType, advisorCreated: advisorCreated ?? false },
      });
    });
  } catch {
    /* non-fatal */
  }

  notifyAdvisorOnNewRequest({
    tenantId,
    contactId,
    opportunityId: newId,
    caseType: caseType.trim() || "jiné",
    subjectTrim,
    descTrim,
  }).catch(() => {});

  notifyClientPortalAboutAdvisorRequest({
    tenantId,
    contactId,
    opportunityId: newId,
    caseType: caseType.trim() || "jiné",
    subjectTrim,
    descTrim,
  }).catch(() => {});

  return { ok: true, id: newId };
}

async function notifyAdvisorOnNewRequest(params: {
  tenantId: string;
  contactId: string;
  opportunityId: string;
  caseType: string;
  subjectTrim: string;
  descTrim: string;
}): Promise<void> {
  const { tenantId, contactId, opportunityId, caseType, subjectTrim, descTrim } = params;
  const caseTypeLabel = caseTypeToLabel(caseType);

  const { displayName, email } = await withServiceTenantContext({ tenantId }, async (tx) => {
    const [c] = await tx
      .select({ firstName: contacts.firstName, lastName: contacts.lastName })
      .from(contacts)
      .where(and(eq(contacts.tenantId, tenantId), eq(contacts.id, contactId)))
      .limit(1);
    const name = c
      ? [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || "Klient"
      : "Klient";

    const [tenant] = await tx
      .select({ notificationEmail: tenants.notificationEmail })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    return { displayName: name, email: tenant?.notificationEmail?.trim() };
  });
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://www.aidvisora.cz");
  const pipelineUrl = `${baseUrl}/portal/pipeline/${opportunityId}`;

  const previewBits = [subjectTrim, descTrim].filter(Boolean);
  const descriptionPreview = previewBits.join(" — ");

  const { subject, html } = newPortalRequestAdvisorTemplate({
    contactName: displayName,
    caseTypeLabel,
    descriptionPreview: descriptionPreview || "(bez popisu)",
    pipelineUrl,
  });

  if (email) {
    const result = await sendEmail({ to: email, subject, html });
    await logNotification({
      tenantId,
      contactId,
      template: "new_portal_request_advisor",
      subject,
      recipient: email,
      status: result.ok ? "sent" : (result.error ?? "failed"),
    });
  } else {
    await logNotification({
      tenantId,
      contactId,
      template: "new_portal_request_advisor",
      subject,
      recipient: "",
      status: "skipped_no_email",
    });
  }

  const targetUserId = await getTargetAdvisorUserIdForContact(tenantId, contactId);
  if (targetUserId) {
    try {
      const { emitNotification } = await import("@/lib/execution/notification-center");
      const body = JSON.stringify({
        caseType,
        caseTypeLabel,
        preview: descriptionPreview,
        contactId,
      });
      await emitNotification({
        tenantId,
        type: "client_portal_request",
        title: displayName,
        body,
        severity: "info",
        targetUserId,
        channels: ["in_app"],
        relatedEntityType: "opportunity",
        relatedEntityId: opportunityId,
      });
    } catch {
      /* best-effort */
    }
  }
}

async function notifyClientPortalAboutAdvisorRequest(params: {
  tenantId: string;
  contactId: string;
  opportunityId: string;
  caseType: string;
  subjectTrim: string;
  descTrim: string;
}): Promise<void> {
  const { tenantId, contactId, opportunityId, caseType, subjectTrim, descTrim } = params;
  const title =
    subjectTrim.trim() || `Nový požadavek od poradce — ${caseTypeToLabel(caseType)}`;
  const body =
    descTrim.length > 0 ? (descTrim.length > 500 ? `${descTrim.slice(0, 497)}…` : descTrim) : null;
  const { createPortalNotification } = await import("@/app/actions/portal-notifications");
  await createPortalNotification({
    tenantId,
    contactId,
    type: "request_status_change",
    title,
    body,
    relatedEntityType: "opportunity",
    relatedEntityId: opportunityId,
    dedupWindowMinutes: 0,
  });
}
