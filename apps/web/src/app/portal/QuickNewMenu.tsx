"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Plus,
  UserPlus,
  Briefcase,
  CheckSquare,
  CalendarPlus,
  Calendar,
  Network,
  StickyNote,
  FileText,
  Building,
  Settings2,
} from "lucide-react";
import { getQuickActionsConfig } from "@/app/actions/preferences";
import {
  QUICK_ACTIONS_CATALOG,
  DEFAULT_QUICK_ACTIONS_ORDER,
  getDefaultQuickActionsConfig,
  type QuickActionId,
  type QuickActionItem,
} from "@/lib/quick-actions";

const ICON_MAP = {
  UserPlus,
  Briefcase,
  CheckSquare,
  CalendarPlus,
  Calendar,
  Network,
  StickyNote,
  FileText,
  Building,
} as const;

function ItemIcon({ item }: { item: QuickActionItem }) {
  const name = item.iconName;
  if (!name || !(name in ICON_MAP)) return null;
  const Icon = ICON_MAP[name as keyof typeof ICON_MAP];
  return <Icon className={`shrink-0 size-5 ${item.iconColor ?? "text-slate-500"}`} aria-hidden />;
}

export function QuickNewMenu() {
  const [open, setOpen] = useState(false);
  const [order, setOrder] = useState<QuickActionId[]>(DEFAULT_QUICK_ACTIONS_ORDER);
  const [visible, setVisible] = useState<Record<string, boolean>>(() => {
    const { visible: v } = getDefaultQuickActionsConfig();
    return v;
  });
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
    .filter(Boolean) as QuickActionItem[];

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2 ${
          open
            ? "bg-blue-50 border border-blue-200 text-blue-700 shadow-inner"
            : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
        }`}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Nový – rychlé akce"
      >
        <Plus size={16} strokeWidth={2.5} className={open ? "rotate-45" : ""} />
        <span className="hidden sm:block">Nový</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 z-50 w-56 rounded-2xl shadow-xl border border-slate-100 bg-white p-2"
        >
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-3 py-2">
            Rychlé akce
          </div>
          {ready && items.length > 0 ? (
            items.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 min-h-[44px] text-sm text-slate-700 hover:bg-slate-50 rounded-xl transition-colors"
              >
                <ItemIcon item={item} />
                {item.label}
              </Link>
            ))
          ) : (
            <div className="px-3 py-4 space-y-2" aria-hidden>
              <div className="h-5 w-full bg-slate-100 rounded animate-pulse" />
              <div className="h-5 w-4/5 bg-slate-100 rounded animate-pulse" />
              <div className="h-5 w-3/4 bg-slate-100 rounded animate-pulse" />
            </div>
          )}
          <div className="h-px bg-slate-100 my-2" />
          <Link
            href="/portal/setup#quick-actions"
            onClick={() => setOpen(false)}
            className="group flex items-center gap-3 px-3 py-2.5 min-h-[44px] text-xs font-bold text-slate-400 hover:text-slate-600 rounded-xl transition-colors"
          >
            <Settings2 className="size-4 shrink-0 group-hover:rotate-90 transition-transform" aria-hidden />
            Upravit nabídku
          </Link>
        </div>
      )}
    </div>
  );
}
