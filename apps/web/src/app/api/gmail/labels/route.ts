import { NextResponse } from "next/server";
import { getIntegrationApiAuth } from "../../integrations/auth";
import { getValidGmailAccessToken } from "@/lib/integrations/google-gmail-integration-service";
import { listGmailLabels } from "@/lib/integrations/google-gmail";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authResult = await getIntegrationApiAuth(request);
  if (!authResult.ok) return authResult.response;
  const { userId, tenantId } = authResult.auth;

  try {
    const accessToken = await getValidGmailAccessToken(userId, tenantId);
    const labels = await listGmailLabels(accessToken);
    return NextResponse.json({ labels });
  } catch (e) {
    const code = (e as Error & { code?: string }).code;
    if (code === "not_connected") {
      return NextResponse.json({ error: "Gmail není připojen" }, { status: 400 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
