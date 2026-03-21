import { getIntegrationApiAuth } from "../../../../integrations/auth";
import { getValidDriveAccessToken } from "@/lib/integrations/google-drive-integration-service";
import { downloadDriveFile, getDriveFile } from "@/lib/integrations/google-drive";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authResult = await getIntegrationApiAuth(request);
  if (!authResult.ok) return authResult.response;
  const { userId, tenantId } = authResult.auth;
  const { id } = await context.params;

  try {
    const accessToken = await getValidDriveAccessToken(userId, tenantId);
    const [metadata, payload] = await Promise.all([
      getDriveFile(accessToken, id),
      downloadDriveFile(accessToken, id),
    ]);
    return new Response(new Uint8Array(payload.data), {
      status: 200,
      headers: {
        "Content-Type": payload.contentType || metadata.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename=\"${metadata.name}\"`,
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
}
