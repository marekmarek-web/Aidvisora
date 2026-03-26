"use client";

export interface CalculatorModuleCardProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Base white module card aligned with `aidvisora-kalkulacka-modul (1).html`.
 */
export function CalculatorModuleCard({
  children,
  className = "",
}: CalculatorModuleCardProps) {
  return (
    <div
      className={`rounded-[20px] border-[1.5px] border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] p-5 shadow-sm sm:p-6 md:p-7 ${className}`.trim()}
    >
      {children}
    </div>
  );
}
