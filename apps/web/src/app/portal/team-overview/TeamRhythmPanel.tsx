"use client";

import Link from "next/link";
import { CalendarClock, ListChecks, AlertCircle, CheckCircle2, Plus } from "lucide-react";
import type { TeamOverviewScope } from "@/lib/team-hierarchy-types";
import type { TeamRhythmComputed } from "@/lib/team-rhythm/compute-view";
import type { TeamCadenceRow } from "@/lib/team-rhythm/build-cadence";
import type { InternalRhythmCategory } from "@/lib/team-rhythm/internal-classification";
import type { TeamCalendarModalPrefill } from "./TeamCalendarModal";

function rhythmCategoryHint(c: InternalRhythmCategory): string {
  switch (c) {
    case "one_on_one_hint":
      return "1:1 / rozhovor";
    case "adaptation_checkin_hint":
      return "Adaptační check-in";
    case "team_meeting_hint":
      return "Porada";
    case "follow_up_hint":
      return "Follow-up";
    default:
      return "Interní";
  }
}

function cadenceKindLabel(kind: TeamCadenceRow["cadenceKind"]): string {
  switch (kind) {
    case "one_on_one_due":
      return "Doporučeno 1:1";
    case "adaptation_checkin_due":
      return "Adaptační check-in";
    case "followup_due":
      return "Doporučené navázání";
    case "data_completion_followup":
      return "Vyžaduje doplnění";
    case "monitor_only":
      return "Sledovat";
    default:
      return kind;
  }
}

