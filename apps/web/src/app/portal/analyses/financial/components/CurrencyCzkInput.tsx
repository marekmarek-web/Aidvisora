"use client";

import { useCallback, useEffect, useState } from "react";
import { formatCurrency } from "@/lib/analyses/financial/formatters";
import { COMPANY_RISK_MONTHLY_PREMIUM_MAX_CZK } from "@/lib/analyses/financial/constants";

export { COMPANY_RISK_MONTHLY_PREMIUM_MAX_CZK as CURRENCY_CZK_MONTHLY_PREMIUM_MAX };

/** Textové pole s českým formátem tisíců (hodnota v Kč jako číslo). */
export function CurrencyCzkInput({
  value,
  onChange,
  placeholder,
  unitLabel,
  id,
  className = "",
  /** Pokud je nastaveno, hodnota se po zadání ořízne na 0…clampMax (např. měsíční pojistné). */
  clampMax,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  placeholder?: string;
  unitLabel: string;
  id?: string;
  className?: string;
  clampMax?: number;
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
    let n = Math.round(Number(raw));
    if (!Number.isFinite(n) || Number.isNaN(n)) {
      setText(value != null ? formatCurrency(value) : "");
      return;
    }
    if (n < 0) n = 0;
    if (clampMax != null && n > clampMax) n = clampMax;
    onChange(n);
    setText(formatCurrency(n));
  }, [text, value, onChange, clampMax]);

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
        className="w-full min-h-[44px] rounded-lg border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] px-3 py-2 pr-[5.5rem] text-sm text-[color:var(--wp-text)] placeholder:text-[color:var(--wp-text-tertiary)] caret-[color:var(--wp-text)]"
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[color:var(--wp-text-tertiary)]">{unitLabel}</span>
    </div>
  );
}
