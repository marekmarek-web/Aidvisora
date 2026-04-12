"use client";

import Link from "next/link";
import clsx from "clsx";
import { X, Briefcase, Target, ExternalLink, TrendingUp } from "lucide-react";
import type { TeamMemberDetail } from "@/app/actions/team-overview";
import { formatCareerProgramLabel, formatCareerTrackLabel } from "@/lib/career/evaluate-career-progress";
import { careerCompletenessShortLabel, careerProgressShortLabel } from "@/lib/career/career-ui-labels";
import { buildTeamMemberCoachingSummaryBullets } from "@/lib/team-member-coaching-bullets";
import { crmUnitsFootnoteForProgram } from "@/lib/career/crm-units-copy";
import { SkeletonBlock } from "@/app/components/Skeleton";
import { MemberCareerQuickActions } from "@/app/portal/team-overview/[userId]/MemberCareerQuickActions";
import { formatTeamOverviewProduction } from "@/lib/team-overview-format";
import { PremiumProgressBar } from "@/app/portal/team-overview/premium/primitives";

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
}) {
  const shell = (classes: string) =>
    clsx(
      "xl:sticky xl:top-6 h-fit",
      variant === "premium"
        ? "rounded-[28px] border border-slate-200 bg-white text-slate-900 shadow-sm"
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
            variant === "premium"
              ? "rounded-[28px] border border-amber-200/80 bg-amber-50/50 text-slate-800"
              : "rounded-2xl border border-amber-200/80 bg-amber-50/40 text-[color:var(--wp-text-secondary)]"
          )}
          role="alert"
        >
          <p className={variant === "premium" ? "font-semibold text-slate-900" : "font-semibold text-[color:var(--wp-text)]"}>
            Detail člena se nepodařilo načíst
          </p>
          <p
            className={
              variant === "premium"
                ? "mt-1.5 text-xs leading-relaxed text-slate-600"
                : "mt-1.5 text-xs leading-relaxed text-[color:var(--wp-text-secondary)]"
            }
          >
            Zkuste obnovit data, změnit rozsah přehledu nebo otevřít plný detail.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={fullDetailHref}
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              Plný detail
              <ExternalLink className="h-3 w-3" aria-hidden />
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold text-slate-600 underline hover:text-slate-900"
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
          variant === "premium"
            ? "rounded-[28px] border border-dashed border-slate-200 bg-slate-50 text-slate-600"
            : "rounded-2xl border border-dashed border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-muted)]/20 text-[color:var(--wp-text-secondary)]"
        )}
      >
        <p className={variant === "premium" ? "font-semibold text-slate-900" : "font-semibold text-[color:var(--wp-text)]"}>
          Vyberte člena
        </p>
        <p
          className={
            variant === "premium"
              ? "mt-1.5 text-xs leading-relaxed text-slate-600"
              : "mt-1.5 text-xs leading-relaxed text-[color:var(--wp-text-secondary)]"
          }
        >
          Klikněte na řádek v seznamu, na uzel ve struktuře nebo na položku v přehledu pozornosti — zobrazí se souhrn pro 1:1.
        </p>
      </aside>
    );
  }

  const name = detail.displayName || "Člen týmu";
  const m = detail.metrics;
  const ce = detail.careerEvaluation;
  const coachingBullets = buildTeamMemberCoachingSummaryBullets(detail);

  return (
    <aside
      className={clsx(
        "xl:sticky xl:top-6 h-fit max-h-[min(90vh,calc(100vh-4rem))] overflow-y-auto",
        variant === "premium"
          ? "rounded-[28px] border border-slate-200 bg-white text-slate-900 shadow-sm"
          : "rounded-2xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] shadow-sm"
      )}
    >
      {/* Identity strip */}
      <div
        className={clsx(
          "flex items-start justify-between gap-2 border-b px-5 py-4",
          variant === "premium" ? "border-slate-200" : "border-[color:var(--wp-surface-card-border)]"
        )}
      >
        <div className="min-w-0">
          <h2 className="text-base font-black text-[color:var(--wp-text)] leading-tight">{name}</h2>
          <p className="mt-0.5 text-xs text-[color:var(--wp-text-tertiary)]">
            {detail.roleName}
            {detail.email ? ` · ${detail.email}` : ""}
          </p>
          <Link
            href={fullDetailHref}
            className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
          >
            Plný detail
            <ExternalLink className="h-3 w-3" aria-hidden />
          </Link>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 mt-0.5 rounded-lg p-1.5 text-[color:var(--wp-text-tertiary)] hover:bg-[color:var(--wp-surface-muted)] hover:text-[color:var(--wp-text)]"
          aria-label="Zavřít výběr"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-5 py-4 space-y-5">
        {outsideFilter && (
          <div className="rounded-lg border border-amber-200/70 bg-amber-50/60 px-3 py-2 text-xs text-amber-950" role="status">
            Člen není v aktuálním filtru tabulky — souhrn je platný.
          </div>
        )}

        {/* Kariérní kontext */}
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">
            <Briefcase className="h-3.5 w-3.5 text-violet-500" aria-hidden />
            Kariérní kontext
          </h3>
          <div className="rounded-xl border border-violet-200/50 bg-violet-50/35 p-3 text-xs space-y-2">
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              <p>
                <span className="text-[color:var(--wp-text-tertiary)]">Program</span>
                <br />
                <strong className="text-[color:var(--wp-text)]">{formatCareerProgramLabel(ce.careerProgramId)}</strong>
              </p>
              <p>
                <span className="text-[color:var(--wp-text-tertiary)]">Větev</span>
                <br />
                <strong className="text-[color:var(--wp-text)]">{formatCareerTrackLabel(ce.careerTrackId)}</strong>
              </p>
              {ce.careerPositionLabel && (
                <p className="col-span-2">
                  <span className="text-[color:var(--wp-text-tertiary)]">Pozice</span>
                  <br />
                  <strong className="text-[color:var(--wp-text)]">{ce.careerPositionLabel}</strong>
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-violet-200/40">
              <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold text-violet-900">
                {careerProgressShortLabel(ce.progressEvaluation)}
              </span>
              <span className="rounded-full border border-violet-200 bg-white/60 px-2 py-0.5 text-[10px] text-violet-800">
                {careerCompletenessShortLabel(ce.evaluationCompleteness)}
              </span>
            </div>
            {ce.nextCareerPositionLabel && (
              <p className="text-[color:var(--wp-text-secondary)]">
                <span className="font-semibold text-[color:var(--wp-text)]">Další krok:</span>{" "}
                {ce.nextCareerPositionLabel}
              </p>
            )}
          </div>
        </section>

        {/* CRM metriky */}
        {m ? (
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">
              <TrendingUp className="h-3.5 w-3.5 text-indigo-500" aria-hidden />
              CRM (aktuální období)
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-muted)]/25 px-3 py-2">
                <p className="text-base font-black tabular-nums text-[color:var(--wp-text)] leading-none">{m.unitsThisPeriod}</p>
                <p className="mt-0.5 text-[10px] text-[color:var(--wp-text-tertiary)]">Jednotky</p>
              </div>
              <div className="rounded-lg border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-muted)]/25 px-3 py-2">
                <p className="text-base font-black tabular-nums text-[color:var(--wp-text)] leading-none">
                  {formatTeamOverviewProduction(m.productionThisPeriod)}
                </p>
                <p className="mt-0.5 text-[10px] text-[color:var(--wp-text-tertiary)]">Produkce</p>
              </div>
              <div className="rounded-lg border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-muted)]/25 px-3 py-2">
                <p className="text-base font-black tabular-nums text-[color:var(--wp-text)] leading-none">{m.meetingsThisPeriod}</p>
                <p className="mt-0.5 text-[10px] text-[color:var(--wp-text-tertiary)]">Schůzky</p>
              </div>
              <div className="rounded-lg border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-muted)]/25 px-3 py-2">
                <p className="text-base font-black tabular-nums text-[color:var(--wp-text)] leading-none">
                  {Math.round(m.conversionRate * 100)} %
                </p>
                <p className="mt-0.5 text-[10px] text-[color:var(--wp-text-tertiary)]">Konverze</p>
              </div>
            </div>
            <p className="mt-1.5 text-[10px] text-[color:var(--wp-text-tertiary)] leading-snug">
              {crmUnitsFootnoteForProgram(ce.careerProgramId)}
            </p>
          </section>
        ) : null}

        {variant === "premium" && detail.adaptation ? (
          <section>
            <h3 className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">Adaptace</h3>
            <PremiumProgressBar
              label="Adaptační skóre (výpočet z checklistu)"
              value={detail.adaptation.adaptationScore}
              tone="emerald"
            />
            <p className="mt-2 text-[10px] text-slate-500">{detail.adaptation.adaptationStatus}</p>
          </section>
        ) : null}

        {/* Coaching a další krok */}
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">
            <Target className="h-3.5 w-3.5 text-indigo-500" aria-hidden />
            Coaching a 1:1
          </h3>
          <div className="rounded-xl border border-indigo-200/40 bg-indigo-50/25 p-3 space-y-2">
            <p className="text-xs font-semibold text-[color:var(--wp-text)]">
              {detail.careerCoaching.suggestedNextStepLine}
            </p>
            <p className="text-[11px] font-bold text-violet-800">
              {detail.careerCoaching.recommendedActionLabelCs}
            </p>
            {detail.careerCoaching.oneOnOneAgenda.length > 0 && (
              <ul className="mt-1 space-y-1 text-[11px] text-[color:var(--wp-text-secondary)]">
                {detail.careerCoaching.oneOnOneAgenda.slice(0, 4).map((item, i) => (
                  <li key={i} className="flex gap-1.5 leading-snug">
                    <span className="mt-0.5 shrink-0 text-indigo-400">·</span>
                    {item.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <MemberCareerQuickActions
            memberUserId={detail.userId}
            coaching={detail.careerCoaching}
            canCreateTeamCalendar={canCreateTeamCalendar}
            canEditTeamCareer={canEditTeamCareer}
          />
        </section>

        {/* Coaching bullets */}
        {coachingBullets.length > 0 && (
          <section>
            <h3 className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">
              Coaching summary
            </h3>
            <ul className="space-y-1 text-[11px] text-[color:var(--wp-text-secondary)]">
              {coachingBullets.map((b, i) => (
                <li key={i} className="flex gap-1.5 leading-snug">
                  <span className="mt-0.5 shrink-0 text-violet-400">·</span>
                  {b}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </aside>
  );
}
