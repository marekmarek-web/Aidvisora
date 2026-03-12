"use client";

export interface CalculatorDisclaimerProps {
  children: React.ReactNode;
}

export function CalculatorDisclaimer({ children }: CalculatorDisclaimerProps) {
  return (
    <p className="text-xs text-slate-500 text-center leading-relaxed opacity-60">
      {children}
    </p>
  );
}
