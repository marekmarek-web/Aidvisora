"use client";

export interface CalculatorInputSectionProps {
  children: React.ReactNode;
}

export function CalculatorInputSection({ children }: CalculatorInputSectionProps) {
  return (
    <div className="lg:col-span-7">
      {children}
    </div>
  );
}
