import * as Sentry from "@sentry/nextjs";

/**
 * Phase 6H — Sentry instrumentation for portal (Phase 5/6) flows.
 *
 * Covers:
 * - notification delivery failures (createPortalNotification, push)
 * - request reply failures (respondClientMaterialRequest)
 * - attachment linking failures (linkMaterialRequestDocumentToClientVault)
 * - publish guard failures (applyContractReview, linkContractReviewFileToContactDocuments)
 * - auth guard mismatches (requireClientZoneAuth unexpected failures)
 *
 * All helpers are safe no-ops if Sentry throws (init race, DSN missing).
 * Always slice IDs to 36 chars and messages to 500 chars before sending.
 */

function safe(fn: () => void): void {
  try {
    fn();
  } catch {
    /* ignore — Sentry must never crash the action */
  }
}

// ─── Notification delivery ────────────────────────────────────────────────────

export function captureNotificationDeliveryFailure(ctx: {
  tenantId: string;
  contactId: string;
  type: string;
  relatedEntityId?: string | null;
  error: unknown;
}): void {
  safe(() => {
    const err = ctx.error instanceof Error ? ctx.error : new Error(String(ctx.error));
    Sentry.withScope((scope) => {
      scope.setTag("feature", "portal_notification_delivery");
      scope.setTag("tenant_id", ctx.tenantId.slice(0, 36));
      scope.setTag("notification_type", ctx.type.slice(0, 64));
      scope.setFingerprint(["portal-notification-delivery-failure", ctx.type]);
      scope.setContext("portal_notification", {
        tenantId: ctx.tenantId,
        contactId: ctx.contactId,
        type: ctx.type,
        relatedEntityId: ctx.relatedEntityId ?? null,
        error: err.message.slice(0, 500),
      });
      Sentry.captureException(err);
    });
  });
}

// ─── Request reply ────────────────────────────────────────────────────────────

export function captureRequestReplyFailure(ctx: {
  tenantId: string;
  contactId: string;
  requestId: string;
  reason: string;
  error?: unknown;
}): void {
  safe(() => {
    const err =
      ctx.error instanceof Error ? ctx.error : new Error(ctx.reason);
    Sentry.withScope((scope) => {
      scope.setTag("feature", "material_request_reply");
      scope.setTag("tenant_id", ctx.tenantId.slice(0, 36));
      scope.setFingerprint(["material-request-reply-failure", ctx.reason.slice(0, 80)]);
      scope.setContext("request_reply", {
        tenantId: ctx.tenantId,
        contactId: ctx.contactId,
        requestId: ctx.requestId,
        reason: ctx.reason.slice(0, 500),
      });
      Sentry.captureException(err);
    });
  });
}

// ─── Attachment linking ───────────────────────────────────────────────────────

export function captureAttachmentLinkFailure(ctx: {
  tenantId: string;
  requestId: string;
  documentId?: string | null;
  reason: string;
  error?: unknown;
}): void {
  safe(() => {
    const err =
      ctx.error instanceof Error ? ctx.error : new Error(ctx.reason);
    Sentry.withScope((scope) => {
      scope.setTag("feature", "material_request_attachment_link");
      scope.setTag("tenant_id", ctx.tenantId.slice(0, 36));
      scope.setFingerprint(["attachment-link-failure", ctx.reason.slice(0, 80)]);
      scope.setContext("attachment_link", {
        tenantId: ctx.tenantId,
        requestId: ctx.requestId,
        documentId: ctx.documentId ?? null,
        reason: ctx.reason.slice(0, 500),
      });
      Sentry.captureException(err);
    });
  });
}

// ─── Publish guard ────────────────────────────────────────────────────────────

export function capturePublishGuardFailure(ctx: {
  tenantId: string;
  reviewId?: string | null;
  contractId?: string | null;
  documentId?: string | null;
  contactId?: string | null;
  reason: string;
}): void {
  safe(() => {
    Sentry.withScope((scope) => {
      scope.setTag("feature", "portal_publish_guard");
      scope.setTag("tenant_id", ctx.tenantId.slice(0, 36));
      scope.setFingerprint(["publish-guard-failure", ctx.reason.slice(0, 80)]);
      scope.setContext("publish_guard", {
        tenantId: ctx.tenantId,
        reviewId: ctx.reviewId ?? null,
        contractId: ctx.contractId ?? null,
        documentId: ctx.documentId ?? null,
        contactId: ctx.contactId ?? null,
        reason: ctx.reason.slice(0, 500),
      });
      Sentry.captureMessage(
        `publish_guard: ${ctx.reason.slice(0, 200)}`,
        "warning"
      );
    });
  });
}

// ─── Auth guard mismatch ──────────────────────────────────────────────────────

export function captureAuthGuardMismatch(ctx: {
  action: string;
  tenantId?: string | null;
  userId?: string | null;
  reason: string;
  error?: unknown;
}): void {
  safe(() => {
    const err =
      ctx.error instanceof Error ? ctx.error : new Error(ctx.reason);
    Sentry.withScope((scope) => {
      scope.setTag("feature", "portal_auth_guard");
      scope.setTag("action", ctx.action.slice(0, 64));
      if (ctx.tenantId) scope.setTag("tenant_id", ctx.tenantId.slice(0, 36));
      scope.setFingerprint(["auth-guard-mismatch", ctx.action, ctx.reason.slice(0, 80)]);
      scope.setContext("auth_guard", {
        action: ctx.action,
        tenantId: ctx.tenantId ?? null,
        userId: ctx.userId ?? null,
        reason: ctx.reason.slice(0, 500),
      });
      Sentry.captureException(err);
    });
  });
}
