import "server-only";

import {
  emailCampaigns,
  emailCampaignRecipients,
  emailSendQueue,
  emailCampaignEvents,
  contacts,
  eq,
  and,
  isNull,
  isNotNull,
  sql,
} from "db";
import type { AuthContext } from "@/lib/auth/require-auth";
import { withTenantContextFromAuth } from "@/lib/auth/with-auth-context";
import { CAMPAIGN_SEGMENTS, type CampaignSegmentId } from "@/lib/email/campaign-shared";
import {
  buildSegmentFilterSql,
  isValidSegmentFilter,
  type SegmentFilter,
} from "@/lib/email/segment-filter";

function tagFilterSql(tags: string[]) {
  if (tags.length === 0) return sql`true`;
  const lowered = tags.map((t) => t.toLowerCase());
  return sql`EXISTS (
    SELECT 1 FROM unnest(coalesce(${contacts.tags}, ARRAY[]::text[])) AS t(tag)
    WHERE lower(t.tag) = ANY(${lowered}::text[])
  )`;
}

function resolveSegmentTags(segmentId?: CampaignSegmentId | null): string[] {
  const seg = CAMPAIGN_SEGMENTS.find((s) => s.id === segmentId) ?? CAMPAIGN_SEGMENTS[0]!;
  return seg.tags;
}

/**
 * Generuje per-recipient tracking token (32 hex chars, opaque, bez PII).
 */
export function mintTrackingToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/**
 * Rozsype kampaň do `email_send_queue` v jedné transakci.
 * Vrací počet naplánovaných řádků. Caller pak nastaví `status='queued'`.
 *
 * Idempotent: pokud jsou recipients pro kampaň už založeni, nevytváří duplicity.
 */
export async function enqueueCampaignForSending(
  auth: AuthContext,
  params: {
    campaignId: string;
    segmentId?: CampaignSegmentId | null;
    segmentFilter?: Record<string, unknown> | null;
    /** Pokud je vyplněno, práce se spustí až v daný čas. */
    scheduledFor?: Date | null;
  },
): Promise<{ recipientCount: number; scheduledFor: Date }> {
  const scheduledFor = params.scheduledFor ?? new Date();
  const tagFilter = tagFilterSql(resolveSegmentTags(params.segmentId));
  const customFilter =
    params.segmentFilter && isValidSegmentFilter(params.segmentFilter)
      ? buildSegmentFilterSql(params.segmentFilter as SegmentFilter)
      : sql`true`;

  return withTenantContextFromAuth(auth, async (tx) => {
    const [campaign] = await tx
      .select()
      .from(emailCampaigns)
      .where(
        and(eq(emailCampaigns.id, params.campaignId), eq(emailCampaigns.tenantId, auth.tenantId)),
      )
      .limit(1);
    if (!campaign) throw new Error("Kampaň nebyla nalezena.");
    if (!["draft", "scheduled"].includes(campaign.status)) {
      throw new Error("Do fronty lze zařadit jen draft nebo naplánovanou kampaň.");
    }

    // Load audience
    const audience = await tx
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
          sql`trim(${contacts.email}) <> ''`,
          tagFilter,
          customFilter,
        ),
      );

    if (audience.length === 0) {
      await tx
        .update(emailCampaigns)
        .set({
          status: "queued",
          recipientCount: 0,
          queuedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(emailCampaigns.id, params.campaignId));
      return { recipientCount: 0, scheduledFor };
    }

    // Create recipient rows (with tracking tokens)
    const recipientValues = audience.map((c) => ({
      tenantId: auth.tenantId,
      campaignId: params.campaignId,
      contactId: c.id,
      email: c.email!.trim(),
      status: "queued" as const,
      trackingToken: mintTrackingToken(),
    }));

    const recipients = await tx
      .insert(emailCampaignRecipients)
      .values(recipientValues)
      .returning({
        id: emailCampaignRecipients.id,
        contactId: emailCampaignRecipients.contactId,
      });

    // Enqueue send jobs
    const contactMap = new Map(audience.map((c) => [c.id, c]));
    const queueValues = recipients
      .map((r) => {
        const c = contactMap.get(r.contactId);
        if (!c) return null;
        return {
          tenantId: auth.tenantId,
          campaignId: params.campaignId,
          recipientId: r.id,
          scheduledFor,
          nextAttemptAt: scheduledFor,
          status: "pending" as const,
          payload: {
            firstName: c.firstName ?? "",
            lastName: c.lastName ?? "",
            email: c.email!.trim(),
          },
        };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);

    if (queueValues.length > 0) {
      await tx.insert(emailSendQueue).values(queueValues);
    }

    // Append 'queued' event per recipient
    await tx.insert(emailCampaignEvents).values(
      recipients.map((r) => ({
        tenantId: auth.tenantId,
        campaignId: params.campaignId,
        recipientId: r.id,
        eventType: "queued",
      })),
    );

    await tx
      .update(emailCampaigns)
      .set({
        status: params.scheduledFor && params.scheduledFor > new Date() ? "scheduled" : "queued",
        scheduledAt: params.scheduledFor ?? null,
        queuedAt: new Date(),
        recipientCount: recipients.length,
        updatedAt: new Date(),
      })
      .where(eq(emailCampaigns.id, params.campaignId));

    return { recipientCount: recipients.length, scheduledFor };
  });
}
