"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Perf — posune mount svého children mimo kritickou cestu prvního paintu.
 * Čekáme na `window.load` a pak ještě na `requestIdleCallback` (fallback na
 * `setTimeout(0)` pro Safari). Tím:
 *   - hydratace kritického UI (hero, CTA, FAQ) proběhne hned,
 *   - telemetrie + cookie banner + další „chrome" si načtou JS až když je browser idle.
 *
 * Použití: `<DeferredIdleMount><SpeedInsights /></DeferredIdleMount>`
 */
export function DeferredIdleMount({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let idleHandle: number | NodeJS.Timeout | null = null;

    const schedule = () => {
      if (cancelled) return;
      if (typeof window === "undefined") return;
      const w = window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
        cancelIdleCallback?: (handle: number) => void;
      };
      if (typeof w.requestIdleCallback === "function") {
        idleHandle = w.requestIdleCallback(
          () => {
            if (!cancelled) setReady(true);
          },
          { timeout: 2000 },
        );
      } else {
        idleHandle = setTimeout(() => {
          if (!cancelled) setReady(true);
        }, 600);
      }
    };

    if (document.readyState === "complete") {
      schedule();
    } else {
      const onLoad = () => schedule();
      window.addEventListener("load", onLoad, { once: true });
      return () => {
        cancelled = true;
        window.removeEventListener("load", onLoad);
        if (typeof idleHandle === "number") {
          const w = window as Window & {
            cancelIdleCallback?: (handle: number) => void;
          };
          w.cancelIdleCallback?.(idleHandle);
        } else if (idleHandle) {
          clearTimeout(idleHandle as NodeJS.Timeout);
        }
      };
    }

    return () => {
      cancelled = true;
      if (typeof idleHandle === "number") {
        const w = window as Window & {
          cancelIdleCallback?: (handle: number) => void;
        };
        w.cancelIdleCallback?.(idleHandle);
      } else if (idleHandle) {
        clearTimeout(idleHandle as NodeJS.Timeout);
      }
    };
  }, []);

  if (!ready) return null;
  return <>{children}</>;
}
