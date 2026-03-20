import { NextResponse } from "next/server";
import { getCalendarAuth } from "../../calendar/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authResult = await getCalendarAuth(request, { requireWrite: false });
  if (!authResult.ok) {
    return NextResponse.json({ connected: false, fromEmail: null });
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim() ?? null;

  return NextResponse.json({
    connected: !!apiKey,
    fromEmail,
  });
}
