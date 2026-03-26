"use client";

export interface CalculatorInfoCardProps {
  title: string;
  children: React.ReactNode;
  /** Optional icon (e.g. info icon) */
  icon?: React.ReactNode;
}

export function CalculatorInfoCard({ title, children, icon }: CalculatorInfoCardProps) {
  return (
    <div className="bg-[color:var(--wp-surface-card)] rounded-2xl p-6 shadow-sm border border-[color:var(--wp-surface-card-border)]">
      <h3 className="text-base font-bold text-[#0a0f29] mb-3 flex items-center gap-2">
        {icon}
        {title}
      </h3>
      <div className="text-[color:var(--wp-text-secondary)] space-y-2 leading-relaxed text-xs md:text-sm">
        {children}
      </div>
    </div>
  );
}
