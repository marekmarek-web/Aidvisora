"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Settings2,
  ScanLine,
  UserPlus,
  Briefcase,
  CheckSquare,
  CalendarPlus,
  Calendar,
  Network,
  StickyNote,
  FileText,
  Building,
} from "lucide-react";
import type { QuickActionId, QuickActionItem } from "@/lib/quick-actions";
import { useQuickActionsItems } from "@/lib/quick-actions/useQuickActionsItems";
import { useCaptureCapabilities } from "@/lib/device/useCaptureCapabilities";

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

const ICON_HOVER_ANIM: Partial<Record<QuickActionId, string>> = {
  new_task: "group-hover:rotate-12 group-hover:scale-110",
  new_meeting: "group-hover:-translate-y-1 group-hover:scale-110",
  new_contact: "group-hover:scale-110",
  new_deal: "group-hover:rotate-[-12deg] group-hover:scale-110",
  calendar: "group-hover:-translate-y-1 group-hover:scale-110",
  mindmap: "group-hover:-translate-y-1",
  note: "group-hover:translate-x-1",
  document: "group-hover:scale-110",
  household: "group-hover:-translate-y-1",
};

export function QuickNewItemIcon({ item }: { item: QuickActionItem }) {
  const name = item.iconName;
  if (!name || !(name in ICON_MAP)) return null;
  const Icon = ICON_MAP[name as keyof typeof ICON_MAP];
  const hoverAnim = ICON_HOVER_ANIM[item.id];
  return (
    <span className={`flex items-center justify-center shrink-0 transition-all duration-300 ${hoverAnim ?? ""}`}>
      <Icon className={`size-5 ${item.iconColor ?? "text-slate-500"}`} aria-hidden />
    </span>
  );
}

/**
 * Shared body for desktop dropdown ([`QuickNewMenu`]) and mobile bottom sheet ([`QuickNewMobileSheet`]).
 */
export function QuickActionsMenuContent({
  variant,
  onClose,
}: {
  variant: "dropdown" | "sheet";
  onClose: () => void;
}) {
  const router = useRouter();
  const { items, ready } = useQuickActionsItems();
  const { showScanInQuickMenu } = useCaptureCapabilities();

  function go(href: string) {
    onClose();
    router.push(href);
  }

  const itemClass =
    variant === "sheet"
      ? "group w-full flex items-center gap-3 px-3 py-3 min-h-[48px] text-sm text-slate-700 hover:bg-slate-50 rounded-xl text-left active:scale-[0.99] transition-transform"
      : "group flex items-center gap-3 px-3 py-2.5 min-h-[44px] text-sm text-slate-700 hover:bg-slate-50 rounded-xl";

  return (
    <>
      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-3 py-2">
        Rychlé akce
      </div>
      {ready && items.length > 0 ? (
        variant === "dropdown" ? (
          items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              role="menuitem"
              onClick={() => onClose()}
              className={itemClass}
            >
              <QuickNewItemIcon item={item} />
              {item.label}
            </Link>
          ))
        ) : (
          <div className="space-y-1">
            {items.map((item) => (
              <button key={item.id} type="button" onClick={() => go(item.href)} className={itemClass}>
                <QuickNewItemIcon item={item} />
                {item.label}
              </button>
            ))}
          </div>
        )
      ) : (
        <div className="px-3 py-4 space-y-2" aria-hidden>
          <div className="h-5 w-full bg-slate-100 rounded animate-pulse" />
          <div className="h-5 w-4/5 bg-slate-100 rounded animate-pulse" />
          <div className="h-5 w-3/4 bg-slate-100 rounded animate-pulse" />
        </div>
      )}
      {showScanInQuickMenu ? (
        variant === "dropdown" ? (
          <Link
            href="/portal/scan"
            role="menuitem"
            onClick={() => onClose()}
            className={itemClass}
          >
            <span className="flex items-center justify-center shrink-0 transition-all duration-300">
              <ScanLine className="size-5 text-slate-500" aria-hidden />
            </span>
            Skenovat dokument
          </Link>
        ) : (
          <button type="button" onClick={() => go("/portal/scan")} className={`${itemClass} mt-1`}>
            <span className="flex items-center justify-center shrink-0 transition-all duration-300">
              <ScanLine className="size-5 text-slate-500" aria-hidden />
            </span>
            Skenovat dokument
          </button>
        )
      ) : null}
      <div className="h-px bg-slate-100 my-2" />
      {variant === "dropdown" ? (
        <Link
          href="/portal/setup#quick-actions"
          onClick={() => onClose()}
          className="group flex items-center gap-3 px-3 py-2.5 min-h-[44px] text-xs font-bold text-slate-400 hover:text-slate-600 rounded-xl transition-colors"
        >
          <Settings2 className="size-4 shrink-0 group-hover:rotate-90 transition-transform" aria-hidden />
          Upravit nabídku
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => go("/portal/setup#quick-actions")}
          className="group w-full flex items-center gap-3 px-3 py-3 min-h-[48px] text-xs font-bold text-slate-400 hover:text-slate-600 rounded-xl text-left active:scale-[0.99] transition-transform"
        >
          <Settings2 className="size-4 shrink-0 group-hover:rotate-90 transition-transform" aria-hidden />
          Upravit nabídku
        </button>
      )}
    </>
  );
}
