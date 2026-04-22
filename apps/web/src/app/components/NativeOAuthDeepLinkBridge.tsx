"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

/*
 * Perf — na webu se tato komponenta renderuje na všech stránkách (včetně
 * anonymního marketingového landingu). Statické importy `@capacitor/app`,
 * `@capacitor/browser` a `@/lib/supabase/client` by tak táhly celý Supabase
 * JS klient a Capacitor pluginy do bundle landing page. Web `Capacitor.isNativePlatform()`
 * vždy vrátí `false`, takže veškerá skutečná práce je jen na iOS/Android – a tam
 * si ty moduly donačteme přes dynamic `import()` až když je potřebujeme.
 */

function logNativeOAuthDebug(...args: unknown[]) {
  if (process.env.NODE_ENV !== "development") return;
  console.log(...args);
}

const CONSUMED_CODE_KEY = "aidv.native_oauth.consumed_code";
const CONSUMED_CODE_OUTCOME_KEY = "aidv.native_oauth.consumed_code_outcome";

type ConsumedOutcome = { outcome: "ok" | "error"; message?: string };

function readConsumedCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(CONSUMED_CODE_KEY);
  } catch {
    return null;
  }
}

function writeConsumedCode(code: string, outcome: ConsumedOutcome) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CONSUMED_CODE_KEY, code);
    window.sessionStorage.setItem(CONSUMED_CODE_OUTCOME_KEY, JSON.stringify(outcome));
  } catch {
    /* ignore */
  }
}

function readConsumedOutcome(): ConsumedOutcome | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(CONSUMED_CODE_OUTCOME_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ConsumedOutcome;
  } catch {
    return null;
  }
}

function safeReplaceLocation(target: string) {
  if (typeof window === "undefined") return;
  if (typeof document !== "undefined" && document.visibilityState && document.visibilityState !== "visible") {
    logNativeOAuthDebug("[NativeOAuthDeepLinkBridge] skip navigate — document hidden:", target);
    return;
  }
  if (window.location.href === target) return;
  window.location.replace(target);
}

/**
 * Listens for deep-link events on native platforms and handles OAuth callback
 * flows. On web this is a strict no-op — `Capacitor.isNativePlatform()` returns
 * false and we never touch any heavy module.
 *
 * Mounted once in the root layout so it's always active on native.
 */
