import { NextResponse } from "next/server";
import { db, clientInvitations, contacts, staffInvitations, tenants, eq, and, gt, isNull } from "db";
import { getClientIp, rateLimitByKey } from "@/lib/rate-limit-ip";
import { parseClientInviteTokenFromUrl } from "@/lib/auth/client-invite-url";
import { parseStaffInviteTokenFromUrl, STAFF_INVITE_QUERY_PARAM } from "@/lib/auth/staff-invite-url";

export const dynamic = "force-dynamic";

/**
 * Public metadata for a valid pending invite (prefill e-mail on /prihlaseni).
 * Supports client zone (`client_invite` / legacy `token`) and team (`staff_invite`).
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

  if (clientToken !== null) {
    const rows = await db
      .select({
        email: clientInvitations.email,
        expiresAt: clientInvitations.expiresAt,
        firstName: contacts.firstName,
      })
      .from(clientInvitations)
      .innerJoin(contacts, eq(clientInvitations.contactId, contacts.id))
      .where(
        and(
          eq(clientInvitations.token, clientToken),
          gt(clientInvitations.expiresAt, new Date()),
          isNull(clientInvitations.acceptedAt),
          isNull(clientInvitations.revokedAt),
        ) as any,
      )
      .limit(1);

    const row = rows[0];
    if (!row) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      kind: "client" as const,
      email: row.email.trim(),
      expiresAt: row.expiresAt.toISOString(),
      firstName: row.firstName?.trim() ?? null,
    });
  }

  if (staffToken === null) {
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 400 });
  }

  const staffRows = await db
    .select({
      email: staffInvitations.email,
      expiresAt: staffInvitations.expiresAt,
      tenantName: tenants.name,
    })
    .from(staffInvitations)
    .innerJoin(tenants, eq(staffInvitations.tenantId, tenants.id))
    .where(
      and(
        eq(staffInvitations.token, staffToken),
        gt(staffInvitations.expiresAt, new Date()),
        isNull(staffInvitations.acceptedAt),
        isNull(staffInvitations.revokedAt),
      ),
    )
    .limit(1);

  const srow = staffRows[0];
  if (!srow) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    kind: "staff" as const,
    email: srow.email.trim(),
    expiresAt: srow.expiresAt.toISOString(),
    firstName: null,
    tenantName: srow.tenantName?.trim() ?? null,
    /** Hint for clients: which query param was used (staff uses `staff_invite`). */
    queryParam: STAFF_INVITE_QUERY_PARAM,
  });
}
