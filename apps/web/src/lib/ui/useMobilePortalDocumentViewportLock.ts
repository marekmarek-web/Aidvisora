"use client";

import { useLayoutEffect } from "react";

import { DESKTOP_MIN_PX } from "@/app/lib/breakpoints";

const VIEWPORT_LOCK_CLASS = "aidv-mobile-portal-viewport-lock";

/**
 * Mobilní portálové shelly zamykají document scroll (viz `globals.css`), aby scrolloval
 * jen vnitřní `MobileScreen`. `useDeviceClass` ale do prvního `useEffect` vrací výchozí
 * `"phone"`, takže `useLayoutEffect` dříve omylem přidal lock i na desktopu → nešlo scrollovat,
 * dokud se stav neaktualizoval (nebo při chybě vůbec).
 */
export function useMobilePortalDocumentViewportLock() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const desktop = window.innerWidth >= DESKTOP_MIN_PX;
      if (desktop) root.classList.remove(VIEWPORT_LOCK_CLASS);
      else root.classList.add(VIEWPORT_LOCK_CLASS);
    };
    apply();
    window.addEventListener("resize", apply);
    return () => {
      window.removeEventListener("resize", apply);
      root.classList.remove(VIEWPORT_LOCK_CLASS);
    };
  }, []);
}
