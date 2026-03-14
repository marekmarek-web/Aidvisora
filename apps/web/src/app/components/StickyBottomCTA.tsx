"use client";

/**
 * Sticky bottom CTA bar for mobile (and optionally tablet).
 * Use for wizards, forms, calculators: primary action always visible.
 * - fixed bottom-0, safe-area aware (pb-[env(safe-area-inset-bottom)])
 * - Give the main content area padding-bottom so it is not covered (e.g. pb-24 or contentPaddingClass).
 */
export interface StickyBottomCTAProps {
  children: React.ReactNode;
  /** Show only below this breakpoint. Default: "md" (show on mobile/tablet, hide on desktop). */
  showBelow?: "sm" | "md" | "lg";
  /** Optional class for the bar container. */
  className?: string;
}

const showBelowClass = {
  sm: "sm:hidden",
  md: "md:hidden",
  lg: "lg:hidden",
};

export function StickyBottomCTA({
  children,
  showBelow = "md",
  className = "",
}: StickyBottomCTAProps) {
  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-fixed-cta p-3 pb-[env(safe-area-inset-bottom)] bg-white/95 backdrop-blur-sm border-t border-slate-200 shadow-[0_-4px_20px_-8px_rgba(0,0,0,0.1)] ${showBelowClass[showBelow]} ${className}`}
      role="group"
      aria-label="Hlavní akce"
    >
      {children}
    </div>
  );
}

/** Use on the scroll container above StickyBottomCTA so content is not hidden behind the bar. */
export const STICKY_BOTTOM_CTA_PADDING = "pb-24";
export const STICKY_BOTTOM_CTA_PADDING_CLASS = "pb-24 md:pb-0";
