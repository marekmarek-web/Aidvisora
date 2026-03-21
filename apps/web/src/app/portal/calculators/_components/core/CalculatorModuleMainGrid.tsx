"use client";

export interface CalculatorModuleMainGridProps {
  children: React.ReactNode;
}

/**
 * Main module grid (input panel + results panel) matching HTML module proportions.
 */
export function CalculatorModuleMainGrid({
  children,
}: CalculatorModuleMainGridProps) {
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-4">
      {children}
    </div>
  );
}
