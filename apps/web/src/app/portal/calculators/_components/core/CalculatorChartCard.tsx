"use client";

export interface CalculatorChartCardProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  /** Optional caption below chart */
  caption?: string;
}

export function CalculatorChartCard({
  title,
  icon,
  children,
  caption,
}: CalculatorChartCardProps) {
  return (
    <div className="bg-[color:var(--wp-surface-card)] rounded-2xl p-6 shadow-sm border border-[#D6E6FF]/60 flex flex-col text-center">
      <h3 className="text-lg font-bold text-[#0a0f29] flex items-center justify-center gap-2 mb-4">
        {icon}
        {title}
      </h3>
      <div className="flex-1 min-h-[300px] relative w-full">{children}</div>
      {caption && (
        <p className="text-xs text-[color:var(--wp-text-secondary)] mt-4 italic">{caption}</p>
      )}
    </div>
  );
}
