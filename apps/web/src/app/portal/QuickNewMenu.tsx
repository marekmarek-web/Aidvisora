"use client";

import { useState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { QuickActionsMenuContent } from "@/app/portal/quick-new-ui";

export function QuickNewMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`group flex items-center justify-center gap-2 min-h-[44px] min-w-[44px] px-4 py-2.5 rounded-xl text-sm font-bold shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-2 ${
          open
            ? "bg-[#2a2d4a] text-white shadow-lg scale-[0.98]"
            : "bg-[#1a1c2e] text-white hover:bg-[#2a2d4a] hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98]"
        }`}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Nový – rychlé akce"
      >
        <Plus size={18} strokeWidth={2.5} className={`shrink-0 transition-transform duration-200 ${open ? "rotate-45" : "group-hover:scale-110"}`} />
        <span className="hidden sm:block">Nový</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 z-50 w-56 rounded-2xl shadow-xl border border-slate-100 bg-white p-2"
        >
          <QuickActionsMenuContent variant="dropdown" onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
