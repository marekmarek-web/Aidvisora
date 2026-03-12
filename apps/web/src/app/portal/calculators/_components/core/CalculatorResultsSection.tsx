"use client";

export interface CalculatorResultsSectionProps {
  children: React.ReactNode;
}

export function CalculatorResultsSection({ children }: CalculatorResultsSectionProps) {
  return (
    <div className="lg:col-span-5">
      {children}
    </div>
  );
}
