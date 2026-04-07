import { describe, it, expect, vi, beforeEach } from "vitest";
import * as Sentry from "@sentry/nextjs";

vi.mock("@sentry/nextjs", () => {
  const addBreadcrumb = vi.fn();
  const captureMessage = vi.fn();
  return {
    addBreadcrumb,
    captureMessage,
    withScope: (fn: (scope: {
      setTag: ReturnType<typeof vi.fn>;
      setFingerprint: ReturnType<typeof vi.fn>;
      setContext: ReturnType<typeof vi.fn>;
    }) => void) =>
      fn({
        setTag: vi.fn(),
        setFingerprint: vi.fn(),
        setContext: vi.fn(),
      }),
  };
});

import {
  breadcrumbContractAiReviewMissingSourceReview,
  breadcrumbContractReviewApplyFailure,
  breadcrumbContractReviewPaymentGate,
  captureContractReviewApplyFailure,
} from "../contract-review-sentry";

describe("contract-review-sentry", () => {
  beforeEach(() => {
    vi.mocked(Sentry.addBreadcrumb).mockClear();
    vi.mocked(Sentry.captureMessage).mockClear();
  });

  it("adds breadcrumb on apply failure", () => {
    breadcrumbContractReviewApplyFailure({
      reviewId: "rev-uuid-1111",
      tenantId: "tenant-uuid",
      error: "DB transaction failed",
    });
    expect(Sentry.addBreadcrumb).toHaveBeenCalledTimes(1);
    const call = vi.mocked(Sentry.addBreadcrumb).mock.calls[0]![0] as {
      category: string;
      data: { reviewId: string };
    };
    expect(call.category).toBe("contract_review.apply");
    expect(call.data.reviewId).toBe("rev-uuid-1111");
  });

  it("captureContractReviewApplyFailure adds breadcrumb and captureMessage", () => {
    captureContractReviewApplyFailure({
      reviewId: "rev-2",
      error: "Nepodařilo se zapsat",
    });
    expect(Sentry.addBreadcrumb).toHaveBeenCalled();
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
  });

  it("breadcrumbContractAiReviewMissingSourceReview emits provenance warning", () => {
    breadcrumbContractAiReviewMissingSourceReview({
      contactId: "00000000-0000-4000-8000-000000000001",
      orphanCount: 2,
    });
    expect(Sentry.addBreadcrumb).toHaveBeenCalledTimes(1);
    const call = vi.mocked(Sentry.addBreadcrumb).mock.calls[0]![0] as {
      category: string;
      data: { contactId: string; orphanCount: number };
    };
    expect(call.category).toBe("contract.provenance");
    expect(call.data.orphanCount).toBe(2);
  });

  it("breadcrumbContractReviewPaymentGate records blocked reasons", () => {
    breadcrumbContractReviewPaymentGate({
      reviewId: "rev-3",
      blockedReasons: ["PAYMENT_MISSING_AMOUNT", "PAYMENT_MISSING_TARGET"],
    });
    expect(Sentry.addBreadcrumb).toHaveBeenCalledTimes(1);
    const data = (vi.mocked(Sentry.addBreadcrumb).mock.calls[0]![0] as { data: { paymentRelatedCount: number } })
      .data;
    expect(data.paymentRelatedCount).toBe(2);
  });
});
