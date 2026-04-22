"use client";

/**
 * Native runtime orchestrator for the Aidvisora Capacitor shell.
 *
 * Mounted once at the root of the mobile portal / client shell. Everything
 * is idempotent and no-op on plain web. Each subsystem (back button,
 * keyboard, status bar, network…) is its own focused effect so a single
 * plugin failure can't bring down the rest.
 *
 * Why a single component instead of scattered hooks:
 *   - Guaranteed single Android `backButton` listener. Multiple listeners
 *     cause "back goes two routes at once" race conditions.
 *   - One place to document platform quirks (iOS vs Android keyboard
 *     resize semantics, edge-swipe vs hw-back).
 *   - Startup ordering — we wait for the first paint before hiding the
 *     splash, etc.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import * as Sentry from "@sentry/nextjs";

import {
  getBackStackDepth,
  runTopBackHandler,
} from "@/app/shared/mobile-ui/native-back-stack";

/**
 * Root-level native hooks. Render once per app. Safe on web and SSR
 * (everything guarded behind `Capacitor.isNativePlatform()` inside
 * `useEffect`, which never runs during SSR anyway).
 */
export function NativeRuntime(): null {
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let cleanupFns: Array<() => void> = [];
    let cancelled = false;

    async function boot() {
      // Each subsystem resolves independently so a missing plugin (e.g.
      // keyboard not in the native bundle yet) only disables that one
      // feature.
      const tasks = await Promise.allSettled([
        wireBackButton(router),
        wireKeyboard(),
        wireStatusBar(),
        wireSplashScreen(),
        wireNetworkBreadcrumbs(),
      ]);
      if (cancelled) return;
      for (const res of tasks) {
        if (res.status === "fulfilled" && typeof res.value === "function") {
          cleanupFns.push(res.value);
        } else if (res.status === "rejected") {
          Sentry.addBreadcrumb({
            category: "native.runtime",
            level: "warning",
            message: "native_subsystem_wire_failed",
            data: { reason: String(res.reason) },
          });
        }
      }
    }

    void boot();

    return () => {
      cancelled = true;
      for (const fn of cleanupFns) {
        try {
          fn();
        } catch {
          /* ignore */
        }
      }
      cleanupFns = [];
    };
  }, [router]);

  return null;
}

/**
 * Android hardware back button bridge.
 *
 * Priority chain (short-circuit on first handled):
 *   1. Custom LIFO back-handler stack (sheets/drawers) — see
 *      `native-back-stack.ts`.
 *   2. WebView history — `router.back()` when there is a prior entry.
 *   3. Exit app — Android convention with a "press again to exit" toast
 *      pattern guarded by a 2s window.
 *
 * iOS does NOT fire this event (Apple HIG has no hw back), which is fine
 * — iOS edge-swipe goes through WKWebView history directly, and our
 * overlays listen for the `popstate` they produce via React state only.
 */
