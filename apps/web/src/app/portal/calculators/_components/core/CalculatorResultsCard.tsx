"use client";

export interface CalculatorResultsCardProps {
  /** Main value label (e.g. "Předpokládaná hodnota") */
  valueLabel: string;
  /** Main value (e.g. "1 234 567") */
  value: string;
  unit?: string;
  /** Rows: label, value; optional highlight for styling (gain = green, percent = gold) */
  rows: { label: string; value: string; highlight?: "gain" | "percent" }[];
  /** Optional footnote */
  footnote?: string;
  /** CTA button slot */
  cta?: React.ReactNode;
}

export function CalculatorResultsCard({
  valueLabel,
  value,
  unit = "Kč",
  rows,
  footnote,
  cta,
}: CalculatorResultsCardProps) {
  return (
    <div className="bg-[#0d1f4e] text-white rounded-[20px] shadow-[0_16px_48px_rgba(13,31,78,0.14),0_4px_12px_rgba(13,31,78,0.06)] border border-slate-800 p-5 sm:p-6 md:p-7 overflow-hidden relative h-full flex flex-col justify-between">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/25 rounded-full blur-3xl -mr-12 -mt-12" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/15 rounded-full blur-2xl -ml-10 -mb-10" />
      </div>

      <div>
        <h3 className="text-slate-300 font-medium mb-2 relative z-10 text-[10px] sm:text-[11px] uppercase tracking-[0.12em]">
          {valueLabel}
        </h3>
        <div className="flex items-baseline gap-2 mb-5 relative z-10">
          <span className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-[-0.03em]">
            {value}
          </span>
          <span className="text-lg sm:text-xl md:text-2xl font-medium text-slate-400">{unit}</span>
        </div>

        <div className="space-y-0 relative z-10 bg-white/5 rounded-xl p-1 backdrop-blur-sm border border-white/10">
          {rows.map((row, i) => (
            <div
              key={row.label}
              className={`flex justify-between items-center p-4 ${i < rows.length - 1 ? "border-b border-white/10" : ""}`}
            >
              <span className="text-slate-200 text-[13px] sm:text-sm">{row.label}</span>
              <span
                className={
                  row.highlight === "gain"
                    ? "font-bold text-green-400 text-base sm:text-lg"
                    : row.highlight === "percent"
                      ? "font-bold text-emerald-300 text-base sm:text-lg"
                      : "font-bold text-white text-base sm:text-lg"
                }
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>

        {footnote && (
          <p className="text-[10px] sm:text-[11px] text-slate-300 mt-4 leading-relaxed opacity-70 relative z-10">
            {footnote}
          </p>
        )}
      </div>

      {cta && <div className="mt-8 relative z-10">{cta}</div>}
    </div>
  );
}