export function TeamRhythmPanel({
  computed,
  disclaimer,
  scope,
  canCreate,
  memberDetailHref,
  resolveMemberLabel,
  onOpenEvent,
  onOpenTask,
}: {
  computed: TeamRhythmComputed;
  disclaimer: string;
  scope: TeamOverviewScope;
  canCreate: boolean;
  memberDetailHref: (userId: string) => string;
  resolveMemberLabel: (userId: string) => string;
  onOpenEvent: (prefill?: TeamCalendarModalPrefill) => void;
  onOpenTask: (prefill?: TeamCalendarModalPrefill) => void;
}) {
  const showCadence = scope !== "me";
  const hasOverdue = computed.overdueTasks.length > 0;

  return (
    <section
      className="mb-6 overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)]"
      aria-labelledby="team-rhythm-heading"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 bg-slate-50/40 px-6 py-4">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-teal-600 shrink-0" aria-hidden />
          <h2 id="team-rhythm-heading" className="text-lg font-black tracking-tight text-[color:var(--wp-text)]">
            Týmový rytmus
          </h2>
          {hasOverdue && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800 ring-1 ring-rose-200">
              <AlertCircle className="h-3 w-3" aria-hidden />
              Po termínu
            </span>
          )}
        </div>
        {canCreate && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onOpenTask({ title: "Follow-up — týmový přehled" })}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--wp-text-secondary)] transition hover:bg-slate-50"
            >
              <Plus className="h-3 w-3" aria-hidden />
              Úkol
            </button>
            <button
              type="button"
              onClick={() => onOpenEvent({ title: "Porada — rozvoj týmu" })}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-2xl bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-800"
            >
              <Plus className="h-3 w-3" aria-hidden />
              Schůzka
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-5 p-6 lg:grid-cols-12">
        {/* Statistiky */}
        <div className="lg:col-span-4 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--wp-text-tertiary)]">
            Tento týden / 14 dní
          </p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-[16px] border border-slate-200/80 bg-white px-4 py-3">
              <p className="text-lg font-black tabular-nums leading-none text-[color:var(--wp-text)]">
                {computed.stats.adaptationCheckinsThisWeek}
              </p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wide text-[color:var(--wp-text-tertiary)]">
                Adaptace
              </p>
            </div>
            <div className="rounded-[16px] border border-slate-200/80 bg-white px-4 py-3">
              <p className="text-lg font-black tabular-nums leading-none text-[color:var(--wp-text)]">
                {computed.stats.oneOnOneTaggedThisWeek}
              </p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wide text-[color:var(--wp-text-tertiary)]">
                1:1
              </p>
            </div>
            <div className="rounded-[16px] border border-slate-200/80 bg-white px-4 py-3">
              <p className="text-lg font-black tabular-nums leading-none text-[color:var(--wp-text)]">
                {computed.stats.teamMeetingsThisWeek}
              </p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wide text-[color:var(--wp-text-tertiary)]">
                Porady
              </p>
            </div>
            <div
              className={
                computed.stats.overdueTeamTasks > 0
                  ? "rounded-[16px] border border-rose-200/60 bg-rose-50/40 px-4 py-3"
                  : "rounded-[16px] border border-slate-200/80 bg-white px-4 py-3"
              }
            >
              <p
                className={`text-lg font-black tabular-nums leading-none ${computed.stats.overdueTeamTasks > 0 ? "text-rose-800" : "text-[color:var(--wp-text)]"}`}
              >
                {computed.stats.overdueTeamTasks}
              </p>
              <p
                className={`mt-0.5 text-[10px] uppercase tracking-wide ${computed.stats.overdueTeamTasks > 0 ? "text-rose-700/80" : "text-[color:var(--wp-text-tertiary)]"}`}
              >
                Po termínu
              </p>
            </div>
          </div>

          {showCadence && computed.coachingCadenceAlignedCount > 0 ? (
            <div className="rounded-2xl border border-teal-200/50 bg-teal-50/60 px-3 py-2 text-xs text-teal-900/90">
              <span className="font-bold">{computed.coachingCadenceAlignedCount}</span>{" "}
              {computed.coachingCadenceAlignedCount === 1 ? "osoba" : "lidí"} z „Potřebuje krok" jsou i v cadence — detail člena spojí kariéru a návrh termínu.
            </div>
          ) : null}
        </div>

        {/* Nadcházející */}
        <div className="lg:col-span-4 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--wp-text-tertiary)]">
            Nadcházející
          </p>
          {computed.upcomingEvents.length === 0 ? (
            <p className="text-xs text-[color:var(--wp-text-secondary)]">
              Žádné naplánované týmové události v příštích 14 dnech.
            </p>
          ) : (
            <ul className="space-y-1.5 max-h-52 overflow-y-auto">
              {computed.upcomingEvents.slice(0, 8).map((e) => (
                <li
                  key={e.id}
                  className={`rounded-2xl border px-3 py-2.5 text-xs ${e.withinWeek ? "border-teal-200/60 bg-teal-50/30" : "border-slate-200/80 bg-slate-50/40"}`}
                >
                  <p className="font-semibold text-[color:var(--wp-text)] line-clamp-1">{e.title}</p>
                  <p className="mt-0.5 text-[color:var(--wp-text-secondary)]">
                    {e.startAtDate.toLocaleString("cs-CZ", { dateStyle: "short", timeStyle: "short" })}
                    {e.withinWeek ? (
                      <span className="ml-1.5 font-semibold text-teal-700">tento týden</span>
                    ) : null}
                  </p>
                  <p className="text-[10px] text-[color:var(--wp-text-tertiary)]">
                    {rhythmCategoryHint(e.category ?? "internal_generic")}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {computed.recentPastEvents.length > 0 && (
            <div className="pt-2 border-t border-[color:var(--wp-surface-card-border)]/50">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--wp-text-tertiary)]">
                Nedávno proběhlo
              </p>
              <ul className="space-y-0.5 text-[11px] text-[color:var(--wp-text-secondary)]">
                {computed.recentPastEvents.slice(0, 3).map((e) => (
                  <li key={e.id} className="line-clamp-1">
                    {e.title} — {e.startAtDate.toLocaleDateString("cs-CZ")}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Úkoly */}
        <div className="lg:col-span-4 space-y-2">
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--wp-text-tertiary)]">
            <ListChecks className="h-3.5 w-3.5" aria-hidden />
            Úkoly
          </p>
          {hasOverdue ? (
            <div>
              <p className="mb-1.5 flex items-center gap-1 text-xs font-bold text-rose-800">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Po termínu
              </p>
              <ul className="space-y-1.5 max-h-28 overflow-y-auto">
                {computed.overdueTasks.slice(0, 5).map((t) => (
                  <li key={t.id} className="rounded-2xl border border-rose-200/50 bg-rose-50/30 px-2.5 py-2 text-xs">
                    <p className="font-semibold text-rose-800">{t.dueDateDate?.toLocaleDateString("cs-CZ")}</p>
                    <p className="text-[color:var(--wp-text-secondary)] line-clamp-1">{t.title}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-200/50 bg-emerald-50/30 px-3 py-2.5 text-xs">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
              <p className="text-emerald-800">Žádné týmové úkoly po termínu.</p>
            </div>
          )}
          {computed.upcomingTasks.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold text-[color:var(--wp-text)]">Blíží se termíny</p>
              <ul className="space-y-1 text-[11px] text-[color:var(--wp-text-secondary)] max-h-24 overflow-y-auto">
                {computed.upcomingTasks.slice(0, 5).map((t) => (
                  <li key={t.id} className="line-clamp-1">
                    {t.dueDateDate?.toLocaleDateString("cs-CZ")} · {t.title}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Cadence */}
      {showCadence ? (
        <div className="border-t border-slate-200/80 px-5 py-4">
          <p className="mb-2.5 text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--wp-text-tertiary)]">
            Doporučená cadence
          </p>
          {computed.cadenceWithoutUpcomingTouch.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-[color:var(--wp-text-secondary)]">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
              Termíny jsou v souladu s doporučeními — výborná práce.
            </div>
          ) : (
            <ul className="space-y-2">
              {computed.cadenceWithoutUpcomingTouch.slice(0, 6).map((c) => (
                <li
                  key={c.userId}
                  className="flex flex-col gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/60 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <Link
                      href={memberDetailHref(c.userId)}
                      className="font-semibold text-sm text-[color:var(--wp-text)] hover:underline"
                    >
                      {resolveMemberLabel(c.userId)}
                    </Link>
                    <p className="mt-0.5 text-[11px] text-[color:var(--wp-text-secondary)]">{c.reasonCs}</p>
                    <span className="mt-1 inline-block rounded-full border border-teal-200/60 bg-teal-100/80 px-2 py-0.5 text-[10px] font-bold text-teal-800">
                      {cadenceKindLabel(c.cadenceKind)}
                    </span>
                  </div>
                  {canCreate ? (
                    <div className="flex flex-wrap gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          onOpenEvent({
                            title: c.suggestEventTitle,
                            notes: c.reasonCs,
                            memberUserIds: [c.userId],
                          })
                        }
                        className="min-h-[36px] rounded-2xl bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-800"
                      >
                        Naplánovat 1:1
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onOpenTask({
                            title: c.suggestTaskTitle,
                            description: c.reasonCs,
                            memberUserIds: [c.userId],
                          })
                        }
                        className="min-h-[36px] rounded-2xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[color:var(--wp-text-secondary)] transition hover:bg-slate-50"
                      >
                        Úkol
                      </button>
                    </div>
                  ) : (
                    <Link
                      href={memberDetailHref(c.userId)}
                      className="text-xs font-semibold text-teal-700 hover:underline shrink-0"
                    >
                      Detail
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="px-5 pb-4 text-xs text-[color:var(--wp-text-tertiary)]">
          Plný cadence panel je pro manažerské zobrazení — přepněte rozsah na „Můj tým" nebo „Celá struktura".
        </p>
      )}

      <p className="border-t border-slate-200/80 px-5 py-2.5 text-[10px] text-[color:var(--wp-text-tertiary)]">
        {disclaimer}
      </p>
    </section>
  );
}
