/**
 * Phase 3E/3F — Payment setup visibility tiers for advisor API and regression tests.
 * Client portal legacy path still uses contracts → payment_accounts until Phase 5.
 */

export type PaymentSetupClientVisibility = "advisor_ready" | "client_visible" | "draft_only" | "hidden";

/**
 * Maps DB status on client_payment_setups to an explicit visibility tier.
 * Phase 5: use `client_visible` when exposing setups in the client portal.
 */
export function resolvePaymentSetupClientVisibility(
  status: string
): PaymentSetupClientVisibility {
  if (status === "active") return "advisor_ready";
  if (status === "review_required") return "draft_only";
  if (status === "draft") return "draft_only";
  return "hidden";
}
