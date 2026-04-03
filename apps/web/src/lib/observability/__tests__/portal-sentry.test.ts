import { describe, it, expect, vi, beforeEach } from "vitest";
import * as Sentry from "@sentry/nextjs";

vi.mock("@sentry/nextjs", () => {
  const captureException = vi.fn();
  const captureMessage = vi.fn();
  return {
    captureException,
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
  captureNotificationDeliveryFailure,
  captureRequestReplyFailure,
  captureAttachmentLinkFailure,
  capturePublishGuardFailure,
  captureAuthGuardMismatch,
} from "../portal-sentry";

describe("portal-sentry — Phase 6H instrumentation", () => {
  beforeEach(() => {
    vi.mocked(Sentry.captureException).mockClear();
    vi.mocked(Sentry.captureMessage).mockClear();
  });

  describe("captureNotificationDeliveryFailure", () => {
    it("calls captureException with Error instance", () => {
      captureNotificationDeliveryFailure({
        tenantId: "t1",
        contactId: "c1",
        type: "advisor_material_request",
        relatedEntityId: "req-1",
        error: new Error("push failed"),
      });
      expect(Sentry.captureException).toHaveBeenCalledTimes(1);
      const err = vi.mocked(Sentry.captureException).mock.calls[0]![0] as Error;
      expect(err.message).toBe("push failed");
    });

    it("wraps non-Error values", () => {
      captureNotificationDeliveryFailure({
        tenantId: "t1",
        contactId: "c1",
        type: "new_document",
        error: "network timeout",
      });
      expect(Sentry.captureException).toHaveBeenCalledTimes(1);
      const err = vi.mocked(Sentry.captureException).mock.calls[0]![0] as Error;
      expect(err.message).toContain("network timeout");
    });

    it("is a no-op if Sentry throws internally", () => {
      vi.mocked(Sentry.captureException).mockImplementationOnce(() => { throw new Error("Sentry SDK not ready"); });
      expect(() => captureNotificationDeliveryFailure({
        tenantId: "t1", contactId: "c1", type: "new_message", error: new Error("push"),
      })).not.toThrow();
    });
  });

  describe("captureRequestReplyFailure", () => {
    it("captures exception with closed request reason", () => {
      captureRequestReplyFailure({
        tenantId: "t1",
        contactId: "c1",
        requestId: "req-closed",
        reason: 'respondClientMaterialRequest: request status="closed" is terminal',
      });
      expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    });
  });

  describe("captureAttachmentLinkFailure", () => {
    it("captures exception with document context", () => {
      captureAttachmentLinkFailure({
        tenantId: "t1",
        requestId: "req-1",
        documentId: "doc-1",
        reason: "upload failed",
        error: new Error("S3 error"),
      });
      expect(Sentry.captureException).toHaveBeenCalledTimes(1);
      const err = vi.mocked(Sentry.captureException).mock.calls[0]![0] as Error;
      expect(err.message).toBe("S3 error");
    });
  });

  describe("capturePublishGuardFailure", () => {
    it("emits warning via captureMessage", () => {
      capturePublishGuardFailure({
        tenantId: "t1",
        reviewId: "rev-1",
        reason: 'applyContractReview: reviewStatus="pending" is not approved',
      });
      expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
      const msg = vi.mocked(Sentry.captureMessage).mock.calls[0]![0] as string;
      expect(msg).toContain("publish_guard");
    });

    it("truncates reason to 200 chars in message", () => {
      const longReason = "x".repeat(500);
      capturePublishGuardFailure({ tenantId: "t1", reason: longReason });
      const msg = vi.mocked(Sentry.captureMessage).mock.calls[0]![0] as string;
      // prefix "publish_guard: " + 200 = 215 max
      expect(msg.length).toBeLessThanOrEqual(220);
    });
  });

  describe("captureAuthGuardMismatch", () => {
    it("captures exception for auth mismatch event", () => {
      captureAuthGuardMismatch({
        action: "respondClientMaterialRequest",
        tenantId: "t1",
        userId: "u1",
        reason: "roleName is Advisor not Client",
        error: new Error("Forbidden"),
      });
      expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    });
  });
});
