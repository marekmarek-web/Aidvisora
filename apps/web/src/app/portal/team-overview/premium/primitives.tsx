"use client";

import type { ReactNode } from "react";

export function PremiumPill({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: string;
}) {
  const tones: Record<string, string> = {
    default: "bg-white/70 text-slate-700 border-slate-200",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warn: "bg-amber-50 text-amber-700 border-amber-200",
    danger: "bg-rose-50 text-rose-700 border-rose-200",
    info: "bg-sky-50 text-sky-700 border-sky-200",
    violet: "bg-violet-50 text-violet-700 border-violet-200",
    dark: "bg-slate-800 text-slate-100 border-slate-700",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tones[tone] || tones.default}`}
    >
      {children}
    </span>
  );
}

export function PremiumSectionTitle({
  symbol,
  title,
  subtitle,
  action,
}: {
  symbol: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-700">
          {symbol}
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
        </div>
      </div>
      {action ?? null}
    </div>
  );
}

export function PremiumMetricCard({
  label,
  value,
  change,
  tone = "default",
  symbol = "•",
}: {
  label: string;
  value: string;
  change?: string;
  tone?: string;
  symbol?: string;
}) {
  const toneClass: Record<string, string> = {
    default: "from-white to-slate-50/80 border-slate-200/80",
    info: "from-sky-50/70 to-white border-sky-200/70",
    success: "from-emerald-50/70 to-white border-emerald-200/70",
    warn: "from-amber-50/70 to-white border-amber-200/70",
    danger: "from-rose-50/70 to-white border-rose-200/70",
    violet: "from-violet-50/70 to-white border-violet-200/70",
  };

  return (
    <div className={`rounded-3xl border bg-gradient-to-br ${toneClass[tone] || toneClass.default} p-4 shadow-sm`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">{value}</p>
          {change ? <p className="mt-1 text-[11px] text-slate-500">{change}</p> : null}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/85 text-sm text-slate-700 shadow-sm ring-1 ring-slate-200/60">
          {symbol}
        </div>
      </div>
    </div>
  );
}

export function PremiumProgressBar({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: number;
  tone?: "slate" | "emerald" | "amber" | "sky" | "violet";
}) {
  const toneClass: Record<string, string> = {
    slate: "bg-slate-900",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    sky: "bg-sky-500",
    violet: "bg-violet-500",
  };

  const width = `${Math.max(0, Math.min(100, value))}%`;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="text-slate-600">{label}</span>
        <span className="font-semibold tabular-nums text-slate-900">{value}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100">
        <div className={`h-2 rounded-full transition-all duration-300 ${toneClass[tone]}`} style={{ width }} />
      </div>
    </div>
  );
}

export function PremiumToggleGroup({
  items,
  active,
  onChange,
}: {
  items: string[];
  active: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-slate-200/80 bg-slate-100/80 p-1">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onChange(item)}
          className={`rounded-xl px-3 py-1.5 text-sm font-medium transition ${
            active === item
              ? "bg-white text-slate-950 shadow-sm ring-1 ring-slate-200/70"
              : "text-slate-500 hover:bg-white/70 hover:text-slate-700"
          }`}
        >
          {item}
        </button>
      ))}
    </div>
  );
}
