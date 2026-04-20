import "server-only";

import type Stripe from "stripe";
import { getStripe } from "./server";

export {
  PREMIUM_BROKERS_PROMO_CODE,
  isKnownPromoCode,
  PROMO_CODE_COOKIE,
  PROMO_CODE_COOKIE_MAX_AGE_SECONDS,
  promoCodeDisplayLabel,
} from "./promo-codes-shared";

export type ResolvedPromotionCode = {
  /** Stripe PromotionCode id (`promo_…`) — posílá se do checkoutu. */
  id: string;
  /** Lidsky čitelný kód (např. PREMIUM-BROKERS-2026). */
  code: string;
  /** Coupon.id na pozadí PromotionCodu — logujeme pro audit / reporting. */
  couponId: string;
  /** Stručný popis slevy pro UI / audit log. */
  summary: string;
};

function summarizeCoupon(coupon: Stripe.Coupon): string {
  const parts: string[] = [];
  if (typeof coupon.percent_off === "number" && coupon.percent_off > 0) {
    parts.push(`${coupon.percent_off}% off`);
  } else if (typeof coupon.amount_off === "number" && coupon.amount_off > 0) {
    const currency = coupon.currency?.toUpperCase() ?? "";
    parts.push(`${(coupon.amount_off / 100).toFixed(2)} ${currency} off`);
  }
  if (coupon.duration === "repeating" && coupon.duration_in_months) {
    parts.push(`× ${coupon.duration_in_months} měs.`);
  } else if (coupon.duration === "once") {
    parts.push("jednorázově");
  } else if (coupon.duration === "forever") {
    parts.push("napořád");
  }
  return parts.length > 0 ? parts.join(" ") : "sleva";
}

/**
 * Vyhledá aktivní Stripe PromotionCode podle lidsky čitelného kódu.
 * Vrací `null`, pokud kód neexistuje nebo je neaktivní / expirovaný.
 * Nehodí — jen loguje; checkout pak pokračuje bez slevy.
 */
export async function resolvePromotionCode(
  raw: string,
): Promise<ResolvedPromotionCode | null> {
  const code = raw.trim().toUpperCase();
  if (!code) return null;

  try {
    const stripe = getStripe();
    const list = await stripe.promotionCodes.list({
      code,
      active: true,
      limit: 1,
      expand: ["data.coupon"],
    });
    const promo = list.data[0];
    if (!promo) return null;

    // Stripe API exposes `coupon` at the top level of PromotionCode; SDK v20
    // typings put it under `promotion.coupon`. Access defensively to cover both.
    const rawCoupon =
      (promo as unknown as { coupon?: Stripe.Coupon | string | null }).coupon ??
      (promo as unknown as { promotion?: { coupon?: Stripe.Coupon | string | null } })
        .promotion?.coupon ??
      null;

    const coupon =
      rawCoupon && typeof rawCoupon !== "string" ? (rawCoupon as Stripe.Coupon) : null;
    if (!coupon || !coupon.valid) return null;

    return {
      id: promo.id,
      code,
      couponId: coupon.id,
      summary: summarizeCoupon(coupon),
    };
  } catch (err) {
    console.error("[stripe/promo-codes] lookup failed", {
      code,
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
