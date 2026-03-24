"use client";

import { useEffect, useState } from "react";
import { TABLET_MIN_PX, DESKTOP_MIN_PX } from "@/app/lib/breakpoints";

export type DeviceClass = "phone" | "tablet" | "desktop";

function getDeviceClass(width: number): DeviceClass {
  if (width < TABLET_MIN_PX) return "phone";
  if (width < DESKTOP_MIN_PX) return "tablet";
  return "desktop";
}

/**
 * Returns the current device class based on viewport width.
 * phone: < 768px, tablet: 768–1023px, desktop: >= 1024px.
 * SSR-safe: defaults to "phone" until hydrated.
 */
export function useDeviceClass(): DeviceClass {
  const [device, setDevice] = useState<DeviceClass>("phone");

  useEffect(() => {
    const update = () => setDevice(getDeviceClass(window.innerWidth));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return device;
}
