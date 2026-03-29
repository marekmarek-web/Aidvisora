"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Bell, Calendar as CalendarIcon, Clock, MapPin, Video, User, X, Edit2, Trash2, Zap, ArrowRight, Send } from "lucide-react";
import type { EventRow } from "@/app/actions/events";
import type { TaskRow } from "@/app/actions/tasks";
import { getEventCategory } from "./event-categories";
import { formatTimeQuarterHourDisplay } from "./date-utils";
import {
  buildEventMailtoHref,
  EventDetailInfoBlock,
  EventTypeChipGrid,
  formatEventDetailDateLine,
  getEventAccentStyle,
} from "./event-detail-ui";
import { PreMeetingBriefPanel } from "@/app/components/meeting-briefing/PreMeetingBriefPanel";
import clsx from "clsx";
import { CalendarEventAiActions } from "./CalendarEventAiActions";
import { portalPrimaryButtonClassName } from "@/lib/ui/create-action-button-styles";

function formatTime(d: Date): string {
  return formatTimeQuarterHourDisplay(d);
}

function formatDateLabel(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("cs-CZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

const MONTH_NAMES = ["Leden", "Únor", "Březen", "Duben", "Květen", "Červen", "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec"];
function formatMonthYear(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function getFreeSlots(dayEvents: EventRow[], dateStr: string): { start: string; end: string }[] {
  const dayStart = new Date(dateStr + "T07:00:00").getTime();
  const dayEnd = new Date(dateStr + "T20:00:00").getTime();
  const withTimes = dayEvents
    .filter((e) => !e.allDay && e.startAt && e.endAt)
    .map((e) => ({
      start: new Date(e.startAt).getTime(),
      end: new Date(e.endAt!).getTime(),
    }))
    .filter((e) => e.start >= dayStart && e.end <= dayEnd)
    .sort((a, b) => a.start - b.start);

  const slots: { start: string; end: string }[] = [];
  let lastEnd = dayStart;
  for (const block of withTimes) {
    if (block.start - lastEnd >= 30 * 60 * 1000) {
      slots.push({
        start: new Date(lastEnd).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" }),
        end: new Date(block.start).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" }),
      });
    }
    lastEnd = Math.max(lastEnd, block.end);
  }
  if (dayEnd - lastEnd >= 30 * 60 * 1000) {
    slots.push({
      start: new Date(lastEnd).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" }),
      end: new Date(dayEnd).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" }),
    });
  }
  return slots;
}

export interface CalendarContextPanelProps {
  selectedEvent: EventRow | null;
  selectedDate: string;
  dayEvents: EventRow[];
  dayTasks: TaskRow[];
  dayTasksLoading: boolean;
  unreadMessagesCount?: number;
  onEditEvent: (event: EventRow) => void;
  onQuickEditEvent?: (event: EventRow) => void;
  onDeleteEvent: (event: EventRow) => void;
  onFollowUp: (eventId: string) => void;
  onOpenFullEdit: (event: EventRow) => void;
  onMarkDone: (event: EventRow) => void;
  onToggleTask: (task: TaskRow) => void;
  onRefresh: () => void;
  /** Called when user clicks "Přidat úkol"; parent should open new-task modal with this date. */
  onAddTask?: (dateStr: string) => void;
  onChangeEventType?: (event: EventRow, nextType: string) => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  /** Zavře detail vybrané události (např. návrat na agendu v panelu). */
  onCloseSelectedEvent?: () => void;
  isMobile?: boolean;
  eventTypeColors?: Record<string, string>;
}

export function CalendarContextPanel({
  selectedEvent,
  selectedDate,
  dayEvents,
  dayTasks,
  dayTasksLoading,
  unreadMessagesCount = 0,
  onEditEvent,
  onDeleteEvent,
  onOpenFullEdit,
  onMarkDone,
  onToggleTask,
  onAddTask,
  onChangeEventType,
  onToggleCollapsed,
  onCloseSelectedEvent,
  isMobile = false,
  eventTypeColors,
}: CalendarContextPanelProps) {
  const freeSlots = useMemo(
    () => getFreeSlots(dayEvents, selectedDate),
    [dayEvents, selectedDate]
  );
  const openTasks = dayTasks.filter((t) => !t.completedAt);

  const wrapMobile = (children: React.ReactNode) => {
    if (!isMobile) return children;
    return (
      <>
        <div className="wp-cal-context-panel--mobile-backdrop" onClick={onToggleCollapsed} />
        <div className="wp-cal-context-panel--mobile-sheet">{children}</div>
      </>
    );
  };

  if (selectedEvent) {
    const start = new Date(selectedEvent.startAt);
    const end = selectedEvent.endAt ? new Date(selectedEvent.endAt) : null;
    const timeStr = `${formatTime(start)}${end ? ` – ${formatTime(end)}` : ""}`;
    const typeCat = getEventCategory(selectedEvent.eventType);
    const hasVideoLink = selectedEvent.meetingLink && (selectedEvent.eventType === "telefonat" || selectedEvent.meetingLink.includes("meet") || selectedEvent.meetingLink.includes("zoom"));
    const dateLine = formatEventDetailDateLine(selectedEvent);
    const accentStyle = getEventAccentStyle(selectedEvent, eventTypeColors);
    const mailtoHref = buildEventMailtoHref(selectedEvent);

    return (
      <aside
        className={`wp-cal-context-panel bg-[color:var(--wp-surface-card)] rounded-2xl shadow-sm border border-[color:var(--wp-surface-card-border)] flex flex-col overflow-hidden z-30 transition-all flex-shrink-0 ${
          isMobile ? "wp-cal-context-panel--mobile" : ""
        }`}
      >
        {wrapMobile(
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="h-1.5 w-full" style={accentStyle} />
          <div className="px-5 py-4">
            <div className="mb-4 flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => onOpenFullEdit(selectedEvent)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-500 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                aria-label="Upravit"
              >
                <Edit2 size={16} />
              </button>
              <a
                href={mailtoHref}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-500 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                aria-label="Poslat e-mail"
              >
                <Send size={16} />
              </a>
              <button
                type="button"
                onClick={() => onDeleteEvent(selectedEvent)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
                aria-label="Smazat"
              >
                <Trash2 size={16} />
              </button>
              <div className="mx-1 h-5 w-px bg-slate-200" />
              {(onCloseSelectedEvent || onToggleCollapsed) && (
                <button
                  type="button"
                  onClick={() => {
                    onCloseSelectedEvent?.();
                    if (!onCloseSelectedEvent) onToggleCollapsed?.();
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-800"
                  aria-label={onCloseSelectedEvent ? "Zavřít detail události" : "Zavřít panel"}
                >
                  <X size={18} />
                </button>
              )}
            </div>

            <div className="mb-5 px-1">
              <h2 className="text-2xl font-extrabold leading-tight text-[#0B1021] break-words">{selectedEvent.title}</h2>
              <p className="mt-1 text-xs font-bold text-[color:var(--wp-text-secondary)]">
                {typeCat.label}
              </p>
            </div>

            <EventTypeChipGrid
              eventType={selectedEvent.eventType}
              eventTypeColors={eventTypeColors}
              onChangeType={onChangeEventType ? (nextType) => onChangeEventType(selectedEvent, nextType) : undefined}
              className="mb-5 px-1"
            />

            <div className="space-y-2 px-1">
              <EventDetailInfoBlock icon={Clock} label="Kdy" accentStyle={accentStyle}>
                <p className="text-sm font-semibold text-slate-800">{dateLine}</p>
                {!selectedEvent.allDay ? (
                  <p className="mt-0.5 text-xs text-slate-500">Čas zobrazen po čtvrthodinách</p>
                ) : null}
              </EventDetailInfoBlock>
              <EventDetailInfoBlock icon={MapPin} label="Místo" subdued={!selectedEvent.location}>
                <p className={selectedEvent.location ? "text-sm font-medium text-slate-700" : "text-sm font-medium text-slate-500"}>
                  {selectedEvent.location?.trim() || "Místo nebylo zadáno."}
                </p>
              </EventDetailInfoBlock>
            </div>
          </div>

          <div className="p-5 space-y-6 flex-1 overflow-y-auto wp-cal-hide-scrollbar">
            <div className="space-y-4">
              {selectedEvent.reminderAt && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[color:var(--wp-surface-muted)] flex items-center justify-center text-[color:var(--wp-text-secondary)] shrink-0">
                    <Bell size={14} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">Připomenutí</p>
                    <p className="text-sm font-bold text-[color:var(--wp-text)]">
                      {new Date(selectedEvent.reminderAt).toLocaleString("cs-CZ", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                </div>
              )}
              {hasVideoLink ? (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[color:var(--wp-surface-muted)] flex items-center justify-center text-[color:var(--wp-text-secondary)] shrink-0">
                    <Video size={14} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">Forma</p>
                    <p className="text-sm font-bold text-[color:var(--wp-text)]">Online hovor</p>
                  </div>
                </div>
              ) : null}
            </div>

            {selectedEvent.meetingLink && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex flex-col gap-2">
                <a
                  href={selectedEvent.meetingLink.startsWith("http") ? selectedEvent.meetingLink : `https://${selectedEvent.meetingLink}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={clsx(portalPrimaryButtonClassName, "w-full rounded-lg py-2.5 text-sm shadow-sm")}
                >
                  <Video size={16} /> Připojit se k hovoru
                </a>
              </div>
            )}

            {selectedEvent.contactName && (
              <div className="pt-4 border-t border-[color:var(--wp-surface-card-border)]">
                <p className="text-[10px] font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)] mb-3">Účastník</p>
                <Link
                  href={selectedEvent.contactId ? `/portal/contacts/${selectedEvent.contactId}` : "#"}
                  className="flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-black text-sm shadow-sm shrink-0">
                      {selectedEvent.contactName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .substring(0, 2)
                        .toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[color:var(--wp-text)] group-hover:text-indigo-600">{selectedEvent.contactName}</p>
                      <p className="text-[11px] font-medium text-[color:var(--wp-text-secondary)]">Otevřít profil klienta</p>
                    </div>
                  </div>
                </Link>
              </div>
            )}

            {selectedEvent.contactId && (
              <div className="pt-4 border-t border-[color:var(--wp-surface-card-border)] space-y-3">
                <PreMeetingBriefPanel contactId={selectedEvent.contactId} eventId={selectedEvent.id} compact />
                <CalendarEventAiActions
                  contactId={selectedEvent.contactId}
                  eventId={selectedEvent.id}
                  eventNotes={selectedEvent.notes}
                />
                <Link
                  href={`/portal/contacts/${selectedEvent.contactId}?eventId=${selectedEvent.id}#briefing`}
                  className="inline-flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700 min-h-[44px] items-center"
                >
                  Po schůzce – shrnutí a kroky <ArrowRight size={14} />
                </Link>
              </div>
            )}

            {selectedEvent.notes && (
              <div className="pt-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)] mb-1">Poznámka</p>
                <p className="text-sm text-[color:var(--wp-text-secondary)] whitespace-pre-wrap">{selectedEvent.notes}</p>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => onOpenFullEdit(selectedEvent)}
              className="flex items-center justify-center gap-2 py-2 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg"
            >
              <Edit2 size={14} className="text-blue-600" /> Upravit
            </button>
            <a
              href={mailtoHref}
              className="flex items-center justify-center gap-2 rounded-lg border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] py-2 text-xs font-bold text-[color:var(--wp-text-secondary)]"
            >
              <Send size={14} /> Poslat
            </a>
            <button
              type="button"
              onClick={() => onDeleteEvent(selectedEvent)}
              className="flex items-center justify-center gap-2 py-2 text-xs font-bold text-rose-600 bg-[color:var(--wp-surface-card)] hover:bg-rose-50 border border-[color:var(--wp-surface-card-border)] rounded-lg"
            >
              <Trash2 size={14} /> Smazat
            </button>
          </div>
        </div>
        )}
      </aside>
    );
  }

  return (
    <aside
      className={`wp-cal-context-panel bg-[color:var(--wp-surface-card)] rounded-2xl shadow-sm border border-[color:var(--wp-surface-card-border)] flex flex-col overflow-hidden z-30 transition-all flex-shrink-0 ${
        isMobile ? "wp-cal-context-panel--mobile" : ""
      }`}
    >
      {wrapMobile(
      <>
      <div className="p-6 border-b border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] flex items-center justify-between">
        <h3 className="text-xs font-black uppercase tracking-widest text-[color:var(--wp-text)]">
          Agenda • {formatMonthYear(selectedDate)}
        </h3>
        {onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="text-[color:var(--wp-text-tertiary)] hover:text-indigo-600 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-md hover:bg-[color:var(--wp-surface-muted)]"
            aria-label="Zavřít panel"
          >
            <X size={16} />
          </button>
        )}
      </div>
      <div className="flex-1 p-6 overflow-y-auto wp-cal-hide-scrollbar space-y-4 bg-[color:var(--wp-surface-muted)]/30">
        <div className="mt-2 rounded-2xl border border-fuchsia-500/20 bg-gradient-to-b from-fuchsia-500/12 to-indigo-500/8 p-4 dark:border-fuchsia-400/25 dark:from-fuchsia-500/18 dark:to-indigo-500/12">
          <div className="mb-2 flex items-center gap-2">
            <Zap size={14} className="shrink-0 text-fuchsia-600 dark:text-fuchsia-300" />
            <span className="text-[10px] font-black uppercase tracking-widest text-[color:var(--wp-text)] dark:text-fuchsia-200/90">
              Nástroje poradce
            </span>
          </div>
          <p className="mb-3 text-xs font-medium leading-relaxed text-[color:var(--wp-text-secondary)]">
            Klikněte na libovolnou událost v mřížce vlevo – zde se zobrazí detail a můžete ji upravit, označit jako hotovou nebo vytvořit návazný úkol.
          </p>
        </div>

        {/* Úkoly – hlavní sekce */}
        <section className="bg-[color:var(--wp-surface-card)] rounded-xl border border-[color:var(--wp-surface-card-border)] shadow-sm p-4">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-3">Úkoly</h4>
          {dayTasksLoading ? (
            <p className="text-sm text-[color:var(--wp-text-secondary)]">Načítám…</p>
          ) : dayTasks.length === 0 ? (
            <p className="text-sm text-[color:var(--wp-text-secondary)] mb-2">Žádné úkoly na tento den</p>
          ) : (
            <ul className="space-y-2 mb-3">
              {dayTasks.map((task) => (
                <li key={task.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onToggleTask(task)}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-[color:var(--wp-text-tertiary)] bg-[color:var(--wp-surface-card)] transition-colors hover:border-indigo-400 hover:bg-[color:var(--wp-surface-muted)] dark:border-white/35 dark:bg-[color:var(--wp-surface-muted)]/80"
                    style={task.completedAt ? { background: "var(--wp-success)", borderColor: "var(--wp-success)" } : {}}
                    aria-label={task.completedAt ? "Znovu otevřít" : "Splnit"}
                  >
                    {task.completedAt && <span className="text-white text-xs">✓</span>}
                  </button>
                  <span className={`text-sm ${task.completedAt ? "text-[color:var(--wp-text-tertiary)] line-through" : "text-[color:var(--wp-text)]"}`}>
                    {task.title}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {onAddTask && (
            <button
              type="button"
              onClick={() => onAddTask(selectedDate)}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors"
            >
              + Přidat úkol
            </button>
          )}
          <Link href="/portal/tasks" className="text-xs font-bold text-indigo-600 hover:text-indigo-700 mt-2 inline-block">
            Všechny úkoly →
          </Link>
        </section>

        <p className="text-sm font-medium text-[color:var(--wp-text-secondary)] text-center pt-0">
          Klikněte na jakoukoliv událost v mřížce pro zobrazení detailu.
        </p>

        <section>
          <h4 className="text-[10px] font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)] mb-2">Události dne</h4>
          {dayEvents.length === 0 ? (
            <p className="text-sm text-[color:var(--wp-text-secondary)]">Žádné události</p>
          ) : (
            <ul className="space-y-1.5">
              {dayEvents
                .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
                .map((ev) => {
                  const c = getEventCategory(ev.eventType);
                  return (
                    <li key={ev.id} className="flex items-center gap-2 text-sm">
                      <span className="text-[color:var(--wp-text-tertiary)] shrink-0">{formatTime(new Date(ev.startAt))}</span>
                      <span className="font-medium text-[color:var(--wp-text)] truncate">{ev.title}</span>
                      {ev.contactName && (
                        <span className="text-[color:var(--wp-text-secondary)] text-xs truncate hidden sm:inline">· {ev.contactName}</span>
                      )}
                    </li>
                  );
                })}
            </ul>
          )}
        </section>

        {freeSlots.length > 0 && (
          <section>
            <h4 className="text-[10px] font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)] mb-2">Volná okna</h4>
            <ul className="space-y-1 text-sm text-[color:var(--wp-text-secondary)]">
              {freeSlots.slice(0, 5).map((slot, i) => (
                <li key={i}>
                  {slot.start} – {slot.end}
                </li>
              ))}
            </ul>
          </section>
        )}

        {unreadMessagesCount > 0 && (
          <Link
            href="/portal/messages"
            className="inline-flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700"
          >
            Zprávy čekající na reakci ({unreadMessagesCount})
          </Link>
        )}
      </div>
      </>
      )}
    </aside>
  );
}
