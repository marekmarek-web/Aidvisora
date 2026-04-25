"use client";

import React from "react";

/**
 * Rám pro interaktivní produktová dema na marketingové stránce.
 *
 * Pořadí tailwind tříd je zde záměrně kanonické (alfabetické skupinování),
 * protože jinak `prettier-plugin-tailwindcss` při save přeuspořádá řetězec
 * a mezi starým SSR chunkem a novým klient-bundlem vzniká hydration mismatch
 * ("a tree hydrated but some attributes…").
 */
export function LandingProductFrame({
  label,
  status,
  statusTone = "emerald",
  children,
  className = "",
  contentClassName = "",
}: {
  label: string;
  status?: string;
  statusTone?: "emerald" | "indigo" | "amber" | "rose" | "slate";
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const toneMap: Record<string, string> = {
    emerald: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
    indigo: "border-indigo-500/30 bg-indigo-500/15 text-indigo-300",
    amber: "border-amber-500/30 bg-amber-500/15 text-amber-300",
    rose: "border-rose-500/30 bg-rose-500/15 text-rose-300",
    slate: "border-white/10 bg-white/5 text-slate-300",
  };

  return (
    <div
      className={`relative overflow-hidden rounded-[28px] border border-white/10 bg-[#060918]/90 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)] backdrop-blur-xl ${className}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.02] px-4 py-3 md:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex shrink-0 gap-1.5" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
          </div>
          <span className="truncate font-jakarta text-[11px] font-semibold tracking-wide text-slate-300 md:text-xs">
            {label}
          </span>
        </div>
        {status ? (
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${toneMap[statusTone]}`}
          >
            {status}
          </span>
        ) : null}
      </div>
      <div className={contentClassName}>{children}</div>
    </div>
  );
}
