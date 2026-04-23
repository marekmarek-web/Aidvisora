"use client";

/**
 * iOS push runtime path (unified FCM architecture, 2026-04-23).
 *
 * Plugin: `@capacitor-firebase/messaging`. Both iOS and Android register
 * with Firebase; the returned token is ALWAYS an FCM registration token
 * (not an APNs device token, not a Firebase client JWT). The backend
 * sender (`apps/web/src/lib/push/send.ts`) speaks FCM HTTP v1 and expects
 * exactly that shape, so client + server are now congruent.
 *
 * Pre-req for this to work on a real device:
 *   iOS:
 *     - `apps/web/ios/App/App/GoogleService-Info.plist` present at build time
 *     - APNs .p8 auth key uploaded to Firebase console (for APNs → FCM relay)
 *     - `aps-environment` entitlement (production in release)
 *     - `FirebaseApp.configure()` called in AppDelegate (done)
 *   Android (v1.1+):
 *     - `apps/web/android/app/google-services.json` present at build time
 *     - still gated via `isSupportedPlatform` below until release-v1-decisions is flipped
 */
import { Capacitor } from "@capacitor/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FirebaseMessaging,
  type Notification as FirebaseMessagingNotification,
  type NotificationActionPerformedEvent as FirebaseMessagingActionPerformedEvent,
  type TokenReceivedEvent as FirebaseMessagingTokenReceivedEvent,
} from "@capacitor-firebase/messaging";
import { retryFetch } from "@/lib/network/retry";

const PUSH_PROMPT_STORAGE_KEY = "aidvisor.push.soft-prompt.seen";
const PUSH_TOKEN_STORAGE_KEY = "aidvisor.push.token";

export type PushPermissionState = "prompt" | "prompt-with-rationale" | "granted" | "denied";

/** Structural shape compatible with the old `@capacitor/push-notifications` callback payloads. */
export type PushNotificationReceivedPayload = {
  title?: string;
  body?: string;
  data?: Record<string, unknown> | null;
};

/** Structural shape compatible with the old `ActionPerformed` callback payloads. */
export type PushNotificationActionPayload = {
  actionId?: string;
  notification: PushNotificationReceivedPayload;
};

export type UsePushNotificationsOptions = {
  onPushNotificationReceived?: (notification: PushNotificationReceivedPayload) => void;
  onPushNotificationActionPerformed?: (action: PushNotificationActionPayload) => void;
};

async function registerTokenOnBackend(token: string, platform: "ios" | "android") {
  await retryFetch("/api/push/devices", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      pushToken: token,
      platform,
    }),
  }).catch(() => {});
}

async function revokeTokenOnBackend(token: string) {
  await retryFetch("/api/push/devices", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pushToken: token }),
  }).catch(() => {});
}

async function revokeAllTokensOnBackend() {
  await retryFetch("/api/push/devices", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ allDevices: true }),
  }).catch(() => {});
}

export async function revokeStoredPushToken() {
  if (typeof window === "undefined") return;
  const token = localStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
  if (!token) return;
  await revokeTokenOnBackend(token);
  localStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
}

export async function revokeAllStoredPushTokens() {
  if (typeof window === "undefined") return;
  await revokeAllTokensOnBackend();
  localStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
}

function mapFirebaseNotification(notification: FirebaseMessagingNotification): PushNotificationReceivedPayload {
  return {
    title: notification.title ?? undefined,
    body: notification.body ?? undefined,
    data: (notification.data ?? null) as Record<string, unknown> | null,
  };
}

