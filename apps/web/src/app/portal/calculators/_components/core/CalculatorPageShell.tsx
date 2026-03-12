"use client";

import type { CalculatorPageShellProps } from "./types";

export function CalculatorPageShell({
  children,
  maxWidth = "max-w-7xl",
  className = "",
}: CalculatorPageShellProps) {
  return (
    <div className={`${maxWidth} mx-auto px-4 sm:px-6 lg:px-8 ${className}`.trim()}>
      {children}
    </div>
  );
}
