"use client";

import React from "react";

/**
 * Samostatný modul (mimo rám) — stabilní v lazy Webpack chuncích.
 */
export function useInViewTrigger<T extends HTMLElement>(options?: {
  rootMargin?: string;
  threshold?: number;
}) {
  const ref = React.useRef<T | null>(null);
  const [inView, setInView] = React.useState(false);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            io.disconnect();
            return;
          }
        }
      },
      { rootMargin: options?.rootMargin ?? "0px 0px -20% 0px", threshold: options?.threshold ?? 0.25 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [options?.rootMargin, options?.threshold]);

  return { ref, inView } as const;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}
