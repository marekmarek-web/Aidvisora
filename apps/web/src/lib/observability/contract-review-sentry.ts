import * as Sentry from "@sentry/nextjs";

/**
 * Breadcrumbs + light Sentry signals for AI Review apply / payment gate failures.
 * Safe no-op if Sentry throws.
 */

export function breadcrumbContractReviewApplyFailure(ctx: {
  reviewId: string;
  tenantId?: string;
  error: string;
}): void {
  try {
    Sentry.addBreadcrumb({
      category: "contract_review.apply",
      type: "error",
      level: "error",
      message: "apply_contract_review_failed",
      data: {
        reviewId: ctx.reviewId.slice(0, 36),
        tenantId: ctx.tenantId?.slice(0, 36),
        error: ctx.error.slice(0, 500),
      },
    });
  } catch {
    /* ignore */
  }
}

export function captureContractReviewApplyFailure(ctx: {
  reviewId: string;
  tenantId?: string;
  error: string;
}): void {
  try {
    breadcrumbContractReviewApplyFailure(ctx);
    Sentry.withScope((scope) => {
      scope.setTag("feature", "contract_review_apply");
      scope.setFingerprint(["contract-review-apply-failure", ctx.error.slice(0, 80)]);
      if (ctx.tenantId) scope.setTag("tenant_id", ctx.tenantId.slice(0, 36));
      scope.setContext("contract_review_apply", {
        reviewId: ctx.reviewId,
        error: ctx.error.slice(0, 2000),
      });
      Sentry.captureMessage(`contract_review_apply: ${ctx.error.slice(0, 200)}`, "warning");
    });
  } catch {
    /* ignore */
  }
}

/**
 * Smlouva označená jako ai_review bez vazby na review řádek — data k doplnění nebo migraci.
 */
export function breadcrumbContractAiReviewMissingSourceReview(ctx: {
  contactId: string;
  orphanCount: number;
}): void {
  try {
    Sentry.addBreadcrumb({
      category: "contract.provenance",
      type: "default",
      level: "warning",
      message: "ai_review_contract_missing_source_contract_review_id",
      data: {
        contactId: ctx.contactId.slice(0, 36),
        orphanCount: ctx.orphanCount,
      },
    });
  } catch {
    /* ignore */
  }
}

export function breadcrumbContractReviewPaymentGate(ctx: {
  reviewId: string;
  blockedReasons: string[];
  hadOverride?: boolean;
}): void {
  try {
    const paymentRelated = ctx.blockedReasons.filter(
      (r) => r.startsWith("PAYMENT_") || r.includes("payment")
    );
    Sentry.addBreadcrumb({
      category: "contract_review.payment_gate",
      type: "default",
      level: paymentRelated.length > 0 ? "warning" : "info",
      message: "apply_blocked_by_gate",
      data: {
        reviewId: ctx.reviewId.slice(0, 36),
        blockedReasons: ctx.blockedReasons.slice(0, 20),
        paymentRelatedCount: paymentRelated.length,
        hadOverride: ctx.hadOverride ?? false,
      },
    });
  } catch {
    /* ignore */
  }
}
