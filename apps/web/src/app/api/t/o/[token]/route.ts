import { NextResponse } from "next/server";
import { dbService, withServiceTenantContext } from "@/lib/db/service-db";
import { emailCampaignRecipients, emailCampaignEvents, eq, sql } from "db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Open pixel endpoint: `GET /api/t/o/<token>.gif`
 * Vrací 1×1 transparentní GIF a asynchronně zapíše 'opened' event.
 *
 * Token je per-recipient opaque (`email_campaign_recipients.tracking_token`).
 * První otevření aktualizuje `opened_at`, další jen přidají event.
 */
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

function pixelResponse(): NextResponse {
  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(PIXEL.length),
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache",
      "X-Robots-Tag": "noindex",
    },
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token: rawToken } = await context.params;
  // strip `.gif` if present
  const token = rawToken.replace(/\.gif$/i, "");

  // Best-effort tracking — pokud se nepovede, stále vrátíme pixel (nesmíme zlomit rendering).
  try {
    const [row] = await dbService
      .select({
        id: emailCampaignRecipients.id,
        tenantId: emailCampaignRecipients.tenantId,
        campaignId: emailCampaignRecipients.campaignId,
        openedAt: emailCampaignRecipients.openedAt,
      })
      .from(emailCampaignRecipients)
      .where(eq(emailCampaignRecipients.trackingToken, token))
      .limit(1);

    if (row) {
      const ua = request.headers.get("user-agent") ?? null;
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

      await withServiceTenantContext({ tenantId: row.tenantId }, async (tx) => {
        if (!row.openedAt) {
          await tx
            .update(emailCampaignRecipients)
            .set({
              openedAt: new Date(),
              status: sql`CASE WHEN ${emailCampaignRecipients.status} IN ('sent','delivered') THEN 'opened' ELSE ${emailCampaignRecipients.status} END`,
            })
            .where(eq(emailCampaignRecipients.id, row.id));
        }
        await tx.insert(emailCampaignEvents).values({
          tenantId: row.tenantId,
          campaignId: row.campaignId,
          recipientId: row.id,
          eventType: "opened",
          ipAddress: ip,
          userAgent: ua,
        });
      });
    }
  } catch (e) {
    console.error("[tracking/open] error", e);
  }

  return pixelResponse();
}
