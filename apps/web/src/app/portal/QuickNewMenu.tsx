"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Plus, ChevronDown } from "lucide-react";
import { getQuickActionsConfig } from "@/app/actions/preferences";
import { QUICK_ACTIONS_CATALOG, type QuickActionId } from "@/lib/quick-actions";

export function QuickNewMenu() {
  const [open, setOpen] = useState(false);
  const [order, setOrder] = useState<QuickActionId[]>([]);
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [ready, setReady] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getQuickActionsConfig().then((c) => {
      const catalogIds = QUICK_ACTIONS_CATALOG.map((a) => a.id);
      const orderIds = c.order.length
        ? (c.order.filter((id) => catalogIds.includes(id as QuickActionId)) as QuickActionId[])
        : [...catalogIds];
      const missing = catalogIds.filter((id) => !orderIds.includes(id));
      setOrder([...orderIds, ...missing]);
      setVisible(
        catalogIds.reduce<Record<string, boolean>>((acc, id) => {
          acc[id] = c.visible[id] !== false;
          return acc;
        }, {})
      );
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClose = () => setOpen(false);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [open]);

  const items = order
    .filter((id) => visible[id])
    .map((id) => QUICK_ACTIONS_CATALOG.find((a) => a.id === id))
    .filter(Boolean) as typeof QUICK_ACTIONS_CATALOG;

  if (!ready) {
    return (
      <div className="h-9 w-24 bg-slate-100 rounded-[var(--wp-radius-sm)] animate-pulse shrink-0" aria-hidden />
    );
  }

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="wp-quick-new-btn flex items-center gap-1.5 h-9 min-h-[44px] px-3 rounded-[var(--wp-radius-sm)] bg-[var(--wp-accent)] text-white font-medium text-sm hover:bg-[var(--wp-accent-hover)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--wp-accent)] focus:ring-offset-2"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Nový – rychlé akce"
      >
        <Plus size={18} strokeWidth={2.5} />
        <span className="hidden sm:inline">Nový</span>
        <ChevronDown size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && items.length > 0 && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-[9999] min-w-[200px] py-1 border border-slate-200 bg-white rounded-[var(--wp-radius-sm)] shadow-lg"
        >
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 min-h-[44px] transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
