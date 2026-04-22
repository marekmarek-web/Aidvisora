/**
 * Phase 3E/3F — Payment setup visibility tiers for advisor API and regression tests.
 *
 * Phase 3 / Slice 1 update: client portal now reads from both client_payment_setups
 * (status='active', needsHumanReview=false) and legacy payment_accounts.
 * The canonical payment read layer (canonical-payment-read.ts) unifies both sources.
 */

export type PaymentSetupClientVisibility = "advisor_ready" | "client_visible" | "draft_only" | "hidden";

/**
 * B2.10 — maps DB state on `client_payment_setups` to explicit visibility tier.
 *
 * Truth matrix:
 * - `status==='active'` AND `!needsHumanReview` AND `visibleToClient===true` → `client_visible`
 *   (portal and analytics treat as live for the client).
 * - `status==='active'` AND (`needsHumanReview` OR `visibleToClient===false`) → `advisor_ready`
 *   (CRM/advisor side is ready, but the client must NOT see it yet).
 * - `status` in ('review_required', 'draft') → `draft_only`.
 * - Anything else (archived/unknown) → `hidden`.
 *
 * Historically `needsHumanReview === false` alone was enough to flip to `client_visible`,
 * which caused the client-portal "portalReady" analytics to diverge from what the portal
 * actually renders (the portal reads `visibleToClient` too). Callers that don't know the
 * flag yet (legacy route) stay on `advisor_ready`.
 */
export function resolvePaymentSetupClientVisibility(
  status: string,
  needsHumanReview?: boolean,
  visibleToClient?: boolean,
): PaymentSetupClientVisibility {
  if (status === "active") {
    const portalReady =
      needsHumanReview === false && visibleToClient === true;
    return portalReady ? "client_visible" : "advisor_ready";
  }
  if (status === "review_required") return "draft_only";
  if (status === "draft") return "draft_only";
  return "hidden";
}
