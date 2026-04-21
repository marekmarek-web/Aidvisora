import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/auth/get-membership";
import { getBillingReturnUrls, parseBillingContext } from "@/lib/stripe/billing-return-paths";
import { getStripe, isStripePortalAvailable } from "@/lib/stripe/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { db, tenants, eq } from "db";

export const dynamic = "force-dynamic";

function canManageWorkspaceBilling(roleName: string) {
  return roleName === "Admin" || roleName === "Director";
}

export async function POST(request: Request) {
  if (!isStripePortalAvailable()) {
    return NextResponse.json(
      { error: "Stripe není nakonfigurováno (STRIPE_SECRET_KEY)." },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const m = await getMembership(user.id);
  if (!m) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageWorkspaceBilling(m.roleName)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // FL-1 rate limit — Stripe billing portal session create.
  const limiter = checkRateLimit(request, "stripe-portal", `${m.tenantId}:${user.id}`, {
    windowMs: 60_000,
    maxRequests: 10,
  });
  if (!limiter.ok) {
    return NextResponse.json(
      { error: "Příliš mnoho pokusů. Zkuste to za chvíli znovu." },
      { status: 429, headers: { "Retry-After": String(limiter.retryAfterSec) } },
    );
  }

  const [tenantRow] = await db
    .select({ stripeCustomerId: tenants.stripeCustomerId })
    .from(tenants)
    .where(eq(tenants.id, m.tenantId))
    .limit(1);
  const customerId = tenantRow?.stripeCustomerId?.trim();
  if (!customerId) {
    return NextResponse.json(
      { error: "Workspace nemá propojeného zákazníka ve Stripe. Nejprve dokončete předplatné přes checkout." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const billingContext = parseBillingContext(
    (body as { billingContext?: unknown }).billingContext
  );
  const appBase = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { portalReturnUrl } = getBillingReturnUrls(appBase, billingContext);

  try {
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: portalReturnUrl,
    });

    if (!session.url) {
      return NextResponse.json({ error: "Chybí URL billing portálu." }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    console.error("[api/stripe/portal]", err);
    if (err instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        {
          error: "Stripe portál není dostupný. Ověřte konfiguraci Customer Portalu a klíče ve Stripe.",
          detail: err.message,
        },
        { status: 502 }
      );
    }
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return NextResponse.json(
      { error: "Nepodařilo se otevřít billing portál. Zkuste to znovu." },
      { status: 500 }
    );
  }
}
