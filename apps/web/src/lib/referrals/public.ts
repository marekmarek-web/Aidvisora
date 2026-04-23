import "server-only";

import {
  referralRequests,
  contacts,
  tenants,
  emailCampaigns,
  emailCampaignRecipients,
  emailSendQueue,
  emailTemplates,
  eq,
  and,
  isNull,
  sql,
} from "db";
import { dbService, withServiceTenantContext } from "@/lib/db/service-db";
import { mintTrackingToken } from "@/lib/email/queue-enqueue";

export type ReferralTokenContext = {
  tenantId: string;
  tenantName: string;
  advisorFirstName: string | null;
  advisorLastName: string | null;
  contactFirstName: string | null;
  contactLastName: string | null;
  isExpired: boolean;
  isSubmitted: boolean;
  referralId: string;
};

export async function resolveReferralByToken(token: string): Promise<ReferralTokenContext | null> {
  const cleaned = token.trim().toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(cleaned)) return null;

  // Používáme service DB bez RLS — token je uniq a public.
  const rows = (await dbService.execute(sql`
    SELECT
      r.id, r.tenant_id AS "tenantId",
      r.submitted_at AS "submittedAt",
      r.expires_at AS "expiresAt",
      c.first_name AS "contactFirstName",
      c.last_name AS "contactLastName",
      t.name AS "tenantName"
    FROM referral_requests r
    JOIN contacts c ON c.id = r.contact_id
    JOIN tenants t ON t.id = r.tenant_id
    WHERE r.token = ${cleaned}
    LIMIT 1
  `)) as unknown as Array<{
    id: string;
    tenantId: string;
    submittedAt: Date | null;
    expiresAt: Date;
    contactFirstName: string | null;
    contactLastName: string | null;
    tenantName: string;
  }>;
  const row = rows[0];
  if (!row) return null;

  return {
    referralId: row.id,
    tenantId: row.tenantId,
    tenantName: row.tenantName,
    advisorFirstName: null,
    advisorLastName: null,
    contactFirstName: row.contactFirstName,
    contactLastName: row.contactLastName,
    isExpired: row.expiresAt.getTime() < Date.now(),
    isSubmitted: !!row.submittedAt,
  };
}

export async function markReferralOpened(token: string): Promise<void> {
  const cleaned = token.trim().toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(cleaned)) return;
  await dbService.execute(sql`
    UPDATE referral_requests
    SET opened_at = coalesce(opened_at, now()),
        status = CASE WHEN status = 'sent' THEN 'opened' ELSE status END,
        updated_at = now()
    WHERE token = ${cleaned}
  `);
}

export async function submitReferral(
  token: string,
  payload: {
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    note: string | null;
    consent: boolean;
  },
): Promise<{ ok: true }> {
  const cleaned = token.trim().toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(cleaned)) throw new Error("Neplatný odkaz.");
  if (!payload.consent) throw new Error("Pro odeslání je nutný souhlas.");
  if (!payload.firstName.trim() || !payload.lastName.trim()) {
    throw new Error("Zadejte jméno a příjmení.");
  }
  if (!payload.email && !payload.phone) {
    throw new Error("Zadejte alespoň e-mail nebo telefon.");
  }

  // Najdi request
  const rows = (await dbService.execute(sql`
    SELECT id, tenant_id AS "tenantId", contact_id AS "referringContactId",
           submitted_at AS "submittedAt", expires_at AS "expiresAt"
    FROM referral_requests
    WHERE token = ${cleaned}
    LIMIT 1
  `)) as unknown as Array<{
    id: string;
    tenantId: string;
    referringContactId: string;
    submittedAt: Date | null;
    expiresAt: Date;
  }>;
  const row = rows[0];
  if (!row) throw new Error("Odkaz nebyl nalezen.");
  if (row.submittedAt) throw new Error("Doporučení již bylo odesláno.");
  if (row.expiresAt.getTime() < Date.now()) throw new Error("Odkaz vypršel.");

  await withServiceTenantContext({ tenantId: row.tenantId }, async (tx) => {
    const [newContact] = await tx
      .insert(contacts)
      .values({
        tenantId: row.tenantId,
        firstName: payload.firstName.trim(),
        lastName: payload.lastName.trim(),
        email: payload.email?.trim() || null,
        phone: payload.phone?.trim() || null,
        notes: payload.note?.trim() || null,
        tags: ["lead", "referral"],
        leadSource: "referral",
        sourceKind: "manual",
      })
      .returning({ id: contacts.id });

    await tx
      .update(referralRequests)
      .set({
        status: "submitted",
        submittedAt: new Date(),
        submittedContactId: newContact!.id,
        updatedAt: new Date(),
      })
      .where(and(eq(referralRequests.token, cleaned)));
  });

  // B3.2: pošli thank-you email původnímu kontaktu. Nefailovat submit pokud
  // thank-you selže (kampaň je nice-to-have, ne blokující).
  try {
    await enqueueReferralThankYou({
      tenantId: row.tenantId,
      referringContactId: row.referringContactId,
    });
  } catch (e) {
    console.warn("[referral] thank-you email enqueue failed (non-blocking)", e);
  }

  return { ok: true };
}

