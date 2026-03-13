import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Diagnostický endpoint: vrací jen to, co route obdržela v request headers.
 * Nepřistupuje k DB ani k Supabase auth.
 * GET /api/contracts/debug-auth
 */
export async function GET(request: Request) {
  const url = request.url;
  const path = new URL(url).pathname;
  const method = request.method;
  const hasDebugMwHeader = request.headers.get("x-debug-mw") === "1";
  const debugPath = request.headers.get("x-debug-path");
  const userIdFromHeader = request.headers.get("x-user-id");

  const body = {
    ok: true,
    path,
    method,
    hasDebugMwHeader,
    debugPath,
    userIdFromHeader: userIdFromHeader ? `${userIdFromHeader.slice(0, 8)}…` : null,
  };

  return NextResponse.json(body);
}
