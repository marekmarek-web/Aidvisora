import { NextResponse } from "next/server";
import { getIntegrationApiAuth } from "../../../../integrations/auth";
import { getValidGmailAccessToken } from "@/lib/integrations/google-gmail-integration-service";
import { deleteGmailMessage } from "@/lib/integrations/google-gmail";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authResult = await getIntegrationApiAuth(request);
  if (!authResult.ok) return authResult.response;
  const { userId, tenantId } = authResult.auth;
  const { id } = await context.params;

  try {
    const accessToken = await getValidGmailAccessToken(userId, tenantId);
    await deleteGmailMessage(accessToken, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