/**
 * B3.2 — najde kontakt, který referral vyvolal, a zařadí mu do fronty single-recipient
 * kampaň na bázi šablony `referral_thank_you`. Přeskočí pokud kontakt nemá email
 * / do_not_email / je unsubscribed. (Tady vědomě neprovádíme consent check —
 * transactional potvrzovací email je opodstatněný na právním základě plnění.)
 */
async function enqueueReferralThankYou(params: {
  tenantId: string;
  referringContactId: string;
}): Promise<void> {
  await withServiceTenantContext({ tenantId: params.tenantId }, async (tx) => {
    const [contact] = await tx
      .select({
        id: contacts.id,
        email: contacts.email,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        doNotEmail: contacts.doNotEmail,
        notificationUnsubscribedAt: contacts.notificationUnsubscribedAt,
      })
      .from(contacts)
      .where(
        and(
          eq(contacts.id, params.referringContactId),
          eq(contacts.tenantId, params.tenantId),
        ),
      )
      .limit(1);
    if (!contact || !contact.email || contact.doNotEmail) return;
    if (contact.notificationUnsubscribedAt) return;

    const [template] = await tx
      .select({
        subject: emailTemplates.subject,
        preheader: emailTemplates.preheader,
        bodyHtml: emailTemplates.bodyHtml,
      })
      .from(emailTemplates)
      .where(
        and(
          eq(emailTemplates.kind, "referral_thank_you"),
          eq(emailTemplates.isArchived, false),
          isNull(emailTemplates.tenantId),
        ),
      )
      .limit(1);
    if (!template) return;

    const scheduledFor = new Date();
    const [created] = await tx
      .insert(emailCampaigns)
      .values({
        tenantId: params.tenantId,
        createdByUserId: "system:referral",
        name: `Poděkování za doporučení — ${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim(),
        subject: template.subject,
        preheader: template.preheader,
        bodyHtml: template.bodyHtml,
        status: "queued",
        scheduledAt: scheduledFor,
        queuedAt: new Date(),
        recipientCount: 1,
      })
      .returning({ id: emailCampaigns.id });
    const campaignId = created!.id;

    const [recipientRow] = await tx
      .insert(emailCampaignRecipients)
      .values({
        tenantId: params.tenantId,
        campaignId,
        contactId: contact.id,
        email: contact.email,
        trackingToken: mintTrackingToken(),
        status: "queued",
      })
      .returning({ id: emailCampaignRecipients.id });

    await tx.insert(emailSendQueue).values({
      tenantId: params.tenantId,
      campaignId,
      recipientId: recipientRow!.id,
      scheduledFor,
      nextAttemptAt: scheduledFor,
      status: "pending",
      payload: {
        firstName: contact.firstName ?? "",
        lastName: contact.lastName ?? "",
        email: contact.email.trim(),
      },
    });
  });
}