export function NativeOAuthDeepLinkBridge() {
  useEffect(() => {
    // Web no-op — neimportujeme žádnou knihovnu dokud nevíme, že jsme na nativní
    // platformě. Tím šetříme ~30 KB gzip (Supabase client + Capacitor pluginy).
    if (!Capacitor.isNativePlatform()) return;

    let disposed = false;
    let removeListener: (() => void) | null = null;
    let handlerInFlight = false;
    let lastHandledUrl = "";
    let lastHandledAt = 0;
    const DEDUPE_MS = 900;

    (async () => {
      // Dynamic import — tenhle kód poběží jen na iOS/Android WebView.
      const [{ App }, { Browser }, { createClient }, { getNativeWebAppBaseUrl }] = await Promise.all([
        import("@capacitor/app"),
        import("@capacitor/browser"),
        import("@/lib/supabase/client"),
        import("@/lib/url/native-web-app-base"),
      ]);

      const closeBrowserAndAwaitDismissed = async (): Promise<void> => {
        let handle: { remove: () => Promise<void> } | null = null;
        const finishedPromise = new Promise<void>((resolve) => {
          Browser.addListener("browserFinished", () => resolve())
            .then((h) => {
              handle = h;
            })
            .catch(() => resolve());
        });
        await Browser.close().catch(() => {});
        await Promise.race([
          finishedPromise,
          new Promise<void>((resolve) => setTimeout(resolve, 1200)),
        ]);
        try {
          await handle?.remove();
        } catch {}
      };

      const handleOpenUrl = async (rawUrl: string) => {
        if (disposed) return;
        const now = Date.now();
        if (rawUrl === lastHandledUrl && now - lastHandledAt < DEDUPE_MS) {
          logNativeOAuthDebug("[NativeOAuthDeepLinkBridge] skip duplicate URL within window");
          return;
        }
        if (handlerInFlight) {
          logNativeOAuthDebug("[NativeOAuthDeepLinkBridge] skip; previous handler still running");
          return;
        }
        handlerInFlight = true;
        logNativeOAuthDebug("[NativeOAuthDeepLinkBridge] received URL:", rawUrl);

        let parsed: URL;
        try {
          parsed = new URL(rawUrl);
        } catch {
          console.warn("[NativeOAuthDeepLinkBridge] failed to parse URL:", rawUrl);
          handlerInFlight = false;
          return;
        }

        if (parsed.protocol !== "aidvisor:" && parsed.protocol !== "aidvisora:") {
          handlerInFlight = false;
          return;
        }

        lastHandledUrl = rawUrl;
        lastHandledAt = Date.now();

        try {
          await closeBrowserAndAwaitDismissed();

          const origin = getNativeWebAppBaseUrl();
          logNativeOAuthDebug("[NativeOAuthDeepLinkBridge] resolved origin:", origin, "| window.location.origin:", typeof window !== "undefined" ? window.location.origin : "N/A");

          if (parsed.host === "auth" && parsed.pathname.startsWith("/callback")) {
            const code = parsed.searchParams.get("code");
            if (code) {
              const previousCode = readConsumedCode();
              if (previousCode === code) {
                const outcome = readConsumedOutcome();
                logNativeOAuthDebug(
                  "[NativeOAuthDeepLinkBridge] code already consumed, short-circuit:",
                  outcome?.outcome ?? "unknown",
                );
                if (outcome?.outcome === "ok") {
                  try {
                    const supabase = createClient();
                    const { data } = await supabase.auth.getSession();
                    if (data?.session) {
                      return;
                    }
                  } catch {}
                  safeReplaceLocation(`${origin}/portal/today`);
                } else if (outcome?.outcome === "error") {
                  safeReplaceLocation(
                    `${origin}/prihlaseni?error=${encodeURIComponent(outcome.message ?? "auth_failed")}`,
                  );
                }
                return;
              }

              try {
                const supabase = createClient();
                const { data: existing } = await supabase.auth.getSession();
                if (existing?.session) {
                  logNativeOAuthDebug(
                    "[NativeOAuthDeepLinkBridge] session already present, skipping exchange for stale launch URL code",
                  );
                  writeConsumedCode(code, { outcome: "ok" });
                  return;
                }
              } catch {}

              logNativeOAuthDebug("[NativeOAuthDeepLinkBridge] exchanging auth code…");
              try {
                const supabase = createClient();
                const { error } = await supabase.auth.exchangeCodeForSession(code);
                if (error) {
                  console.error("[NativeOAuthDeepLinkBridge] exchangeCodeForSession error:", error.message);
                  writeConsumedCode(code, { outcome: "error", message: error.message });
                  const target = `${origin}/prihlaseni?error=${encodeURIComponent(error.message)}`;
                  logNativeOAuthDebug("[NativeOAuthDeepLinkBridge] navigating to error page:", target);
                  safeReplaceLocation(target);
                  return;
                }
                writeConsumedCode(code, { outcome: "ok" });
                const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
                if (aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2") {
                  const nextPath = "/portal/today";
                  const mfaUrl = `${origin}/prihlaseni?pending_mfa=1&native=1&next=${encodeURIComponent(nextPath)}`;
                  logNativeOAuthDebug("[NativeOAuthDeepLinkBridge] MFA required, navigating to:", mfaUrl);
                  safeReplaceLocation(mfaUrl);
                  return;
                }
                const target = `${origin}/register/complete?next=%2Fportal%2Ftoday`;
                logNativeOAuthDebug("[NativeOAuthDeepLinkBridge] session exchanged OK, navigating to:", target);
                safeReplaceLocation(target);
              } catch (e) {
                const msg = e instanceof Error ? e.message : "session_exchange_failed";
                console.error("[NativeOAuthDeepLinkBridge] unexpected error during code exchange:", e);
                writeConsumedCode(code, { outcome: "error", message: msg });
                const target = `${origin}/prihlaseni?error=${encodeURIComponent(msg)}`;
                safeReplaceLocation(target);
              }
              return;
            }
            logNativeOAuthDebug("[NativeOAuthDeepLinkBridge] auth/callback without code, navigating to portal");
            safeReplaceLocation(`${origin}/portal/today`);
            return;
          }

          if (parsed.host === "auth" && parsed.pathname === "/error") {
            const msg = parsed.searchParams.get("message") || "auth_failed";
            console.warn("[NativeOAuthDeepLinkBridge] auth error deep link:", msg);
            safeReplaceLocation(`${origin}/prihlaseni?error=${encodeURIComponent(msg)}`);
            return;
          }

          if (parsed.host === "auth" && (parsed.pathname === "/done" || parsed.pathname === "/done/")) {
            logNativeOAuthDebug("[NativeOAuthDeepLinkBridge] auth/done, navigating to portal");
            safeReplaceLocation(`${origin}/portal/today`);
            return;
          }

          const hostPart = parsed.host ? `/${parsed.host}` : "";
          const path = `${hostPart}${parsed.pathname}`.replace(/\/{2,}/g, "/");
          const normalized = path.startsWith("/") ? path : `/${path}`;

          const ALLOWED_ROOT_HOSTS = new Set([
            "portal",
            "client",
            "pricing",
            "ai-review",
            "proposal",
            "navrhy",
            "login",
            "register",
            "bezpecnost",
            "gdpr",
          ]);
          const hostForCheck = parsed.host || normalized.split("/")[1] || "";
          if (hostForCheck && !ALLOWED_ROOT_HOSTS.has(hostForCheck)) {
            console.warn(
              "[NativeOAuthDeepLinkBridge] blocked deep link to non-whitelisted host:",
              hostForCheck,
            );
            safeReplaceLocation(`${origin}/portal/today`);
            return;
          }

          const target = `${origin}${normalized}${parsed.search}${parsed.hash}`;
          logNativeOAuthDebug("[NativeOAuthDeepLinkBridge] generic deep link, navigating to:", target);
          safeReplaceLocation(target);
        } finally {
          handlerInFlight = false;
        }
      };

      try {
        const launchUrl = await App.getLaunchUrl();
        logNativeOAuthDebug("[NativeOAuthDeepLinkBridge] launch URL:", launchUrl?.url ?? "(none)");
        if (launchUrl?.url) await handleOpenUrl(launchUrl.url);

        const listener = await App.addListener("appUrlOpen", (event) => {
          void handleOpenUrl(event.url);
        });

        if (disposed) listener.remove();
        else removeListener = () => listener.remove();
      } catch (e) {
        console.error("[NativeOAuthDeepLinkBridge] init failed", e);
      }
    })();

    return () => {
      disposed = true;
      if (removeListener) removeListener();
    };
  }, []);

  return null;
}
