import { NextResponse } from "next/server";
import { userGoogleCalendarIntegrations } from "db";
import { eq, and } from "db";
import { getCalendarAuth } from "../auth";
import { withTenantContextFromAuth } from "@/lib/auth/with-auth-context";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authResult = await getCalendarAuth(request);
  if (!authResult.ok) return authResult.response;
  const { userId, tenantId } = authResult.auth;

  await withTenantContextFromAuth({ tenantId, userId }, (tx) =>
    tx
      .update(userGoogleCalendarIntegrations)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(
          eq(userGoogleCalendarIntegrations.tenantId, tenantId),
          eq(userGoogleCalendarIntegrations.userId, userId),
        ),
      ),
  );

  return NextResponse.json({ ok: true });
}
