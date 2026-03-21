import { NextResponse } from "next/server";
import { getIntegrationApiAuth } from "../../../../integrations/auth";
import { getValidDriveAccessToken } from "@/lib/integrations/google-drive-integration-service";
import { createDrivePermission } from "@/lib/integrations/google-drive";

type SharePayload = {
  type: "user" | "group" | "domain" | "anyone";
  role: "reader" | "commenter" | "writer";
  emailAddress?: string;
  domain?: string;
  allowFileDiscovery?: boolean;
};

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authResult = await getIntegrationApiAuth(request);
  if (!authResult.ok) return authResult.response;
  const { userId, tenantId } = authResult.auth;
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as SharePayload;

  if (!body.type || !body.role) {
    return NextResponse.json({ error: "Chybí typ a role sdílení." }, { status: 400 });
  }
  if ((body.type === "user" || body.type === "group") && !body.emailAddress) {
    return NextResponse.json({ error: "Chybí e-mail příjemce." }, { status: 400 });
  }

  try {
    const accessToken = await getValidDriveAccessToken(userId, tenantId);
    const permission = await createDrivePermission(accessToken, id, {
      type: body.type,
      role: body.role,
      emailAddress: body.emailAddress,
      domain: body.domain,
      allowFileDiscovery: body.allowFileDiscovery,
    });
    return NextResponse.json({ permission });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
