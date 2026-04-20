import { NextResponse } from "next/server";
import {
  isKnownPromoCode,
  PROMO_CODE_COOKIE,
  PROMO_CODE_COOKIE_MAX_AGE_SECONDS,
} from "@/lib/stripe/promo-codes-shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ code: string }> };

/**
 * GET /invite/[code]
 *
 * Vstupní bod pro distribuované promo odkazy (např. Premium Brokers kohorta).
 * Neznámé kódy tiše redirectneme na `/`, abychom nevystavovali brute-force
 * ověřování Stripe Promotion Codes. Validní whitelisted kód nastavíme jako
 * běžnou (ne-HttpOnly) cookie — chceme, aby UI badge ve workspace billingu
 * mohlo kód přečíst a ukázat „sleva je připravena". Vlastní aplikace slevy
 * se děje serverově v `/api/stripe/checkout`, kde se kód znovu validuje proti
 * whitelistu i Stripe API.
 */
export async function GET(request: Request, ctx: RouteContext) {
  const { code } = await ctx.params;
  const normalized = code.trim().toUpperCase();

  const origin = new URL(request.url).origin;
  const appBase = process.env.NEXT_PUBLIC_APP_URL?.trim() || origin;

  if (!isKnownPromoCode(normalized)) {
    return NextResponse.redirect(new URL("/", appBase));
  }

  const redirectUrl = new URL("/", appBase);
  redirectUrl.searchParams.set("promo_applied", normalized);

  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set(PROMO_CODE_COOKIE, normalized, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: PROMO_CODE_COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });
  return response;
}
