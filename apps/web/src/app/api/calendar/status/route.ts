import { NextResponse } from "next/server";
import { userGoogleCalendarIntegrations } from "db";
import { eq, and } from "db";
import { getCalendarAuth } from "../auth";
import { withTenantContextFromAuth } from "@/lib/auth/with-auth-context";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authResult = await getCalendarAuth(request, { requireWrite: false });
  // Při 401/403 vrátit 200 s connected: false, aby UI zobrazilo „Odpojeno“ a tlačítko Připojit (ne „Stav se nepodařilo načíst“)
  if (!authResult.ok) {
    return NextResponse.json({ connected: false });
  }
  const { userId, tenantId } = authResult.auth;

  try {
    const rows = await withTenantContextFromAuth({ tenantId, userId }, (tx) =>
      tx
        .select({
          googleEmail: userGoogleCalendarIntegrations.googleEmail,
          isActive: userGoogleCalendarIntegrations.isActive,
        })
        .from(userGoogleCalendarIntegrations)
        .where(
          and(
            eq(userGoogleCalendarIntegrations.tenantId, tenantId),
            eq(userGoogleCalendarIntegrations.userId, userId),
          ),
        )
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
