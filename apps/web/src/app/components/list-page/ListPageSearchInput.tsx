"use client";

import { Search } from "lucide-react";

/**
 * Search input matching Contacts style: icon left, pl-9, bg-slate-50, rounded-[var(--wp-radius-sm)].
 */
export function ListPageSearchInput({
  placeholder = "Hledat…",
  value,
  onChange,
  className = "",
  "aria-label": ariaLabel,
}: {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div className={`relative flex-1 md:w-72 min-w-0 ${className}`}>
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      <input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-[var(--wp-radius-sm)] text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all"
        aria-label={ariaLabel ?? placeholder}
      />
    </div>
  );
}
