"use client";

import { useCallback, useEffect, useState } from "react";
import { formatCurrency } from "@/lib/analyses/financial/formatters";

/** Textové pole s českým formátem tisíců (hodnota v Kč jako číslo). */
export function CurrencyCzkInput({
  value,
  onChange,
  placeholder,
  unitLabel,
  id,
  className = "",
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  placeholder?: string;
  unitLabel: string;
  id?: string;
  className?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState("");

  useEffect(() => {
    if (!focused) {
      setText(value != null && !Number.isNaN(value) ? formatCurrency(value) : "");
    }
  }, [value, focused]);

  const commit = useCallback(() => {
    const raw = text.replace(/\s/g, "").replace(",", ".").trim();
    if (raw === "") {
      onChange(undefined);
      setText("");
      return;
    }
    const n = Math.round(Number(raw));
    if (Number.isNaN(n)) {
      setText(value != null ? formatCurrency(value) : "");
      return;
    }
    onChange(n);
    setText(formatCurrency(n));
  }, [text, value, onChange]);

  return (
    <div className={`relative w-full ${className}`}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder={placeholder}
        value={focused ? text : value != null && !Number.isNaN(value) ? formatCurrency(value) : ""}
        onFocus={() => {
          setFocused(true);
          setText(value != null && !Number.isNaN(value) ? String(value) : "");
        }}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
        className="w-full min-h-[40px] rounded-lg border border-slate-200 px-3 py-2 pr-20 text-sm"
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">{unitLabel}</span>
    </div>
  );
}
