import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const { searchParams } = url;
    const origin = url.origin;
    const code = searchParams.get("code");
    const errorCode = searchParams.get("error_code");
    const errorDesc = searchParams.get("error_description");
    const next = searchParams.get("next") ?? "/register/complete";

    if (errorCode === "otp_expired" || errorDesc?.includes("expired")) {
      return NextResponse.redirect(`${origin}/?error=otp_expired`);
    }
    if (errorCode || errorDesc) {
      return NextResponse.redirect(`${origin}/?error=${encodeURIComponent(errorDesc || errorCode || "auth_failed")}`);
    }

    if (code) {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        return NextResponse.redirect(`${origin}/?error=${encodeURIComponent(error.message)}`);
      }
    }

    return NextResponse.redirect(`${origin}${next.startsWith("/") ? next : "/" + next}`);
  } catch (e) {
    const origin = request.url ? new URL(request.url).origin : "https://localhost:3000";
    const msg = e instanceof Error ? e.message : "Přihlášení selhalo.";
    return NextResponse.redirect(`${origin}/?error=${encodeURIComponent(msg)}`);
  }
}