export function usePushNotifications(options: UsePushNotificationsOptions = {}) {
  const [permissionState, setPermissionState] = useState<PushPermissionState>("prompt");
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const registrationRequestedRef = useRef(false);
  const onReceivedRef = useRef(options.onPushNotificationReceived);
  const onActionRef = useRef(options.onPushNotificationActionPerformed);

  useEffect(() => {
    onReceivedRef.current = options.onPushNotificationReceived;
    onActionRef.current = options.onPushNotificationActionPerformed;
  }, [options.onPushNotificationReceived, options.onPushNotificationActionPerformed]);

  const isNative = useMemo(() => Capacitor.isNativePlatform(), []);
  const platform = useMemo(() => Capacitor.getPlatform(), []);
  // v1.0 release scope: push on Android is still gated until we ship
  // `apps/web/android/app/google-services.json`. FirebaseMessaging on Android
  // without that file would crash on register. For v1.1, drop this gate and
  // add the file. See docs/release-v1-decisions.md.
  const isSupportedPlatform = platform === "ios";
  const isSupported = isNative && isSupportedPlatform;

  const markSoftPromptSeen = useCallback(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(PUSH_PROMPT_STORAGE_KEY, "1");
  }, []);

  const hasSeenSoftPrompt = useMemo(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(PUSH_PROMPT_STORAGE_KEY) === "1";
  }, []);

  const syncPermissions = useCallback(async () => {
    if (!isSupported) return;
    try {
      const status = await FirebaseMessaging.checkPermissions();
      setPermissionState(status.receive);
    } catch (e) {
      console.error("[push] checkPermissions failed", e);
      setPermissionState("prompt");
    }
  }, [isSupported]);

  const requestSystemPermission = useCallback(async () => {
    if (!isSupported) return;
    markSoftPromptSeen();
    try {
      const status = await FirebaseMessaging.requestPermissions();
      setPermissionState(status.receive);
    } catch (e) {
      console.error("[push] requestPermissions failed", e);
      setError(e instanceof Error ? e.message : "Oprávnění k oznámením se nepodařilo vyžádat.");
    }
  }, [isSupported, markSoftPromptSeen]);

  /**
   * FirebaseMessaging.getToken() triggers the native APNs/FCM registration
   * flow and returns the FCM registration token. On iOS the plugin handles
   * `UIApplication.shared.registerForRemoteNotifications()` internally; we
   * just need APNs permission to be granted first.
   */
  const registerForPush = useCallback(async () => {
    if (!isSupported) return;
    registrationRequestedRef.current = true;
    try {
      const result = await FirebaseMessaging.getToken();
      const tokenValue = result.token;
      if (!tokenValue) {
        setError("Push token nelze získat.");
        return;
      }
      setToken(tokenValue);
      setError(null);
      localStorage.setItem(PUSH_TOKEN_STORAGE_KEY, tokenValue);
      if (platform === "ios" || platform === "android") {
        void registerTokenOnBackend(tokenValue, platform);
      }
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      const message =
        /FirebaseApp|not.*configured|GoogleService-Info/i.test(raw)
          ? "Push nelze aktivovat (Firebase není nakonfigurován). Ověř, že GoogleService-Info.plist je součástí buildu — viz docs/runbook-push.md."
          : raw || "Push registrace selhala.";
      setError(message);
      console.error("[push] FirebaseMessaging.getToken failed", e);
    }
  }, [isSupported, platform]);

  useEffect(() => {
    if (!isSupported) return;
    void syncPermissions();

    let cancelled = false;
    const handles: Array<{ remove: () => void | Promise<void> }> = [];

    const setupListeners = async () => {
      async function addListenerSafe<T extends { remove: () => void | Promise<void> }>(
        label: string,
        add: () => Promise<T>
      ): Promise<T | null> {
        try {
          return await add();
        } catch (e) {
          console.error(`[push] addListener(${label}) failed`, e);
          return null;
        }
      }

      const onTokenReceived = await addListenerSafe("tokenReceived", () =>
        FirebaseMessaging.addListener(
          "tokenReceived",
          (event: FirebaseMessagingTokenReceivedEvent) => {
            const tokenValue = event.token;
            if (!tokenValue) return;
            setToken(tokenValue);
            setError(null);
            localStorage.setItem(PUSH_TOKEN_STORAGE_KEY, tokenValue);
            if (platform === "ios" || platform === "android") {
              void registerTokenOnBackend(tokenValue, platform);
            }
          }
        )
      );

      const onNotificationReceived = await addListenerSafe("notificationReceived", () =>
        FirebaseMessaging.addListener("notificationReceived", (event) => {
          onReceivedRef.current?.(mapFirebaseNotification(event.notification));
        })
      );

      const onNotificationAction = await addListenerSafe("notificationActionPerformed", () =>
        FirebaseMessaging.addListener(
          "notificationActionPerformed",
          (event: FirebaseMessagingActionPerformedEvent) => {
            onActionRef.current?.({
              actionId: event.actionId ?? undefined,
              notification: mapFirebaseNotification(event.notification),
            });
          }
        )
      );

      const registered = [onTokenReceived, onNotificationReceived, onNotificationAction].filter(
        Boolean
      ) as Array<{ remove: () => void | Promise<void> }>;

      if (cancelled) {
        await Promise.all(registered.map((h) => Promise.resolve(h.remove())));
        return;
      }

      if (registered.length === 0) {
        setError("Push plugin není k dispozici nebo se nepodařilo navázat posluchače.");
        return;
      }

      handles.push(...registered);
    };

    void setupListeners();

    return () => {
      cancelled = true;
      for (const h of handles) {
        try {
          void h.remove();
        } catch (removeErr) {
          console.error("[push] listener remove failed", removeErr);
        }
      }
    };
  }, [isSupported, platform, syncPermissions]);

  useEffect(() => {
    if (!isSupported) return;
    if (permissionState !== "granted") return;
    if (registrationRequestedRef.current) return;
    void registerForPush();
  }, [isSupported, permissionState, registerForPush]);

  const isPermissionDenied = permissionState === "denied";
  const shouldShowSoftPrompt = isSupported && !hasSeenSoftPrompt && permissionState !== "granted";

  return {
    isSupported,
    permissionState,
    token,
    error,
    isPermissionDenied,
    shouldShowSoftPrompt,
    hasSeenSoftPrompt,
    markSoftPromptSeen,
    requestSystemPermission,
    syncPermissions,
    registerForPush,
  };
}
