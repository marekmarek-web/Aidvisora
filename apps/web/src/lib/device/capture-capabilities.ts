import { DESKTOP_MIN_PX } from "@/app/lib/breakpoints";
import { isNativePlatform } from "@/lib/capacitor/platform";

/** Where capture is implemented (Capacitor vs browser file APIs). */
export type CaptureRuntime = "native" | "browser";

/** Viewport bucket for product rules (scan entry points). */
export type CaptureFormFactor = "mobile" | "desktop";

/**
 * - native_capacitor: Capacitor Camera plugin
 * - web_mobile: mobile/tablet browser — file input + capture, multi-page scan route
 * - web_desktop: desktop browser — no primary scan UX; file upload only
 */
export type CaptureTier = "native_capacitor" | "web_mobile" | "web_desktop";

export function getCaptureFormFactorFromWidth(width: number): CaptureFormFactor {
  return width < DESKTOP_MIN_PX ? "mobile" : "desktop";
}

/**
 * Scan / camera entry points: iPad landscape (width ≥ 1024) should still behave as mobile
 * when the device is touch-first (Safari, coarse pointer or touch points).
 */
export function getBrowserTouchPrimaryForScan(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia("(pointer: coarse)").matches) return true;
  } catch {
    /* matchMedia unsupported */
  }
  if (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0) return true;
  return false;
}

export function getCaptureFormFactorForScan(width: number): CaptureFormFactor {
  if (width < DESKTOP_MIN_PX) return "mobile";
  if (getBrowserTouchPrimaryForScan()) return "mobile";
  return "desktop";
}

/** Sync snapshot for event handlers (must run in browser). */
export function getCaptureTierSnapshot(): CaptureTier {
  if (typeof window === "undefined") return "web_desktop";
  if (isNativePlatform()) return "native_capacitor";
  return getCaptureFormFactorForScan(window.innerWidth) === "mobile" ? "web_mobile" : "web_desktop";
}

export function tierSupportsMultiPageScan(tier: CaptureTier): boolean {
  return tier === "native_capacitor" || tier === "web_mobile";
}

export function tierShowsScanQuickAction(tier: CaptureTier): boolean {
  return tier !== "web_desktop";
}
