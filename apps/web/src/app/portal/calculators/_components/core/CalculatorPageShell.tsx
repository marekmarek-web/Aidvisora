"use client";

import type { CalculatorPageShellProps } from "./types";

/**
 * Calculator page shell aligned with portal list pages (ListPageShell).
 * CRM mode: max-w-[1600px], consistent padding, space-y-6.
 */
export function CalculatorPageShell({
  children,
  maxWidth = "max-w-[1600px]",
  className = "",
}: CalculatorPageShellProps) {
  return (
    <div className={`${maxWidth} mx-auto space-y-6 p-4 sm:p-6 ${className}`.trim()}>
      {children}
    </div>
  );
}
