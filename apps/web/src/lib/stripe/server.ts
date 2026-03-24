import "server-only";

import Stripe from "stripe";
import { isCheckoutEnvironmentReady } from "./price-catalog";

let stripeSingleton: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  if (!stripeSingleton) {
    stripeSingleton = new Stripe(key);
  }
  return stripeSingleton;
}

/** Checkout Session – secret + legacy STRIPE_PRICE_ID nebo aspoň jedna multi-cena. */
export function isStripeCheckoutAvailable(): boolean {
  return isCheckoutEnvironmentReady();
}

/** Customer Portal (stačí secret + existující Stripe Customer na tenantovi). */
export function isStripePortalAvailable(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}
