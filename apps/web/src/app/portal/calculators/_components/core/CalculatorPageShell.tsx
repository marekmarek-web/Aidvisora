"use client";

import type { CalculatorPageShellProps } from "./types";

/**
 * Calculator page shell aligned with portal list pages (ListPageShell).
 * CRM mode: max-w-[1600px], consistent padding, space-y-6.
 */
export function CalculatorPageShell({
  children,
  maxWidth = "max-w-[1160px]",
  className = "",
}: CalculatorPageShellProps) {
  return (
    <div
      className={`${maxWidth} mx-auto space-y-3 sm:space-y-4 p-3 sm:p-6 sm:rounded-[20px] sm:border sm:border-[color:var(--wp-surface-card-border)] sm:bg-[color:var(--wp-surface-card)] ${className}`.trim()}
    >
      {children}
      <p className="text-center text-xs sm:text-sm text-[color:var(--wp-text-secondary)] pt-1 sm:pt-2">
        Orientační výpočet. Nejedná se o finanční poradenství ani závaznou nabídku.
      </p>
    </div>
  );
}
