"use client";

export interface CalculatorDisclaimerProps {
  children: React.ReactNode;
}

export function CalculatorDisclaimer({ children }: CalculatorDisclaimerProps) {
  return (
    <p className="text-xs text-[color:var(--wp-text-secondary)] text-center leading-relaxed opacity-60">
      {children}
    </p>
  );
}
