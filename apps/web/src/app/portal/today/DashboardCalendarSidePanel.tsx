"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Calendar, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { CalendarWidget } from "@/app/components/calendar/CalendarWidget";
import { MessengerPreview } from "@/app/components/dashboard/MessengerPreview";
import { CreateActionButton } from "@/app/components/ui/CreateActionButton";
import type { DashboardAgendaTimelineRow } from "./dashboard-agenda-types";

type Props = {
  drawerOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  agendaEmpty: boolean;
  agendaTimelineRows: DashboardAgendaTimelineRow[];
  sidePanelTodayLabel: string;
};

/**
 * Pravý kalendářový panel nástěnky (desktopový PortalShell + DashboardEditable).
 * Mobile UI v1 používá [DashboardScreen](mobile/screens/DashboardScreen.tsx) a celý panel zde nekopíruje —
 * ekvivalent je odkaz na /portal/calendar a souhrn „Dnes“ na nástěnce.
 */
export function DashboardCalendarSidePanel({
  drawerOpen,
  onOpen,
  onClose,
  agendaEmpty,
  agendaTimelineRows,
  sidePanelTodayLabel,
}: Props) {
  const router = useRouter();

  return (
    <>
      {drawerOpen && (
        <button
          type="button"
          className="fixed inset-0 z-drawer-overlay bg-[color:var(--wp-overlay-scrim)] lg:hidden"
          aria-label="Zavřít panel"
          onClick={onClose}
        />
      )}

      <button
        type="button"
        onClick={onOpen}
        className={clsx(
          "fixed top-1/2 z-[35] flex h-32 w-10 -translate-y-1/2 flex-col items-center justify-center gap-2 rounded-l-2xl border border-r-0 border-[color:var(--wp-sc-panel-border)] bg-[color:var(--wp-sc-panel-bg)] py-3 pl-1 pr-0.5 shadow-[var(--wp-sc-panel-shadow)] backdrop-blur-md transition-all duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
          "right-[max(0px,env(safe-area-inset-right,0px))]",
          drawerOpen && "pointer-events-none translate-x-full opacity-0",
        )}
        aria-label="Otevřít kalendář, agendu a zprávy"
      >
        <ChevronLeft size={18} className="text-[color:var(--wp-text-muted)]" aria-hidden />
        <div className="h-px w-5 bg-[color:var(--wp-sc-timeline-line-via)]" aria-hidden />
        <Calendar size={20} className="text-indigo-600 dark:text-indigo-300" aria-hidden />
      </button>

      <aside
        className={clsx(
          "fixed inset-y-0 right-0 z-drawer-panel flex w-full max-w-[min(100vw,420px)] flex-col border-l border-[color:var(--wp-sc-panel-border)] bg-[color:var(--wp-sc-panel-bg)] shadow-[var(--wp-sc-panel-shadow)] backdrop-blur-xl transition-transform duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)] lg:max-w-[420px]",
          "pt-[env(safe-area-inset-top,0px)]",
          drawerOpen ? "translate-x-0" : "translate-x-full pointer-events-none",
        )}
        aria-hidden={!drawerOpen}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[color:var(--wp-sc-panel-border)] px-6 py-6 md:px-8">
          <Link
            href="/portal/calendar"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[color:var(--wp-text-muted)] transition-colors hover:bg-[color:var(--wp-link-hover-bg)] hover:text-[color:var(--wp-text)]"
            aria-label="Otevřít kalendář"
          >
            <Calendar size={22} aria-hidden />
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[color:var(--wp-text-muted)] transition-colors hover:bg-[color:var(--wp-link-hover-bg)] hover:text-[color:var(--wp-text)]"
            aria-label="Zavřít panel"
          >
            <ChevronRight size={24} aria-hidden />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="dashboard-sc-panel-scroll flex-1 space-y-6 overflow-y-auto p-4 sm:p-5 md:px-8 md:pb-6 md:pt-2">
            <section>
              <div className="group relative overflow-hidden rounded-3xl border border-[color:var(--wp-sc-card-border)] bg-[color:var(--wp-sc-card-bg)] p-6 shadow-lg backdrop-blur-xl">
                <div
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  aria-hidden
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(99,102,241,0.06) 0%, rgba(168,85,247,0.05) 100%)",
                  }}
                />
                <div className="relative mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-black tracking-tight text-[color:var(--wp-text)]">Dnes</h2>
                    <p className="text-sm font-semibold text-[color:var(--wp-text-muted)]">{sidePanelTodayLabel}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push("/portal/calendar?new=1")}
                    className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white shadow-md shadow-indigo-500/25 transition-transform hover:scale-105 active:scale-95 dark:bg-indigo-500"
                    aria-label="Nová aktivita v kalendáři"
                  >
                    <Plus size={22} aria-hidden />
                  </button>
                </div>
                <div className="relative">
                  <CalendarWidget hideTitle onNewActivity={() => router.push("/portal/calendar?new=1")} variant="darkPanel" />
                </div>
              </div>
            </section>

            <section className="space-y-4 border-t border-[color:var(--wp-sc-panel-border)] pt-6">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[color:var(--wp-text-muted)]">Agenda</h3>
              {agendaEmpty ? (
                <p className="text-sm text-[color:var(--wp-text-muted)]">Dnes nic naplánováno.</p>
              ) : (
                <div className="relative pl-2">
                  <div
                    className="absolute bottom-2 left-[15px] top-2 w-px bg-gradient-to-b from-[color:var(--wp-sc-timeline-line-from)] via-[color:var(--wp-sc-timeline-line-via)] to-transparent"
                    aria-hidden
                  />
                  <ul className="space-y-4">
                    {agendaTimelineRows.map((row) => (
                      <li key={row.id} className="relative flex gap-4 pl-1">
                        <div className="relative z-[1] mt-1.5 flex h-3 w-3 shrink-0 items-center justify-center rounded-full border-2 border-[color:var(--wp-sc-timeline-dot-border)] bg-[color:var(--wp-sc-timeline-dot-bg)] shadow-sm" />
                        <Link
                          href={row.kind === "event" ? "/portal/calendar" : "/portal/tasks"}
                          className="min-w-0 flex-1 rounded-2xl border border-[color:var(--wp-sc-card-border)] bg-[color:var(--wp-sc-card-bg)] p-4 shadow-sm backdrop-blur-md transition-colors hover:border-indigo-300/40 hover:bg-[color:var(--wp-message-box-hover)]"
                        >
                          <p className="text-[10px] font-black uppercase tracking-wider text-[color:var(--wp-text-muted)]">{row.time}</p>
                          <p className="mt-1 text-sm font-bold text-[color:var(--wp-text)]">{row.title}</p>
                          {row.sub ? <p className="mt-0.5 text-xs text-[color:var(--wp-text-muted)]">{row.sub}</p> : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            <section className="space-y-3 border-t border-[color:var(--wp-sc-panel-border)] pt-6">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[color:var(--wp-text-muted)]">Zprávy z portálu</h3>
              <MessengerPreview forDarkPanel />
            </section>
          </div>

          <div className="flex-shrink-0 border-t border-[color:var(--wp-sc-panel-border)] bg-[color:var(--wp-sc-card-bg)] p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] backdrop-blur-md md:px-8">
            <CreateActionButton
              type="button"
              onClick={() => router.push("/portal/calendar?new=1")}
              className="w-full min-h-[48px] py-3 shadow-lg"
            >
              Nová aktivita
            </CreateActionButton>
          </div>
        </div>
      </aside>
    </>
  );
}
