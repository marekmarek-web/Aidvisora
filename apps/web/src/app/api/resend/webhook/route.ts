import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { dbService, withServiceTenantContext } from "@/lib/db/service-db";
import {
  notificationLog,
  emailCampaignRecipients,
  emailCampaignEvents,
  contacts,
} from "db";

/**
 * Resend webhook handler — delivery events, bounces, complaints.
 *
 * Resend Webhooks používají **Svix** pro signing. Každý POST obsahuje headery:
 *   - `svix-id`
 *   - `svix-timestamp`
 *   - `svix-signature`  (formát `v1,<base64_hmac_sha256>`)
 *
 * Ověření: `HMAC-SHA256(secret, "<svix-id>.<svix-timestamp>.<raw-body>")`.
 * Secret = prefix `whsec_` + base64 content, ale při ověření používáme jen
 * base64 část jako raw key (viz Svix docs).
 *
 * Eventy, na které reagujeme:
 *   - `email.sent` / `email.delivered` — update `last_status`
 *   - `email.bounced` — update `last_status='bounced'` + error reason
 *   - `email.complained` — update `last_status='complained'`
 *   - `email.opened` / `email.clicked` — volitelně, logujeme do meta
 *
 * Dokud `RESEND_WEBHOOK_SECRET` není nastaven, vracíme 503 (nezpracujeme),
 * aby nešlo přes neověřený endpoint zaplavit DB.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ResendEvent = {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string | string[];
    from?: string;
    subject?: string;
    bounce?: { message?: string; subType?: string };
    complaint?: { feedbackType?: string };
    click?: { link?: string };
  };
};

function verifySvixSignature(params: {
  secret: string;
  svixId: string;
  svixTimestamp: string;
  svixSignature: string;
  rawBody: string;
}): boolean {
  const { secret, svixId, svixTimestamp, svixSignature, rawBody } = params;
  const secretPart = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  let keyBytes: Buffer;
  try {
    keyBytes = Buffer.from(secretPart, "base64");
  } catch {
    return false;
  }
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const expected = crypto.createHmac("sha256", keyBytes).update(signedContent).digest("base64");
  const provided = svixSignature
    .split(" ")
    .map((s) => s.trim())
    .filter((s) => s.startsWith("v1,"))
    .map((s) => s.slice(3));
  return provided.some((p) => {
    if (p.length !== expected.length) return false;
    try {
      return crypto.timingSafeEqual(Buffer.from(p), Buffer.from(expected));
    } catch {
      return false;
    }
  });
}

function mapEventToStatus(eventType: string): string {
  switch (eventType) {
    case "email.sent":
      return "sent";
    case "email.delivered":
      return "delivered";
    case "email.bounced":
      return "bounced";
    case "email.complained":
      return "complained";
    case "email.opened":
      return "opened";
    case "email.clicked":
      return "clicked";
    case "email.delivery_delayed":
      return "delayed";
    default:
      return eventType;
  }
}

export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "RESEND_WEBHOOK_SECRET not configured" },
      { status: 503 },
    );
  }

  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ ok: false, error: "Missing svix headers" }, { status: 400 });
  }

  // Ochrana proti replay: timestamp musí být do 5 minut.
  const tsNum = Number.parseInt(svixTimestamp, 10);
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > 300) {
    return NextResponse.json({ ok: false, error: "Stale webhook timestamp" }, { status: 400 });
  }

  const rawBody = await request.text();
  const valid = verifySvixSignature({
    secret,
    svixId,
    svixTimestamp,
    svixSignature,
    rawBody,
  });
  if (!valid) {
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
  }

  let event: ResendEvent | null = null;
  try {
    event = JSON.parse(rawBody) as ResendEvent;
  } catch {
    return NextResponse.json({ ok: false, error: "Bad JSON" }, { status: 400 });
  }

  const emailId = event?.data?.email_id?.trim();
  if (!emailId) {
    // Některé Resend eventy nemají email_id — tiše přijmeme a 204.
    return new NextResponse(null, { status: 204 });
  }

  const statusLabel = mapEventToStatus(event.type);
  const errorMessage =
    event.type === "email.bounced"
      ? [event.data?.bounce?.subType, event.data?.bounce?.message].filter(Boolean).join(": ")
      : event.type === "email.complained"
        ? event.data?.complaint?.feedbackType ?? null
        : null;

  try {
    // 1) Legacy: notification_log
    await dbService
      .update(notificationLog)
      .set({
        lastStatus: statusLabel,
        lastStatusAt: new Date(),
        ...(errorMessage ? { lastError: errorMessage.slice(0, 500) } : {}),
      })
      .where(
        and(
          eq(notificationLog.providerMessageId, emailId),
          eq(notificationLog.channel, "email"),
        ),
      );

    // 2) Campaign recipients — najdi řádek a zapiš event + status.
    const [recipient] = await dbService
      .select({
        id: emailCampaignRecipients.id,
        tenantId: emailCampaignRecipients.tenantId,
        campaignId: emailCampaignRecipients.campaignId,
        contactId: emailCampaignRecipients.contactId,
      })
      .from(emailCampaignRecipients)
      .where(eq(emailCampaignRecipients.providerMessageId, emailId))
      .limit(1);

    if (recipient) {
      await withServiceTenantContext({ tenantId: recipient.tenantId }, async (tx) => {
        const now = new Date();
        const updates: Record<string, unknown> = {};
        let recipientStatusColumn: string | null = null;

        switch (event.type) {
          case "email.delivered":
            updates.deliveredAt = now;
            recipientStatusColumn = "delivered";
            break;
          case "email.opened":
            updates.openedAt = sql`coalesce(${emailCampaignRecipients.openedAt}, ${now})`;
            recipientStatusColumn = "opened";
            break;
          case "email.clicked":
            updates.firstClickAt = sql`coalesce(${emailCampaignRecipients.firstClickAt}, ${now})`;
            updates.clickCount = sql`${emailCampaignRecipients.clickCount} + 1`;
            recipientStatusColumn = "clicked";
            break;
          case "email.bounced":
            updates.bouncedAt = now;
            updates.bounceType = event.data?.bounce?.subType ?? "hard";
            updates.status = "bounced";
            updates.errorMessage = (errorMessage ?? "bounced").slice(0, 500);
            break;
          case "email.complained":
            updates.complaintAt = now;
            updates.status = "complained";
            break;
        }

        if (recipientStatusColumn) {
          // Monotone forward progress: status jde jen na 'dál', neregresuje z failed/bounced.
          updates.status = sql`CASE WHEN ${emailCampaignRecipients.status} NOT IN ('failed','bounced','complained','unsubscribed') THEN ${recipientStatusColumn} ELSE ${emailCampaignRecipients.status} END`;
        }

        if (Object.keys(updates).length > 0) {
          await tx
            .update(emailCampaignRecipients)
            .set(updates)
            .where(eq(emailCampaignRecipients.id, recipient.id));
        }

        await tx.insert(emailCampaignEvents).values({
          tenantId: recipient.tenantId,
          campaignId: recipient.campaignId,
          recipientId: recipient.id,
          eventType: statusLabel,
          url: event.data?.click?.link ?? null,
          metadata: {
            providerMessageId: emailId,
            errorMessage: errorMessage ?? null,
            bounceSubType: event.data?.bounce?.subType ?? null,
            feedbackType: event.data?.complaint?.feedbackType ?? null,
          },
        });

        // Hard bounce nebo complained → auto do_not_email (compliance).
        const isHardBounce =
          event.type === "email.bounced" && event.data?.bounce?.subType !== "transient";
        const isComplaint = event.type === "email.complained";
        if ((isHardBounce || isComplaint) && recipient.contactId) {
          await tx
            .update(contacts)
            .set({
              doNotEmail: true,
              updatedAt: now,
            })
            .where(eq(contacts.id, recipient.contactId));
        }
      });
    }
  } catch (err) {
    console.error("[resend-webhook] update failed", err);
    return NextResponse.json({ ok: false, error: "Update failed" }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
