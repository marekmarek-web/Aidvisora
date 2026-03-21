import { NextResponse } from "next/server";
import { getIntegrationApiAuth } from "../../../integrations/auth";
import { getValidDriveAccessToken } from "@/lib/integrations/google-drive-integration-service";
import {
  deleteDriveFile,
  getDriveFile,
  updateDriveFile,
} from "@/lib/integrations/google-drive";

async function getAccessToken(userId: string, tenantId: string) {
  try {
    return await getValidDriveAccessToken(userId, tenantId);
  } catch (e) {
    const code = (e as Error & { code?: string }).code;
    if (code === "not_connected") {
      throw new Response(JSON.stringify({ error: "Google Drive není připojen" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    throw new Response(JSON.stringify({ error: "Chyba přístupu k Drive" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

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
    const accessToken = await getAccessToken(userId, tenantId);
    const file = await getDriveFile(accessToken, id);
    return NextResponse.json({ file });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authResult = await getIntegrationApiAuth(request);
  if (!authResult.ok) return authResult.response;
  const { userId, tenantId } = authResult.auth;
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    addParentId?: string;
    removeParentId?: string;
  };
  try {
    const accessToken = await getAccessToken(userId, tenantId);
    const file = await updateDriveFile(accessToken, id, {
      name: body.name?.trim() || undefined,
      addParents: body.addParentId ? [body.addParentId] : undefined,
      removeParents: body.removeParentId ? [body.removeParentId] : undefined,
    });
    return NextResponse.json({ file });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authResult = await getIntegrationApiAuth(request);
  if (!authResult.ok) return authResult.response;
  const { userId, tenantId } = authResult.auth;
  const { id } = await context.params;
  try {
    const accessToken = await getAccessToken(userId, tenantId);
    await deleteDriveFile(accessToken, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
