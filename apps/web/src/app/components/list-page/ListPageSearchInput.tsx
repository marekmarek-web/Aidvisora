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
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--wp-text-tertiary)]" />
      <input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[var(--wp-radius-sm)] border border-[color:var(--wp-input-border)] bg-[color:var(--wp-input-bg)] py-2 pl-9 pr-4 text-sm font-medium text-[color:var(--wp-input-text)] outline-none transition-all focus:border-[color:var(--wp-header-input-focus-border)] focus:ring-2 focus:ring-[color:var(--wp-header-input-focus-ring)]"
        aria-label={ariaLabel ?? placeholder}
      />
    </div>
  );
}