async function wireBackButton(router: ReturnType<typeof useRouter>): Promise<() => void> {
  const { App } = await import("@capacitor/app");

  let lastExitTapAt = 0;
  const EXIT_DOUBLE_TAP_MS = 2000;

  const handle = await App.addListener("backButton", async ({ canGoBack }) => {
    Sentry.addBreadcrumb({
      category: "native.back",
      level: "info",
      message: "back_button_pressed",
      data: { stackDepth: getBackStackDepth(), canGoBack },
    });

    if (runTopBackHandler()) return;

    if (canGoBack && typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    const now = Date.now();
    if (now - lastExitTapAt < EXIT_DOUBLE_TAP_MS) {
      try {
        await App.exitApp();
      } catch {
        /* ignore — older android fallback */
      }
      return;
    }
    lastExitTapAt = now;
    try {
      window.dispatchEvent(
        new CustomEvent("aidvisora:toast", {
          detail: { message: "Stisknutím znovu ukončíte aplikaci", variant: "info" },
        }),
      );
    } catch {
      /* ignore */
    }
  });

  return () => {
    try {
      void handle.remove();
    } catch {
      /* ignore */
    }
  };
}

async function wireKeyboard(): Promise<() => void> {
  const { Keyboard, KeyboardResize } = await import("@capacitor/keyboard");

  try {
    // iOS: "native" lets UIKit resize the webview for us, which is better
    // than "body" or "none" because it keeps our flex layout intact.
    if (Capacitor.getPlatform() === "ios") {
      await Keyboard.setResizeMode({ mode: KeyboardResize.Native });
      await Keyboard.setScroll({ isDisabled: true });
    }
  } catch {
    /* non-fatal */
  }

  const setCssVar = (px: number) => {
    try {
      document.documentElement.style.setProperty("--aidv-keyboard-h", `${px}px`);
    } catch {
      /* ignore */
    }
  };

  // Capacitor 8 keyboard plugin events return `{ keyboardHeight: number }`.
  const willShow = await Keyboard.addListener("keyboardWillShow", (info) => {
    setCssVar(info.keyboardHeight);
    document.documentElement.dataset.keyboardOpen = "true";
  });
  const willHide = await Keyboard.addListener("keyboardWillHide", () => {
    setCssVar(0);
    delete document.documentElement.dataset.keyboardOpen;
  });

  return () => {
    try {
      void willShow.remove();
      void willHide.remove();
    } catch {
      /* ignore */
    }
    setCssVar(0);
    delete document.documentElement.dataset.keyboardOpen;
  };
}

async function wireStatusBar(): Promise<() => void> {
  const { StatusBar, Style } = await import("@capacitor/status-bar");

  const apply = async () => {
    try {
      const isDark =
        typeof matchMedia === "function" &&
        matchMedia("(prefers-color-scheme: dark)").matches;
      await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light });
      if (Capacitor.getPlatform() === "android") {
        // Transparent bar matches our translucent header via safe-area.
        await StatusBar.setOverlaysWebView({ overlay: true });
      }
    } catch {
      /* ignore */
    }
  };
  await apply();

  const mq = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;
  const onChange = () => {
    void apply();
  };
  mq?.addEventListener?.("change", onChange);

  return () => {
    mq?.removeEventListener?.("change", onChange);
  };
}

async function wireSplashScreen(): Promise<() => void> {
  const { SplashScreen } = await import("@capacitor/splash-screen");

  // Hide on next paint — the web shell has its own skeleton so we don't
  // need to keep the native splash visible once the WebView is ready.
  const raf = requestAnimationFrame(() => {
    void SplashScreen.hide({ fadeOutDuration: 180 }).catch(() => {
      /* ignore */
    });
  });

  return () => {
    cancelAnimationFrame(raf);
  };
}

async function wireNetworkBreadcrumbs(): Promise<() => void> {
  const { Network } = await import("@capacitor/network");

  const handle = await Network.addListener("networkStatusChange", (status) => {
    Sentry.addBreadcrumb({
      category: "native.network",
      level: "info",
      message: status.connected ? "network_connected" : "network_disconnected",
      data: { connectionType: status.connectionType },
    });
    try {
      window.dispatchEvent(
        new CustomEvent("aidvisora:network-status", { detail: status }),
      );
    } catch {
      /* ignore */
    }
  });

  return () => {
    try {
      void handle.remove();
    } catch {
      /* ignore */
    }
  };
}

/**
 * Fire-and-forget haptic feedback. Safe on web (no-op). Use sparingly —
 * every tap vibrating is anti-UX; reserve for primary CTAs and sheet
 * dismiss/open transitions.
 */
export async function triggerHaptic(
  style: "light" | "medium" | "heavy" = "light",
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    const map = {
      light: ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy: ImpactStyle.Heavy,
    } as const;
    await Haptics.impact({ style: map[style] });
  } catch {
    /* ignore — plugin might be unavailable */
  }
}
