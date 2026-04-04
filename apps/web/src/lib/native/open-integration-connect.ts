"use client";

import { Capacitor } from "@capacitor/core";

/**
 * OAuth connect URLs must open in a context that can complete the redirect flow.
 * In Capacitor, in-app WebView often works better via @capacitor/browser for Google OAuth.
 */
export async function openIntegrationConnect(path: string): Promise<void> {
  if (typeof window === "undefined") return;
  const fullUrl = new URL(path, window.location.origin).href;
  const useBrowser =
    Capacitor.isNativePlatform() &&
    typeof Capacitor.isPluginAvailable === "function" &&
    Capacitor.isPluginAvailable("Browser");
  if (useBrowser) {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url: fullUrl, windowName: "_self" });
    return;
  }
  window.location.assign(fullUrl);
}
