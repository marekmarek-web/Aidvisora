import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/auth/get-membership";
import { getBillingReturnUrls, parseBillingContext } from "@/lib/stripe/billing-return-paths";
import {
  getLegacyStripePriceId,
  getPriceIdForTierInterval,
  getTrialPeriodDays,
  hasAnyMultiTierPrice,
  parsePlanInterval,
  parsePlanTier,
  planLabelCs,
} from "@/lib/stripe/price-catalog";
import { getStripe, isStripeCheckoutAvailable } from "@/lib/stripe/server";
import { db, tenants, eq } from "db";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

function canManageWorkspaceBilling(roleName: string) {
  return roleName === "Admin" || roleName === "Director";
}

export async function POST(request: Request) {
  if (!isStripeCheckoutAvailable()) {
    return NextResponse.json(
      {
        error:
          "Stripe předplatné není nakonfigurováno (STRIPE_SECRET_KEY a STRIPE_PRICE_ID nebo STRIPE_PRICE_*_*).",
      },
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

  const body = (await request.json().catch(() => ({}))) as {
    billingContext?: unknown;
    tier?: unknown;
    interval?: unknown;
    legalAcknowledged?: unknown;
  };
  if (body.legalAcknowledged !== true) {
    return NextResponse.json(
      { error: "Před zahájením předplatného potvrďte souhlas s právními dokumenty." },
      { status: 400 }
    );
  }
  const billingContext = parseBillingContext(body.billingContext);
  const tier = parsePlanTier(body.tier);
  const interval = parsePlanInterval(body.interval);

  const legacy = getLegacyStripePriceId();
  const multi = hasAnyMultiTierPrice();

  let priceId: string | null = null;
  let subscriptionMetadata: Record<string, string> = {
    tenant_id: m.tenantId,
    checkout_legal_ack: "1",
  };

  if (multi) {
    if (!tier || !interval) {
      return NextResponse.json(
        { error: "Vyberte tarif a fakturační období (měsíčně / ročně)." },
        { status: 400 }
      );
    }
    priceId = getPriceIdForTierInterval(tier, interval);
    if (!priceId) {
      return NextResponse.json(
        { error: "Tato kombinace tarifu není na serveru nastavená (chybí příslušná STRIPE_PRICE_* env)." },
        { status: 400 }
      );
    }
    subscriptionMetadata = {
      ...subscriptionMetadata,
      plan_tier: tier,
      plan_interval: interval,
      plan_label: planLabelCs(tier, interval),
    };
  } else if (legacy) {
    priceId = legacy;
  } else {
    return NextResponse.json(
      { error: "Nastavte STRIPE_PRICE_ID nebo sadu STRIPE_PRICE_*_* proměnných." },
      { status: 400 }
    );
  }

  try {
    const [tenantRow] = await db
      .select({ stripeCustomerId: tenants.stripeCustomerId })
      .from(tenants)
      .where(eq(tenants.id, m.tenantId))
      .limit(1);
    const stripeCustomerId = tenantRow?.stripeCustomerId ?? null;

    const appBase = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const { successUrl, cancelUrl } = getBillingReturnUrls(appBase, billingContext);
    const stripe = getStripe();

    const trialDays = getTrialPeriodDays();

    const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
      metadata: subscriptionMetadata,
    };
    if (trialDays > 0) {
      subscriptionData.trial_period_days = trialDays;
    }

    const params: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: m.tenantId,
      metadata: { tenant_id: m.tenantId },
      subscription_data: subscriptionData,
    };

    if (stripeCustomerId) {
      params.customer = stripeCustomerId;
    } else {
      if (user.email) params.customer_email = user.email;
      params.customer_creation = "always";
    }

    const session = await stripe.checkout.sessions.create(params);
    if (!session.url) {
      return NextResponse.json({ error: "Chybí URL checkout relace." }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    console.error("[api/stripe/checkout]", err);
    if (err instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        {
          error:
            "Platební brána odmítla požadavek. Zkontrolujte STRIPE_SECRET_KEY a ID cen (test/live), případně stav cen ve Stripe.",
          detail: err.message,
        },
        { status: 502 }
      );
    }
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return NextResponse.json(
      { error: "Nepodařilo se vytvořit platební relaci. Zkuste to znovu." },
      { status: 500 }
    );
  }
}
