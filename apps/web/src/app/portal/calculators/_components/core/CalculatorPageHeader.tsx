"use client";

/**
 * CRM-style page header for calculator pages: title + optional subtitle.
 * Matches ListPageHeader typography (no hero, no gradient).
 */

export interface CalculatorPageHeaderProps {
  title: string;
  subtitle?: string | null;
  eyebrow?: string;
}

export function CalculatorPageHeader({
  title,
  subtitle,
  eyebrow = "Kalkulačka Aidvisora",
}: CalculatorPageHeaderProps) {
  return (
    <div className="mb-1">
      <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-600 mb-1">
        {eyebrow}
      </p>
      <h1 className="font-display text-[1.45rem] sm:text-[1.55rem] md:text-[1.8rem] font-extrabold text-[#0d1f4e] tracking-[-0.02em] leading-[1.12]">
        {title}
      </h1>
      {subtitle && <p className="text-[13px] sm:text-sm text-slate-600 mt-1 leading-relaxed">{subtitle}</p>}
    </div>
  );
}
