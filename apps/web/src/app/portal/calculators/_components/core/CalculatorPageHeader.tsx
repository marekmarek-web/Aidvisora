"use client";

/**
 * CRM-style page header for calculator pages: title + optional subtitle.
 * Matches ListPageHeader typography (no hero, no gradient).
 */

export interface CalculatorPageHeaderProps {
  title: string;
  subtitle?: string | null;
}

export function CalculatorPageHeader({ title, subtitle }: CalculatorPageHeaderProps) {
  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
        {title}
      </h1>
      {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
    </div>
  );
}
