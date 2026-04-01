"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ProductPicker } from "@/app/components/aidvisora/ProductPicker";
import type { ProductPickerValue } from "@/app/components/aidvisora/ProductPicker";

interface CellProductProps {
  value: string;
  onChange?: (value: string) => void;
}

const PORTAL_ID = "cell-product-dropdown-portal";

export function CellProduct({ value, onChange }: CellProductProps) {
  const [open, setOpen] = useState(false);
  const [pickerValue, setPickerValue] = useState<ProductPickerValue>({ partnerId: "", productId: "" });
  const [dropdownRect, setDropdownRect] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelHeightRef = useRef(320);

  const updateDropdownPosition = useCallback(() => {
    if (buttonRef.current && typeof window !== "undefined") {
      const rect = buttonRef.current.getBoundingClientRect();
      const margin = 8;
      const h = panelHeightRef.current;
      const openUp = rect.bottom + h + margin > window.innerHeight - 48;
      setDropdownRect({
        top: openUp ? rect.top - h - 4 : rect.bottom + 4,
        left: rect.left,
      });
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    updateDropdownPosition();
  }, [open, updateDropdownPosition]);

  useEffect(() => {
    if (!open) return;
    const scrollContainer = ref.current?.closest(".b-scroller") ?? null;
    const onScroll = () => updateDropdownPosition();
    scrollContainer?.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.addEventListener("resize", onScroll);
    return () => {
      scrollContainer?.removeEventListener("scroll", onScroll);
      window.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", onScroll);
    };
  }, [open, updateDropdownPosition]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const portal = document.getElementById(PORTAL_ID);
      if (ref.current?.contains(target)) return;
      if (portal?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function handleApply() {
    const label = [pickerValue.partnerName, pickerValue.productName].filter(Boolean).join(" – ") || "";
    onChange?.(label);
    setOpen(false);
  }

  const dropdown =
    open &&
    onChange &&
    typeof document !== "undefined" && (
      <div
        id={PORTAL_ID}
        role="dialog"
        aria-label="Výběr produktu"
        className="wp-dropdown fixed z-[400] p-3 min-w-[220px] max-w-[min(100vw-16px,360px)] max-h-[min(70vh,420px)] overflow-y-auto shadow-[var(--monday-shadow)] bg-monday-surface border border-monday-border rounded-[var(--monday-radius)]"
        ref={(el) => {
          if (el) panelHeightRef.current = el.getBoundingClientRect().height;
        }}
        style={{
          top: dropdownRect.top,
          left: dropdownRect.left,
        }}
      >
        <ProductPicker value={pickerValue} onChange={setPickerValue} />
        <div className="flex gap-2 mt-3 pt-2 border-t border-monday-border">
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 px-2 py-1.5 text-[12px] font-medium text-white bg-monday-blue rounded-[var(--monday-radius)] hover:opacity-90"
          >
            Použít
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-2 py-1.5 text-[12px] font-medium text-monday-text-muted hover:bg-monday-row-hover rounded-[var(--monday-radius)]"
          >
            Zrušit
          </button>
        </div>
      </div>
    );

  return (
    <div ref={ref} className="relative min-h-[28px] flex items-center">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => onChange && setOpen((o) => !o)}
        className="w-full min-h-[24px] flex items-center px-1.5 text-[13px] text-monday-text cursor-pointer text-left rounded-[var(--monday-radius)] hover:bg-monday-row-hover border border-transparent hover:border-monday-border"
      >
        {value || <span className="text-monday-text-muted">— vybrat produkt</span>}
      </button>
      {dropdown && createPortal(dropdown, document.body)}
    </div>
  );
}
