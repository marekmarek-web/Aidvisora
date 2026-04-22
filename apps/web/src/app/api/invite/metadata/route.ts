import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "db";
import { getClientIp, rateLimitByKey } from "@/lib/rate-limit-ip";
import { parseClientInviteTokenFromUrl } from "@/lib/auth/client-invite-url";
import { parseStaffInviteTokenFromUrl, STAFF_INVITE_QUERY_PARAM } from "@/lib/auth/staff-invite-url";

export const dynamic = "force-dynamic";

/**
 * Public metadata for a valid pending invite (prefill e-mail on /prihlaseni).
 * Supports client zone (`client_invite` / legacy `token`) and team (`staff_invite`).
 *
 * Runtime po cutoveru běží pod `aidvisora_app` (NOBYPASSRLS). Před přihlášením
 * nemáme k dispozici `app.user_id` ani `app.tenant_id`, takže jediná bezpečná
 * cesta je SECURITY DEFINER funkce `public.lookup_invite_metadata_v1(token)`
 * (viz migrace rls-m8-bootstrap-provision-and-gaps.sql, todo m1-sql-gap-migration).
 * Funkce uvnitř ownerské identity ověří token + expiraci + absenci revoke/accept
 * a vrátí minimum dat potřebných k prefillu formuláře.
 */
export async function GET(request: Request) {
  const ip = getClientIp(request);
  if (!rateLimitByKey(`invite-metadata:${ip}`).ok) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  const urlParams = new URL(request.url).searchParams;
  const clientToken = parseClientInviteTokenFromUrl(urlParams);
  const staffToken = parseStaffInviteTokenFromUrl(urlParams);

  const token = clientToken ?? staffToken ?? "";
  if (token.length !== 32) {
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 400 });
  }

  type Row = {
    kind: "client" | "staff" | null;
    email: string | null;
    expires_at: string | null;
    first_name: string | null;
    tenant_name: string | null;
  };

  if (clientToken !== null) {
    const rows = (await db.execute(
      sql`select kind, email, expires_at, first_name, tenant_name
          from public.lookup_invite_metadata_v1(${clientToken}::text, 'client'::text)`,
    )) as unknown as Row[];
    const row = rows[0];
    if (!row || row.kind !== "client" || !row.email || !row.expires_at) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      kind: "client" as const,
      email: row.email.trim(),
      expiresAt: new Date(row.expires_at).toISOString(),
      firstName: row.first_name?.trim() ?? null,
    });
  }

  if (staffToken === null) {
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 400 });
  }

  const rows = (await db.execute(
    sql`select kind, email, expires_at, first_name, tenant_name
        from public.lookup_invite_metadata_v1(${staffToken}::text, 'staff'::text)`,
  )) as unknown as Row[];
  const row = rows[0];
  if (!row || row.kind !== "staff" || !row.email || !row.expires_at) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    kind: "staff" as const,
    email: row.email.trim(),
    expiresAt: new Date(row.expires_at).toISOString(),
    firstName: null,
    tenantName: row.tenant_name?.trim() ?? null,
    /** Hint for clients: which query param was used (staff uses `staff_invite`). */
    queryParam: STAFF_INVITE_QUERY_PARAM,
  });
}
