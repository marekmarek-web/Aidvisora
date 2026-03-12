"use client";

export interface CalculatorInfoCardProps {
  title: string;
  children: React.ReactNode;
  /** Optional icon (e.g. info icon) */
  icon?: React.ReactNode;
}

export function CalculatorInfoCard({ title, children, icon }: CalculatorInfoCardProps) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
      <h3 className="text-base font-bold text-[#0a0f29] mb-3 flex items-center gap-2">
        {icon}
        {title}
      </h3>
      <div className="text-slate-600 space-y-2 leading-relaxed text-xs md:text-sm">
        {children}
      </div>
    </div>
  );
}
