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
    <div className="bg-[#0a0f29] text-white rounded-2xl shadow-2xl shadow-[#0a0f29]/30 border border-slate-800 p-8 overflow-hidden relative h-full flex flex-col justify-between">
      <div className="absolute top-0 right-0 w-48 h-48 bg-[#0B3A7A] opacity-20 rounded-full blur-2xl -mr-10 -mt-10" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#fbbf24] opacity-10 rounded-full blur-xl -ml-10 -mb-10" />

      <div>
        <h3 className="text-slate-400 font-medium mb-2 relative z-10 text-sm uppercase tracking-wider">
          {valueLabel}
        </h3>
        <div className="flex items-baseline gap-2 mb-6 relative z-10">
          <span className="text-4xl md:text-5xl font-black text-white tracking-tight">
            {value}
          </span>
          <span className="text-2xl font-medium text-slate-500">{unit}</span>
        </div>

        <div className="space-y-0 relative z-10 bg-slate-800/50 rounded-xl p-1 backdrop-blur-sm border border-white/5">
          {rows.map((row, i) => (
            <div
              key={row.label}
              className={`flex justify-between items-center p-4 ${i < rows.length - 1 ? "border-b border-white/10" : ""}`}
            >
              <span className="text-slate-300 text-sm">{row.label}</span>
              <span
                className={
                  row.highlight === "gain"
                    ? "font-bold text-green-400 text-lg"
                    : row.highlight === "percent"
                      ? "font-bold text-[#fbbf24] text-lg"
                      : "font-bold text-white text-lg"
                }
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>

        {footnote && (
          <p className="text-[11px] text-slate-400 mt-4 leading-normal opacity-70 relative z-10">
            {footnote}
          </p>
        )}
      </div>

      {cta && <div className="mt-8 relative z-10">{cta}</div>}
    </div>
  );
}
