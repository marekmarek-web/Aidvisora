import { NextResponse } from "next/server";
import { userGoogleDriveIntegrations } from "db";
import { eq, and } from "db";
import { getIntegrationApiAuth } from "../../integrations/auth";
import { withTenantContextFromAuth } from "@/lib/auth/with-auth-context";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authResult = await getIntegrationApiAuth(request);
  if (!authResult.ok) {
    return NextResponse.json({ connected: false });
  }
  const { userId, tenantId } = authResult.auth;

  try {
    const rows = await withTenantContextFromAuth({ tenantId, userId }, (tx) =>
      tx
        .select({
          googleEmail: userGoogleDriveIntegrations.googleEmail,
          isActive: userGoogleDriveIntegrations.isActive,
        })
        .from(userGoogleDriveIntegrations)
        .where(and(
          eq(userGoogleDriveIntegrations.tenantId, tenantId),
          eq(userGoogleDriveIntegrations.userId, userId),
        ))
        .limit(1),
    );

    const row = rows[0];
    const connected = !!row?.isActive;
    return NextResponse.json({
      connected,
      email: connected ? row.googleEmail ?? undefined : undefined,
    });
  } catch {
    return NextResponse.json({ connected: false });
  }
}
