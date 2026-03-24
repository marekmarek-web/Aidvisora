export type PlanTier = "starter" | "pro" | "team";
export type PlanInterval = "month" | "year";

export type CheckoutCatalogSnapshot = {
  /** Zapnutý STRIPE_PRICE_ID (jedna cena bez výběru tarifu). */
  legacySingle: boolean;
  /** True, pokud je nastavená aspoň jedna z STRIPE_PRICE_*_* proměnných. */
  useTierPicker: boolean;
  tiers: Array<{ tier: PlanTier; month: boolean; year: boolean }>;
  trialPeriodDays: number;
};

export type WorkspaceBillingSnapshot = {
  checkoutAvailable: boolean;
  portalAvailable: boolean;
  stripeCustomerId: string | null;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  plan: string | null;
  canManage: boolean;
  checkoutCatalog: CheckoutCatalogSnapshot;
};

export type StripeBillingContext = "profile" | "setup";

export function emptyCheckoutCatalog(): CheckoutCatalogSnapshot {
  return {
    legacySingle: false,
    useTierPicker: false,
    tiers: [
      { tier: "starter", month: false, year: false },
      { tier: "pro", month: false, year: false },
      { tier: "team", month: false, year: false },
    ],
    trialPeriodDays: 14,
  };
}
