"use client";

import { Capacitor } from "@capacitor/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PushNotifications, type Token, type PushNotificationSchema, type ActionPerformed } from "@capacitor/push-notifications";
import { retryFetch } from "@/lib/network/retry";

const PUSH_PROMPT_STORAGE_KEY = "aidvisor.push.soft-prompt.seen";
const PUSH_TOKEN_STORAGE_KEY = "aidvisor.push.token";

export type PushPermissionState = "prompt" | "prompt-with-rationale" | "granted" | "denied";

export type UsePushNotificationsOptions = {
  onPushNotificationReceived?: (notification: PushNotificationSchema) => void;
  onPushNotificationActionPerformed?: (action: ActionPerformed) => void;
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
  const isSupportedPlatform = platform === "ios" || platform === "android";
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
      const status = await PushNotifications.checkPermissions();
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
      const status = await PushNotifications.requestPermissions();
      setPermissionState(status.receive);
    } catch (e) {
      console.error("[push] requestPermissions failed", e);
      setError(e instanceof Error ? e.message : "Oprávnění k oznámením se nepodařilo vyžádat.");
    }
  }, [isSupported, markSoftPromptSeen]);

  const registerForPush = useCallback(async () => {
    if (!isSupported) return;
    registrationRequestedRef.current = true;
    try {
      await PushNotifications.register();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Push registrace selhala.";
      setError(message);
      console.error("[push] register failed", e);
      // Keep registrationRequestedRef true so the "granted" effect does not retry in a tight loop
    }
  }, [isSupported]);

  useEffect(() => {
    if (!isSupported) return;
    void syncPermissions();

    let cancelled = false;
    const handles: Array<{ remove: () => void | Promise<void> }> = [];

    const setupListeners = async () => {
      try {
        const [
          onRegistration,
          onRegistrationError,
          onNotificationReceived,
          onNotificationAction,
        ] = await Promise.all([
          PushNotifications.addListener("registration", (newToken: Token) => {
            const tokenValue = newToken.value;
            setToken(tokenValue);
            setError(null);
            localStorage.setItem(PUSH_TOKEN_STORAGE_KEY, tokenValue);
            void registerTokenOnBackend(tokenValue, platform);
          }),
          PushNotifications.addListener("registrationError", (registrationError) => {
            setError(registrationError.error);
          }),
          PushNotifications.addListener("pushNotificationReceived", (notification) => {
            onReceivedRef.current?.(notification);
          }),
          PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
            onActionRef.current?.(action);
          }),
        ]);

        if (cancelled) {
          await Promise.all(
            [onRegistration, onRegistrationError, onNotificationReceived, onNotificationAction].map((h) =>
              typeof h.remove === "function" ? Promise.resolve(h.remove()) : Promise.resolve()
            )
          );
          return;
        }

        handles.push(onRegistration, onRegistrationError, onNotificationReceived, onNotificationAction);
      } catch (e) {
        console.error("[push] addListener setup failed", e);
        setError(e instanceof Error ? e.message : "Push plugin není k dispozici.");
      }
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
