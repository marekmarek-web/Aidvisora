import { NextResponse } from "next/server";
import { getIntegrationApiAuth } from "../../../../integrations/auth";
import { getValidGmailAccessToken } from "@/lib/integrations/google-gmail-integration-service";
import { trashGmailMessage } from "@/lib/integrations/google-gmail";

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
    const message = await trashGmailMessage(accessToken, id);
    return NextResponse.json({ ok: true, id: message.id, threadId: message.threadId });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
