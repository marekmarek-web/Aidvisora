"use client";

import Link from "next/link";
import clsx from "clsx";
import { X, Calendar, CheckSquare, Layers3, FileText, ExternalLink } from "lucide-react";
import type { TeamMemberDetail } from "@/app/actions/team-overview";
import { formatCareerProgramLabel, formatCareerTrackLabel } from "@/lib/career/evaluate-career-progress";
import { careerProgressShortLabel } from "@/lib/career/career-ui-labels";
import { buildTeamMemberCoachingSummaryBullets } from "@/lib/team-member-coaching-bullets";
import { crmUnitsFootnoteForProgram } from "@/lib/career/crm-units-copy";
import { SkeletonBlock } from "@/app/components/Skeleton";
import { MemberCareerQuickActions } from "@/app/portal/team-overview/[userId]/MemberCareerQuickActions";
import { formatTeamOverviewProduction, poolProgramLabel } from "@/lib/team-overview-format";
import type { TeamMemberMetrics } from "@/lib/team-overview-alerts";
import type { CareerProgramId } from "@/lib/career/types";

function poolLine(programId: CareerProgramId): string {
  if (programId === "beplan" || programId === "premium_brokers") return poolProgramLabel(programId);
  return formatCareerProgramLabel(programId);
}

export function TeamOverviewSelectedMemberPanel({
  detail,
  loading,
  fullDetailHref,
  onClose,
  canCreateTeamCalendar,
  canEditTeamCareer,
  outsideFilter = false,
  variant = "default",
  /** Když je výběr v URL/state, ale detail se nenačetl — neukazovat „Vyberte člena“. */
  selectedUserId = null,
  /** Metriky ze seznamu (snapshot), když `detail.metrics` ještě chybí. */
  metricsSnapshot = null,
  onOpenCrm,
  onOpenProgress,
  onOpenCheckIn,
  onOpenOneToOne,
  onOpenTask,
}: {
  detail: TeamMemberDetail | null;
  loading: boolean;
  fullDetailHref: string;
  onClose: () => void;
  canCreateTeamCalendar: boolean;
  canEditTeamCareer: boolean;
  outsideFilter?: boolean;
  variant?: "default" | "premium";
  selectedUserId?: string | null;
  metricsSnapshot?: TeamMemberMetrics | null;
  onOpenCrm?: () => void;
  onOpenProgress?: () => void;
  onOpenCheckIn?: () => void;
  onOpenOneToOne?: () => void;
  onOpenTask?: () => void;
}) {
  const premium = variant === "premium";
  const shell = (classes: string) =>
    clsx(
      "xl:sticky xl:top-6 h-fit",
      premium
        ? "overflow-hidden rounded-[32px] border border-slate-800 bg-[#16192b] text-white shadow-[0_20px_40px_rgba(0,0,0,0.15)]"
        : "rounded-2xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] shadow-sm",
      classes
    );

  if (loading) {
    return (
      <aside
        className={shell("space-y-3 p-5")}
        aria-busy="true"
        aria-label="Načítání detailu člena"
      >
        <SkeletonBlock className="h-7 w-2/3 rounded-lg" />
        <SkeletonBlock className="h-20 rounded-xl" />
        <SkeletonBlock className="h-28 rounded-xl" />
        <SkeletonBlock className="h-16 rounded-xl" />
      </aside>
    );
  }

  if (!detail) {
    if (selectedUserId) {
      return (
        <aside
          className={clsx(
            "xl:sticky xl:top-6 h-fit p-6 text-sm",
            premium
              ? "rounded-[32px] border border-slate-800 bg-[#16192b] text-white shadow-[0_20px_40px_rgba(0,0,0,0.15)]"
              : "rounded-2xl border border-amber-200/80 bg-amber-50/40 text-[color:var(--wp-text-secondary)]"
          )}
          role="alert"
        >
          <p className={premium ? "font-semibold text-white" : "font-semibold text-[color:var(--wp-text)]"}>
            Detail člena se nepodařilo načíst
          </p>
          <p
            className={
              premium
                ? "mt-1.5 text-xs leading-relaxed text-slate-300"
                : "mt-1.5 text-xs leading-relaxed text-[color:var(--wp-text-secondary)]"
            }
          >
            Zkuste obnovit data, změnit rozsah přehledu nebo otevřít plný detail.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={fullDetailHref}
              className={premium ? "inline-flex items-center gap-1 text-xs font-semibold text-sky-300 hover:text-white hover:underline" : "inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"}
            >
              Plný detail
              <ExternalLink className="h-3 w-3" aria-hidden />
            </Link>
            <button
              type="button"
              onClick={onClose}
              className={premium ? "text-xs font-semibold text-slate-300 underline hover:text-white" : "text-xs font-semibold text-slate-600 underline hover:text-slate-900"}
            >
              Zrušit výběr
            </button>
          </div>
        </aside>
      );
    }

    return (
      <aside
        className={clsx(
          "xl:sticky xl:top-6 h-fit p-6 text-sm",
          premium
            ? "rounded-[32px] border border-slate-800 bg-[#16192b] text-slate-300 shadow-[0_20px_40px_rgba(0,0,0,0.15)]"
            : "rounded-2xl border border-dashed border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-muted)]/20 text-[color:var(--wp-text-secondary)]"
        )}
      >
        <p className={premium ? "font-semibold text-white" : "font-semibold text-[color:var(--wp-text)]"}>
          Vyberte člena
        </p>
        <p
          className={
            premium
              ? "mt-1.5 text-xs leading-relaxed text-slate-300"
              : "mt-1.5 text-xs leading-relaxed text-[color:var(--wp-text-secondary)]"
          }
        >
          Klikněte na řádek v seznamu, na uzel ve struktuře nebo na položku v přehledu pozornosti — zobrazí se souhrn pro 1:1.
        </p>
      </aside>
    );
  }

  const name = detail.displayName || "Člen týmu";
  const m = detail.metrics ?? metricsSnapshot;
  const ce = detail.careerEvaluation;
  const coachingBullets = buildTeamMemberCoachingSummaryBullets(detail);
  const showModalActions =
    premium && (onOpenCrm || onOpenProgress || onOpenCheckIn || onOpenOneToOne || onOpenTask);
  const progressValue = Math.max(0, Math.min(100, m?.targetProgressPercent ?? 0));
  const readinessLabel = ce.missingRequirements.length > 0 ? `Blokace: ${ce.missingRequirements[0].labelCs}` : "Všechny podmínky pro postup splněny";

  const actionButtonClass =
    "flex min-h-[74px] flex-col items-start justify-between rounded-[16px] border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:bg-white/10";

  return (
    <aside
      className={clsx(
        "xl:sticky xl:top-6 h-fit max-h-[min(90vh,calc(100vh-4rem))] overflow-y-auto",
        premium
          ? "rounded-[32px] border border-slate-800 bg-[#16192b] text-white shadow-[0_20px_40px_rgba(0,0,0,0.15)]"
          : "rounded-2xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] shadow-sm"
      )}
    >
      <div className={premium ? "border-b border-white/10 px-8 pb-6 pt-8" : "border-b px-5 py-4"}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={premium ? "text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400" : "text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500"}>
              Vybraný člen
            </p>
            <h2 className={premium ? "mt-3 text-[28px] font-black leading-none tracking-tight text-white" : "mt-1 text-xl font-black leading-tight text-slate-950"}>
              {name}
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={premium ? "rounded-[8px] border border-white/10 bg-white/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-white" : "rounded-[8px] border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-700"}>
                {detail.roleName}
              </span>
              {detail.adaptation ? (
                <span className="rounded-[8px] border border-sky-500/20 bg-sky-500/15 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-sky-300">
                  V adaptaci
                </span>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={premium ? "rounded-full bg-white/5 p-2 text-slate-400 transition hover:bg-white/10 hover:text-white" : "shrink-0 mt-0.5 rounded-lg p-1.5 text-[color:var(--wp-text-tertiary)] hover:bg-[color:var(--wp-surface-muted)] hover:text-[color:var(--wp-text)]"}
            aria-label="Zavřít výběr"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className={premium ? "space-y-6 px-8 pb-8 pt-6" : "space-y-5 px-5 py-4"}>
        {outsideFilter && (
          <div className={premium ? "rounded-[12px] border border-amber-500/20 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-200" : "rounded-2xl border border-amber-200/70 bg-amber-50/60 px-3.5 py-2.5 text-xs text-amber-950"} role="status">
            Člen není v aktuálním filtru tabulky — souhrn je platný.
          </div>
        )}

        <div className={premium ? "grid grid-cols-2 gap-4" : "grid grid-cols-2 gap-3"}>
          <div>
            <div className={premium ? "mb-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400" : "mb-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500"}>
              Skupina (pool)
            </div>
            <div className={premium ? "text-sm font-bold text-white" : "text-sm font-bold text-slate-950"}>
              {poolLine(ce.careerProgramId)}
            </div>
            <div className={premium ? "mt-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-emerald-300" : "mt-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-emerald-700"}>
              {careerProgressShortLabel(ce.progressEvaluation)}
            </div>
          </div>
          <div>
            <div className={premium ? "mb-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400" : "mb-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500"}>
              Kariérní větev / pozice
            </div>
            <div className={premium ? "text-sm font-bold text-white" : "text-sm font-bold text-slate-950"}>
              {formatCareerTrackLabel(ce.careerTrackId)}
            </div>
            <div className={premium ? "mt-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400" : "mt-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500"}>
              Pozice: {ce.careerPositionLabel ?? "—"}
            </div>
          </div>
        </div>

        {m ? (
          <section className={premium ? "rounded-[20px] border border-white/5 bg-white/5 p-5" : "rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4"}>
            <div className="flex items-end justify-between gap-3">
              <div className={premium ? "text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400" : "text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500"}>
                Plnění cíle
              </div>
              <div className={premium ? "text-right text-[20px] font-black text-white" : "text-right text-lg font-black text-slate-950"}>
                {formatTeamOverviewProduction(m.productionThisPeriod)}
                {m.targetProgressPercent != null ? (
                  <span className={premium ? "ml-1 text-[11px] font-bold text-slate-500" : "ml-1 text-[11px] font-bold text-slate-400"}>/ {m.targetProgressPercent}%</span>
                ) : null}
              </div>
            </div>
            <div className={premium ? "mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-800" : "mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200"}>
              <div
                className={clsx("h-full rounded-full", progressValue >= 100 ? "bg-emerald-500" : "bg-amber-500")}
                style={{ width: `${progressValue}%` }}
              />
            </div>
            <div className={premium ? "mt-3 flex items-center gap-1.5 text-[11px] font-bold text-slate-400" : "mt-3 text-[11px] font-bold text-slate-500"}>
              {m.meetingsThisPeriod} schůzek evidováno
            </div>
          </section>
        ) : null}

        <section className={premium ? "border-t border-white/10 pt-6" : ""}>
          <div className={premium ? "mb-3 text-[10px] font-extrabold uppercase tracking-[0.16em] text-purple-300" : "mb-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-violet-700"}>
            Další kariérní krok: {ce.nextCareerPositionLabel ?? "Bez určeného dalšího kroku"}
          </div>
          <div
            className={clsx(
              "rounded-[12px] border px-3 py-3 text-[11px] font-bold",
              ce.missingRequirements.length > 0
                ? premium
                  ? "border-red-500/20 bg-red-500/10 text-red-300"
                  : "border-red-200 bg-red-50 text-red-700"
                : premium
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
            )}
          >
            {readinessLabel}
          </div>
          <div className={premium ? "mt-3 text-xs font-bold text-slate-400" : "mt-3 text-xs font-bold text-slate-500"}>
            Poslední kontakt:{" "}
            <span className={premium ? "text-white" : "text-slate-900"}>
              {m?.daysSinceMeeting != null ? `před ${m.daysSinceMeeting} dny` : "Bez kontaktu"}
            </span>
          </div>
        </section>

        {detail.adaptation ? (
          <section className={premium ? "rounded-[20px] border border-white/5 bg-white/5 p-4" : "rounded-2xl border border-slate-200/80 bg-slate-50 p-4"}>
            <div className={premium ? "text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400" : "text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500"}>
              Adaptace
            </div>
            <div className={premium ? "mt-2 text-sm font-bold text-white" : "mt-2 text-sm font-bold text-slate-950"}>
              {detail.adaptation.adaptationStatus} · {detail.adaptation.adaptationScore} %
            </div>
          </section>
        ) : null}

        <section>
          <div className={premium ? "mb-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400" : "mb-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500"}>
            Coaching a 1:1
          </div>
          <div className={premium ? "rounded-[20px] border border-white/5 bg-white/5 p-4" : "rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4"}>
            <p className={premium ? "text-sm font-semibold text-white" : "text-sm font-semibold text-slate-950"}>
              {detail.careerCoaching.suggestedNextStepLine}
            </p>
            <p className={premium ? "mt-2 text-[11px] font-bold text-purple-300" : "mt-2 text-[11px] font-bold text-violet-700"}>
              {detail.careerCoaching.recommendedActionLabelCs}
            </p>
            {detail.careerCoaching.oneOnOneAgenda.length > 0 ? (
              <ul className={premium ? "mt-3 space-y-1 text-[11px] text-slate-300" : "mt-3 space-y-1 text-[11px] text-slate-600"}>
                {detail.careerCoaching.oneOnOneAgenda.slice(0, 4).map((item, i) => (
                  <li key={i}>{item.text}</li>
                ))}
              </ul>
            ) : null}
          </div>
          {!premium ? (
            <MemberCareerQuickActions
              memberUserId={detail.userId}
              coaching={detail.careerCoaching}
              canCreateTeamCalendar={canCreateTeamCalendar}
              canEditTeamCareer={canEditTeamCareer}
            />
          ) : null}
        </section>

        {coachingBullets.length > 0 ? (
          <section>
            <div className={premium ? "mb-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400" : "mb-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500"}>
              Coaching summary
            </div>
            <ul className={premium ? "space-y-1 text-[11px] text-slate-300" : "space-y-1 text-[11px] text-slate-600"}>
              {coachingBullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {m ? (
          <p className={premium ? "text-[10px] leading-snug text-slate-500" : "text-[10px] leading-snug text-slate-500"}>
            {crmUnitsFootnoteForProgram(ce.careerProgramId)}
          </p>
        ) : null}

        {showModalActions ? (
          <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-6">
            {onOpenOneToOne ? (
              <button type="button" onClick={onOpenOneToOne} className={actionButtonClass}>
                <Calendar className="h-4 w-4 text-white" aria-hidden />
                <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-white">Schůzka 1:1</span>
              </button>
            ) : null}
            {onOpenTask ? (
              <button type="button" onClick={onOpenTask} className={actionButtonClass}>
                <CheckSquare className="h-4 w-4 text-slate-200" aria-hidden />
                <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-white">Nový úkol</span>
              </button>
            ) : null}
            {onOpenProgress ? (
              <button type="button" onClick={onOpenProgress} className={actionButtonClass}>
                <Layers3 className="h-4 w-4 text-slate-200" aria-hidden />
                <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-white">Strom progresu</span>
              </button>
            ) : null}
            {onOpenCrm ? (
              <button type="button" onClick={onOpenCrm} className={actionButtonClass}>
                <FileText className="h-4 w-4 text-slate-200" aria-hidden />
                <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-white">CRM karta</span>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
