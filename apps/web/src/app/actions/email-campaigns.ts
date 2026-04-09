"use server";

import { requireAuthInAction } from "@/lib/auth/require-auth";
import { hasPermission } from "@/lib/auth/permissions";
import {
  db,
  emailCampaigns,
  emailCampaignRecipients,
  contacts,
  eq,
  and,
  isNull,
  isNotNull,
  desc,
  sql,
} from "db";
import { sendEmail, logNotification } from "@/lib/email/send-email";

const CAMPAIGN_TEMPLATE_LOG = "email_campaign";
/** Ochrana proti timeoutu serverless — zbytek pošlete druhou kampaní nebo rozšiřte limit. */
const MAX_RECIPIENTS_PER_SEND = 80;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function personalizeHtml(html: string, firstName: string, lastName: string): string {
  const name = [firstName, lastName].filter(Boolean).join(" ").trim() || "kliente";
  return html
    .replace(/\{\{jmeno\}\}/gi, escapeHtml(firstName.trim() || name))
    .replace(/\{\{cele_jmeno\}\}/gi, escapeHtml(name));
}

export type EmailCampaignRow = {
  id: string;
  name: string;
  subject: string;
  status: string;
  createdAt: Date;
  sentAt: Date | null;
};

export async function listEmailCampaigns(): Promise<EmailCampaignRow[]> {
  const auth = await requireAuthInAction();
  if (!hasPermission(auth.roleName, "contacts:read")) {
    throw new Error("Nemáte oprávnění.");
  }
  const rows = await db
    .select({
      id: emailCampaigns.id,
      name: emailCampaigns.name,
      subject: emailCampaigns.subject,
      status: emailCampaigns.status,
      createdAt: emailCampaigns.createdAt,
      sentAt: emailCampaigns.sentAt,
    })
    .from(emailCampaigns)
    .where(eq(emailCampaigns.tenantId, auth.tenantId))
    .orderBy(desc(emailCampaigns.createdAt))
    .limit(50);
  return rows;
}

export async function createEmailCampaignDraft(input: {
  name: string;
  subject: string;
  bodyHtml: string;
}): Promise<{ id: string }> {
  const auth = await requireAuthInAction();
  if (!hasPermission(auth.roleName, "contacts:write")) {
    throw new Error("Nemáte oprávnění vytvářet kampaň.");
  }
  const name = input.name?.trim();
  const subject = input.subject?.trim();
  const bodyHtml = input.bodyHtml?.trim();
  if (!name || !subject || !bodyHtml) {
    throw new Error("Vyplňte název, předmět a tělo zprávy.");
  }
  const [row] = await db
    .insert(emailCampaigns)
    .values({
      tenantId: auth.tenantId,
      createdByUserId: auth.userId,
      name,
      subject,
      bodyHtml,
      status: "draft",
    })
    .returning({ id: emailCampaigns.id });
  if (!row) throw new Error("Kampaň se nepodařilo vytvořit.");
  return { id: row.id };
}

export type SendEmailCampaignResult = {
  ok: true;
  sent: number;
  skipped: number;
  failed: number;
  capped?: boolean;
  cap?: number;
};

/**
 * Odešle draft kampaně všem způsobilým kontaktům (e-mail, ne do_not_email, ne archiv).
 * Placeholdery v HTML: {{jmeno}}, {{cele_jmeno}}
 */
export async function sendEmailCampaign(campaignId: string): Promise<SendEmailCampaignResult> {
  const auth = await requireAuthInAction();
  if (!hasPermission(auth.roleName, "contacts:write")) {
    throw new Error("Nemáte oprávnění odesílat kampaň.");
  }

  const [campaign] = await db
    .select()
    .from(emailCampaigns)
    .where(and(eq(emailCampaigns.id, campaignId), eq(emailCampaigns.tenantId, auth.tenantId)))
    .limit(1);
  if (!campaign) throw new Error("Kampaň nebyla nalezena.");
  if (campaign.status !== "draft") {
    throw new Error("Odeslat lze jen koncept (draft).");
  }

  const audience = await db
    .select({
      id: contacts.id,
      email: contacts.email,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
    })
    .from(contacts)
    .where(
      and(
        eq(contacts.tenantId, auth.tenantId),
        isNull(contacts.archivedAt),
        eq(contacts.doNotEmail, false),
        isNull(contacts.notificationUnsubscribedAt),
        isNotNull(contacts.email),
        sql`trim(${contacts.email}) <> ''`
      )
    )
    .limit(MAX_RECIPIENTS_PER_SEND + 1);

  const capped = audience.length > MAX_RECIPIENTS_PER_SEND;
  const targets = capped ? audience.slice(0, MAX_RECIPIENTS_PER_SEND) : audience;

  await db
    .update(emailCampaigns)
    .set({ status: "sending", updatedAt: new Date() })
    .where(eq(emailCampaigns.id, campaignId));

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const c of targets) {
    const email = c.email!.trim();
    const html = personalizeHtml(campaign.bodyHtml, c.firstName ?? "", c.lastName ?? "");

    const [recRow] = await db
      .insert(emailCampaignRecipients)
      .values({
        tenantId: auth.tenantId,
        campaignId,
        contactId: c.id,
        email,
        status: "pending",
      })
      .returning({ id: emailCampaignRecipients.id });

    if (!recRow) {
      skipped += 1;
      continue;
    }

    const result = await sendEmail({
      to: email,
      subject: campaign.subject,
      html,
    });

    if (result.ok) {
      sent += 1;
      await db
        .update(emailCampaignRecipients)
        .set({
          status: "sent",
          providerMessageId: result.messageId ?? null,
          sentAt: new Date(),
        })
        .where(eq(emailCampaignRecipients.id, recRow.id));
      await logNotification({
        tenantId: auth.tenantId,
        contactId: c.id,
        template: CAMPAIGN_TEMPLATE_LOG,
        subject: campaign.subject,
        recipient: email,
        status: "sent",
        meta: { campaignId, campaignName: campaign.name },
      });
    } else {
      failed += 1;
      await db
        .update(emailCampaignRecipients)
        .set({
          status: "failed",
          errorMessage: result.error ?? "unknown",
        })
        .where(eq(emailCampaignRecipients.id, recRow.id));
      await logNotification({
        tenantId: auth.tenantId,
        contactId: c.id,
        template: CAMPAIGN_TEMPLATE_LOG,
        subject: campaign.subject,
        recipient: email,
        status: "failed",
        meta: { campaignId, error: result.error },
      });
    }
  }

  const finalStatus = failed > 0 && sent === 0 ? "failed" : "sent";
  await db
    .update(emailCampaigns)
    .set({
      status: finalStatus,
      updatedAt: new Date(),
      sentAt: new Date(),
    })
    .where(eq(emailCampaigns.id, campaignId));

  return {
    ok: true,
    sent,
    skipped,
    failed,
    capped,
    cap: MAX_RECIPIENTS_PER_SEND,
  };
}
