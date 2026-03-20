import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Legacy OAuth start path. Redirect to the canonical integrations connect endpoint
 * so all Google Calendar OAuth uses one flow (integrations).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  return NextResponse.redirect(`${origin}/api/integrations/google-calendar/connect`);
}
