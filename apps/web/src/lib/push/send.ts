import "server-only";

import { GoogleAuth } from "google-auth-library";
import { and, clientContacts, eq, isNull, notificationLog, userDevices } from "db";
import * as Sentry from "@sentry/nextjs";
import { dbService, withServiceTenantContext } from "@/lib/db/service-db";
import { PushEventPayloadSchema, type PushEventPayload } from "./events";

const PUSH_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const FCM_BASE_URL = "https://fcm.googleapis.com/v1/projects";

type FcmServiceAccount = {
  client_email: string;
  private_key: string;
  project_id: string;
};

function isKillSwitchOn(): boolean {
  // Ops-level kill switch. Flip `PUSH_KILL_SWITCH=1` in Vercel env (or equivalent)
  // to stop ALL FCM calls instantly without redeploying app code. Used if a bad
  // backend config starts nuking tokens or if we need to pause delivery during
  // an incident. See docs/runbook-push.md.
  const raw = process.env.PUSH_KILL_SWITCH;
  if (!raw) return false;
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "on";
}

function getServiceAccount(): FcmServiceAccount | null {
  const raw = process.env.FCM_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as FcmServiceAccount;
    if (!parsed.client_email || !parsed.private_key || !parsed.project_id) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function getAccessToken(account: FcmServiceAccount): Promise<string | null> {
  const auth = new GoogleAuth({
    credentials: {
      client_email: account.client_email,
      private_key: account.private_key,
    },
    scopes: [PUSH_SCOPE],
  });

  const token = await auth.getAccessToken();
  return token ?? null;
}

function buildMessage(token: string, event: PushEventPayload) {
  return {
    message: {
      token,
      notification: {
        title: event.title,
        body: event.body,
      },
      data: {
        type: event.type,
        ...(event.data ?? {}),
      },
      android: {
        priority: "high",
      },
      apns: {
        headers: {
          "apns-priority": "10",
        },
      },
    },
  };
}

/**
 * FCM HTTP v1 error classification.
 *
 * We ONLY auto-revoke `user_devices` rows for errors that the FCM docs list as
 * permanent and uniquely identifying the device token itself
 * (https://firebase.google.com/docs/reference/fcm/rest/v1/ErrorCode).
 *
 * HISTORICAL NOTE: Before 2026-04-23 we also revoked on `INVALID_ARGUMENT`.
 * That was wrong: `INVALID_ARGUMENT` fires whenever FCM can't parse the
 * message envelope (e.g. during the APNs-token-vs-FCM-token mismatch bug that
 * silently wiped iOS device rows). Payload / config errors MUST NOT touch
 * `user_devices`. Keep this list narrow.
 */
function classifyFcmError(errorBody: string): "token_dead" | "transient" | "config" {
  // `UNREGISTERED` + `NOT_FOUND` = token is permanently invalid for this app.
  if (errorBody.includes("UNREGISTERED")) return "token_dead";
  if (errorBody.includes('"status": "NOT_FOUND"') || errorBody.includes('"status":"NOT_FOUND"'))
    return "token_dead";
  // Everything related to payload / auth / server is NOT the token's fault.
  if (errorBody.includes("INVALID_ARGUMENT")) return "config";
  if (errorBody.includes("SENDER_ID_MISMATCH")) return "config";
  if (errorBody.includes("THIRD_PARTY_AUTH_ERROR")) return "config";
  if (errorBody.includes("QUOTA_EXCEEDED")) return "transient";
  if (errorBody.includes("UNAVAILABLE")) return "transient";
  if (errorBody.includes("INTERNAL")) return "transient";
  return "transient";
}

/** Result for cron / callers that must know whether FCM actually delivered. */
export type PushToUserResult = {
  sent: number;
  failed: number;
  /** True when payload invalid, kill switch on, missing `FCM_SERVICE_ACCOUNT_JSON`, or token fetch failed — no HTTP calls made. */
  skipped: boolean;
};

export async function sendPushToUser(eventInput: PushEventPayload): Promise<PushToUserResult> {
  const eventParsed = PushEventPayloadSchema.safeParse(eventInput);
  if (!eventParsed.success) return { sent: 0, failed: 0, skipped: true };
  const event = eventParsed.data;

  if (isKillSwitchOn()) {
    Sentry.addBreadcrumb({
      category: "push",
      level: "warning",
      message: "push.kill_switch_active",
      data: { tenantId: event.tenantId, type: event.type },
    });
    return { sent: 0, failed: 0, skipped: true };
  }

  const account = getServiceAccount();
  if (!account) return { sent: 0, failed: 0, skipped: true };

  const accessToken = await getAccessToken(account);
  if (!accessToken) return { sent: 0, failed: 0, skipped: true };

  const devices = await withServiceTenantContext(
    { tenantId: event.tenantId, userId: event.userId },
    (tx) =>
      tx
        .select({
          pushToken: userDevices.pushToken,
          id: userDevices.id,
          platform: userDevices.platform,
        })
        .from(userDevices)
        .where(
          and(
            eq(userDevices.tenantId, event.tenantId),
            eq(userDevices.userId, event.userId),
            eq(userDevices.pushEnabled, true),
            isNull(userDevices.revokedAt),
          ),
        ),
  );

  if (devices.length === 0) {
    return { sent: 0, failed: 0, skipped: false };
  }

  let sent = 0;
  let failed = 0;

  for (const device of devices) {
    let finalStatus = "failed";
    let lastErrorBody = "";
    let lastHttpStatus = 0;
    let attempts = 0;
    const maxRetries = 1;

    while (attempts <= maxRetries) {
      const response = await fetch(`${FCM_BASE_URL}/${account.project_id}/messages:send`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(buildMessage(device.pushToken, event)),
        cache: "no-store",
      });

      if (response.ok) {
        finalStatus = "sent";
        break;
      }

      lastHttpStatus = response.status;
      lastErrorBody = await response.text().catch(() => "");
      const classification = classifyFcmError(lastErrorBody);

      if (classification === "token_dead") {
        try {
          await withServiceTenantContext(
            { tenantId: event.tenantId, userId: event.userId },
            (tx) =>
              tx
                .update(userDevices)
                .set({ revokedAt: new Date() })
                .where(eq(userDevices.id, device.id)),
          );
        } catch {
          // best-effort revoke
        }
        finalStatus = "token_revoked";
        break;
      }

      if (classification === "config") {
        // Payload / auth / sender mismatch. Do NOT revoke the device.
        // Surface loudly so we catch regressions of the APNs/FCM mismatch bug.
        Sentry.captureMessage("push.fcm.config_error", {
          level: "error",
          tags: {
            push_channel: "fcm",
            push_platform: device.platform,
            push_event_type: event.type,
            fcm_http_status: String(lastHttpStatus),
          },
          extra: {
            errorBodyHead: lastErrorBody.slice(0, 500),
            tenantId: event.tenantId,
            userId: event.userId,
            deviceId: device.id,
          },
        });
        finalStatus = "failed";
        break;
      }

      // transient
      attempts++;
      if (attempts <= maxRetries) {
        await new Promise((r) => setTimeout(r, 5_000));
      }
    }

    if (finalStatus === "failed" && lastHttpStatus !== 0) {
      Sentry.addBreadcrumb({
        category: "push",
        level: "warning",
        message: "push.fcm.transient_failure",
        data: {
          httpStatus: lastHttpStatus,
          errorBodyHead: lastErrorBody.slice(0, 200),
          platform: device.platform,
        },
      });
    }

    await withServiceTenantContext(
      { tenantId: event.tenantId, userId: event.userId },
      (tx) =>
        tx.insert(notificationLog).values({
          tenantId: event.tenantId,
          channel: "push",
          template: event.type,
          subject: event.title,
          recipient: device.pushToken,
          status: finalStatus,
          meta: {
            userId: event.userId,
            deviceId: device.id,
            platform: device.platform,
            attempts: attempts + 1,
            ...(finalStatus !== "sent" && lastHttpStatus
              ? { httpStatus: lastHttpStatus, errorBodyHead: lastErrorBody.slice(0, 500) }
              : {}),
          },
        }),
    );

    if (finalStatus === "sent") sent += 1;
    else failed += 1;
  }

  return { sent, failed, skipped: false };
}

export async function sendPushForPortalNotification(params: {
  tenantId: string;
  contactId: string;
  type:
    | "new_message"
    | "request_status_change"
    | "new_document"
    | "important_date"
    | "advisor_material_request";
  title: string;
  body?: string | null;
  relatedEntityId?: string | null;
}): Promise<void> {
  const recipients = await dbService
    .select({
      userId: clientContacts.userId,
    })
    .from(clientContacts)
    .where(and(eq(clientContacts.tenantId, params.tenantId), eq(clientContacts.contactId, params.contactId)));

  if (recipients.length === 0) return;

  const mappedType =
    params.type === "new_message"
      ? "NEW_MESSAGE"
      : params.type === "request_status_change"
        ? "REQUEST_STATUS_CHANGE"
        : params.type === "new_document"
          ? "NEW_DOCUMENT"
          : params.type === "advisor_material_request"
            ? "NEW_DOCUMENT"
            : "CLIENT_REQUEST";

  for (const recipient of recipients) {
    await sendPushToUser({
      type: mappedType,
      title: params.title,
      body: params.body ?? undefined,
      tenantId: params.tenantId,
      userId: recipient.userId,
      data: params.relatedEntityId ? { relatedEntityId: params.relatedEntityId } : undefined,
    });
  }
}
