import { NextResponse } from "next/server";
import { dbService, withServiceTenantContext } from "@/lib/db/service-db";
import { emailCampaignRecipients, emailCampaignEvents, eq, sql } from "db";
import { decodeTargetUrl, isSafeRedirectUrl } from "@/lib/email/tracking";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Click tracking: `GET /api/t/c/<token>?u=<base64url>`
 * - decoduje cílovou URL
 * - zapíše 'clicked' event + inkrementuje click_count
 * - whitelist: povolíme pouze http(s) protokoly
 */
const FALLBACK = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.aidvisora.cz";

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await context.params;
  const { searchParams } = new URL(request.url);
  const encoded = searchParams.get("u");
  const target = encoded ? decodeTargetUrl(encoded) : null;

  // Whitelist redirect ochrana.
  const safe = target && isSafeRedirectUrl(target) ? target : FALLBACK;

  try {
    const [row] = await dbService
      .select({
        id: emailCampaignRecipients.id,
        tenantId: emailCampaignRecipients.tenantId,
        campaignId: emailCampaignRecipients.campaignId,
      })
      .from(emailCampaignRecipients)
      .where(eq(emailCampaignRecipients.trackingToken, token))
      .limit(1);

    if (row) {
      const ua = request.headers.get("user-agent") ?? null;
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

      await withServiceTenantContext({ tenantId: row.tenantId }, async (tx) => {
        await tx
          .update(emailCampaignRecipients)
          .set({
            firstClickAt: sql`coalesce(${emailCampaignRecipients.firstClickAt}, now())`,
            clickCount: sql`${emailCampaignRecipients.clickCount} + 1`,
            status: sql`CASE WHEN ${emailCampaignRecipients.status} IN ('sent','delivered','opened') THEN 'clicked' ELSE ${emailCampaignRecipients.status} END`,
          })
          .where(eq(emailCampaignRecipients.id, row.id));

        await tx.insert(emailCampaignEvents).values({
          tenantId: row.tenantId,
          campaignId: row.campaignId,
          recipientId: row.id,
          eventType: "clicked",
          ipAddress: ip,
          userAgent: ua,
          url: safe.slice(0, 2000),
        });
      });
    }
  } catch (e) {
    console.error("[tracking/click] error", e);
  }

  return NextResponse.redirect(safe, { status: 302 });
}
