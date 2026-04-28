"use client";

import { useState, useEffect, type ReactNode } from "react";
import Link from "next/link";
import {
  Calendar,
  CheckSquare,
  Briefcase,
  UserPlus,
  AlertCircle,
  Clock,
  ChevronRight,
  Calculator,
  FileText,
  PieChart,
  ArrowRight,
  Users,
  MessageSquare,
  Target,
  TrendingUp,
  StickyNote,
  CheckCircle2,
  LayoutDashboard,
  ListTodo,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { AiAssistantBrandIcon } from "@/app/components/AiAssistantBrandIcon";
import type { DashboardKpis } from "@/app/actions/dashboard";
import type { ServiceRecommendationWithContact } from "@/app/actions/service-engine";
import type { MeetingNoteForBoard } from "@/app/actions/meeting-notes";
import { formatMeetingNoteDomainLabel } from "@/lib/meeting-notes/domain-labels";
import { meetingNoteContentTitle as noteContentTitle } from "@/lib/meeting-notes/meeting-note-content";
import type { FinancialAnalysisListItem } from "@/app/actions/financial-analyses";
import type { ProductionSummary } from "@/app/actions/production";
import type { BusinessPlanWidgetData } from "@/app/portal/today/DashboardEditable";
import { TodayInCalendarWidget } from "@/app/components/dashboard/TodayInCalendarWidget";
import { getServiceCtaHref } from "@/lib/service-engine/cta";
import {
  MobileCard,
  MobileSection,
  MobileSectionHeader,
  MetricCard,
  StatusBadge,
  MobileLoadingState,
  ErrorState,
} from "@/app/shared/mobile-ui/primitives";
import { formatDisplayDateCs } from "@/lib/date/format-display-cs";
import type { DeviceClass } from "@/lib/ui/useDeviceClass";
import type { DashboardSummary, SuggestedAction } from "@/lib/ai/dashboard-types";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ */
/*  Quick-action pill definitions                                      */
/* ------------------------------------------------------------------ */

type QuickActionItem =
  | { icon: LucideIcon; label: string; href?: string; action?: "newTask" | "newClient" | "newOpportunity" }
  | { brandAi: true; label: string; href: string };

const QUICK_ACTIONS: QuickActionItem[] = [
  { icon: CheckSquare, label: "Nový úkol", action: "newTask" },
  { icon: UserPlus, label: "Nový klient", action: "newClient" },
  { icon: Calendar, label: "Nová schůzka", href: "/portal/calendar?new=1" },
  { icon: Briefcase, label: "Nový případ", action: "newOpportunity" },
  { icon: MessageSquare, label: "Zpráva", href: "/portal/messages" },
  { icon: LayoutDashboard, label: "Board", href: "/portal/board" },
  { icon: Calculator, label: "Kalkulačky", href: "/portal/calculators" },
  { icon: PieChart, label: "Analýza", href: "/portal/analyses/financial" },
  { brandAi: true, label: "AI Smlouvy", href: "/portal/contracts/review" },
];

/* ------------------------------------------------------------------ */
/*  Shared widget card wrapper                                         */
/* ------------------------------------------------------------------ */

function WidgetCard({
  icon: Icon,
  title,
  href,
  iconColor,
  borderColor,
  children,
}: {
  icon: LucideIcon;
  title: string;
  href?: string;
  iconColor?: string;
  borderColor?: string;
  children: ReactNode;
}) {
  return (
    <MobileCard className={cx("overflow-hidden", borderColor)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon size={16} className={iconColor ?? "text-[color:var(--wp-text-tertiary)]"} />
          <h3 className="text-xs font-black uppercase tracking-widest text-[color:var(--wp-text-secondary)]">{title}</h3>
        </div>
        {href ? (
          <Link href={href} className="text-[color:var(--wp-text-tertiary)] min-h-[44px] min-w-[44px] inline-flex items-center justify-center -mr-2">
            <ChevronRight size={16} />
          </Link>
        ) : null}
      </div>
      {children}
    </MobileCard>
  );
}

/* ------------------------------------------------------------------ */
/*  Per-widget renderers                                               */
/* ------------------------------------------------------------------ */

function suggestedActionHref(a: SuggestedAction): string {
  const p = a.payload as Record<string, string | undefined>;
  switch (a.type) {
    case "open_review":
      return `/portal/contracts/review/${encodeURIComponent(p.reviewId ?? "")}`;
    case "view_client":
      return `/portal/contacts/${encodeURIComponent(p.clientId ?? "")}`;
    case "draft_email":
      return p.clientId
        ? `/portal/messages?contact=${encodeURIComponent(p.clientId)}`
        : "/portal/messages";
    case "open_task":
    case "create_task":
      return "/portal/tasks";
    default:
      return "/portal/today";
  }
}

function useAIDashboardSummary() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let started = false;
    const run = () => {
      if (cancelled || started) return;
      started = true;
      fetch("/api/ai/dashboard-summary")
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((d) => {
          if (cancelled) return;
          if (d?.error) {
            setFetchError(typeof d.error === "string" ? d.error : "Interní náhled se nepodařilo načíst.");
            setSummary(null);
          } else {
            setFetchError(null);
            setSummary(d as DashboardSummary);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setFetchError("Interní náhled se nepodařilo načíst.");
            setSummary(null);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    const idleId =
      typeof requestIdleCallback !== "undefined"
        ? requestIdleCallback(run, { timeout: 2500 })
        : undefined;
    const t = window.setTimeout(run, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
      if (idleId !== undefined && typeof cancelIdleCallback !== "undefined") cancelIdleCallback(idleId);
    };
  }, [retryNonce]);

  const retry = () => {
    setLoading(true);
    setFetchError(null);
    setSummary(null);
    setRetryNonce((n) => n + 1);
  };

  return { summary, loading, fetchError, retry };
}

function HeroDashboardCard() {
  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-[1.35rem] border border-white/10 px-5 py-5 text-white shadow-[0_20px_50px_rgba(10,15,41,0.35)]",
        "bg-gradient-to-br from-[#060a1c] via-[#0a0f29] to-indigo-950",
      )}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-violet-500/20 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -left-8 bottom-0 h-32 w-32 rounded-full bg-indigo-400/15 blur-2xl" aria-hidden />
      <div className="relative">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-indigo-200/90">Přehled</p>
        <p className="mt-2 text-lg font-black leading-snug tracking-tight">Tady je váš prioritní přehled.</p>
        <p className="mt-2 text-xs font-medium leading-relaxed text-indigo-100/75">
          Interní souhrn úkolů, AI kontroly a nadcházející agendy — pouze pro vás, nikoli doporučení klientovi.
        </p>
      </div>
    </div>
  );
}

function QuickSignalTile({
  label,
  value,
  href,
  loading,
  valueTone = "default",
}: {
  label: string;
  value: string | number;
  href: string;
  loading?: boolean;
  valueTone?: "default" | "danger" | "warning";
}) {
  const inner = (
    <>
      <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[color:var(--wp-text-secondary)] leading-tight line-clamp-2">
        {label}
      </p>
      {loading ? (
        <div className="mt-2 h-7 w-10 animate-pulse rounded-lg bg-[color:var(--wp-surface-muted)]" />
      ) : (
        <p
          className={cx(
            "mt-1.5 text-xl font-black tabular-nums tracking-tight",
            valueTone === "danger" && "text-rose-600",
            valueTone === "warning" && "text-amber-600",
            valueTone === "default" && "text-[color:var(--wp-text)]",
          )}
        >
          {value}
        </p>
      )}
    </>
  );
  return (
    <MobileCard className="min-w-0 p-3">
      <Link href={href} className="block min-h-[44px] min-w-0 active:opacity-90">
        {inner}
      </Link>
    </MobileCard>
  );
}

function PriorityLinkRow({
  href,
  title,
  description,
  badge,
  icon: Icon,
}: {
  href: string;
  title: string;
  description?: string;
  badge: ReactNode;
  icon: LucideIcon;
}) {
  return (
    <MobileCard className="overflow-hidden p-0 shadow-[var(--aidv-mobile-shadow-card-premium,var(--aidv-shadow-card-sm))]">
      <Link href={href} className="flex min-h-[44px] items-start gap-3 px-4 py-3.5 active:bg-black/[0.025]">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 ring-1 ring-indigo-100/80">
          <Icon size={18} className="text-[#0a0f29]" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-[15px] leading-snug text-[color:var(--wp-text)]">{title}</span>
            {badge}
          </div>
          {description ? (
            <p className="mt-1 text-sm leading-snug text-[color:var(--wp-text-secondary)] line-clamp-2">{description}</p>
          ) : null}
        </div>
        <ChevronRight size={18} className="mt-1 shrink-0 text-[color:var(--wp-text-tertiary)]" aria-hidden />
      </Link>
    </MobileCard>
  );
}

function buildPriorityRows(
  kpis: DashboardKpis,
  summary: DashboardSummary | null,
  reviewHref: (id: string) => string,
) {
  type Row = {
    key: string;
    href: string;
    title: string;
    description?: string;
    badge: ReactNode;
    icon: LucideIcon;
  };
  const rows: Row[] = [];

  for (const t of kpis.overdueTasks.slice(0, 4)) {
    rows.push({
      key: `task-${t.id}`,
      href: "/portal/tasks?filter=overdue",
      title: t.title,
      description: t.contactName ? `${t.contactName} · po termínu` : "Po termínu",
      badge: <StatusBadge tone="danger">Po termínu</StatusBadge>,
      icon: ListTodo,
    });
  }

  for (const c of (summary?.contractsWaitingForReview ?? []).slice(0, 4)) {
    rows.push({
      key: `rev-${c.id}`,
      href: reviewHref(c.id),
      title: c.fileName || "Soubor ke kontrole",
      description: "Čeká na interní kontrolu",
      badge: (
        <span className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2 py-0.5">
          <AiAssistantBrandIcon size={12} className="shrink-0 opacity-90" />
          <span className="text-[10px] font-black uppercase tracking-wide text-violet-800">AI kontrola</span>
        </span>
      ),
      icon: FileText,
    });
  }

  for (const row of kpis.sidePanelAgendaTimeline.slice(0, 5)) {
    const href =
      row.kind === "event"
        ? "/portal/calendar"
        : row.kind === "task"
          ? "/portal/tasks?filter=today"
          : "/portal/tasks";
    rows.push({
      key: row.id,
      href,
      title: row.title,
      description: `${row.relativeLabel ? row.relativeLabel.charAt(0).toUpperCase() + row.relativeLabel.slice(1) : "—"} · ${row.time}${row.sub ? ` · ${row.sub}` : ""}`,
      badge: <StatusBadge tone="info">{row.kind === "event" ? "Událost" : "Úkol"}</StatusBadge>,
      icon: row.kind === "event" ? Calendar : CheckSquare,
    });
  }

  const seen = new Set<string>();
  const deduped: Row[] = [];
  for (const r of rows) {
    if (seen.has(r.key)) continue;
    seen.add(r.key);
    deduped.push(r);
    if (deduped.length >= 10) break;
  }

  const pragueHoliday = kpis.czPublicHolidayToday;
  if (deduped.length === 0 && pragueHoliday) {
    deduped.push({
      key: "holiday",
      href: "/portal/calendar",
      title: pragueHoliday,
      description: "Státní svátek — zkontrolujte plán.",
      badge: <StatusBadge tone="neutral">Svátek</StatusBadge>,
      icon: Sparkles,
    });
  }

  return deduped;
}

function KpiClientsStrip({
  serviceRecommendations,
  kpis,
}: {
  serviceRecommendations: ServiceRecommendationWithContact[];
  kpis: DashboardKpis;
}) {
  const chips: { key: string; label: string; href: string }[] = [];
  for (const r of serviceRecommendations.slice(0, 6)) {
    const name = [r.contactFirstName, r.contactLastName].filter(Boolean).join(" ").trim() || "Klient";
    const cta = getServiceCtaHref(r, r.contactId);
    chips.push({ key: `rec-${r.id}`, label: name, href: cta.href });
  }
  if (chips.length === 0) {
    for (const c of kpis.serviceDueContacts.slice(0, 6)) {
      chips.push({
        key: `svc-${c.id}`,
        label: `${c.firstName} ${c.lastName}`.trim(),
        href: `/portal/contacts/${c.id}`,
      });
    }
  }
  if (chips.length === 0) {
    return (
      <p className="text-[11px] font-medium leading-relaxed text-[color:var(--wp-text-secondary)]">
        Žádná aktivní péče ani servisní termín v tomto výřezu.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c) => (
        <Link
          key={c.key}
          href={c.href}
          className="max-w-full truncate rounded-full border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] px-3 py-1.5 text-[11px] font-bold text-[color:var(--wp-text-secondary)] shadow-sm active:scale-[0.99]"
        >
          {c.label}
        </Link>
      ))}
    </div>
  );
}

function AiInsightsPanel({
  summary,
  loading,
  fetchError,
  onRetry,
}: {
  summary: DashboardSummary | null;
  loading: boolean;
  fetchError: string | null;
  onRetry: () => void;
}) {
  const suggested = (summary?.suggestedActions ?? []).slice(0, 4);
  const prose = summary?.assistantSummaryText?.trim();

  if (loading) {
    return (
      <MobileCard className="border-indigo-100/80">
        <MobileLoadingState rows={3} variant="row" label="Načítám interní AI náhled" />
      </MobileCard>
    );
  }

  if (fetchError) {
    return (
      <ErrorState
        title="Interní AI náhled"
        description={fetchError}
        onRetry={onRetry}
        homeHref={false}
      />
    );
  }

  if (!summary) {
    return (
      <MobileCard>
        <p className="text-sm text-[color:var(--wp-text-secondary)]">Interní náhled není k dispozici.</p>
      </MobileCard>
    );
  }

  const hasBody = suggested.length > 0 || Boolean(prose);
  if (!hasBody) {
    return (
      <MobileCard className="border-indigo-50 bg-gradient-to-br from-white to-indigo-50/30">
        <div className="flex items-center gap-2">
          <AiAssistantBrandIcon size={22} className="shrink-0" />
          <p className="text-sm font-medium text-[color:var(--wp-text-secondary)]">
            Pro tento den nejsou další interní podněty z AI náhledu.
          </p>
        </div>
        <Link
          href="/portal/contracts/review"
          className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-bold text-white"
        >
          <AiAssistantBrandIcon size={16} /> AI Smlouvy <ArrowRight size={14} />
        </Link>
      </MobileCard>
    );
  }

  return (
    <MobileCard className="border-indigo-100/80 bg-gradient-to-br from-white to-violet-50/25">
      <div className="flex items-center gap-2 mb-3">
        <AiAssistantBrandIcon size={22} className="shrink-0" />
        <h3 className="text-sm font-black tracking-tight text-[#0a0f29]">Interní AI náhled</h3>
      </div>
      {suggested.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[color:var(--wp-text-tertiary)]">
            Podněty k prověření
          </p>
          <div className="space-y-1.5">
            {suggested.map((a, i) => (
              <Link
                key={`${a.type}-${i}`}
                href={suggestedActionHref(a)}
                className="flex min-h-[44px] items-center justify-between gap-2 rounded-xl border border-violet-100 bg-violet-50/40 px-3 py-2.5 text-sm font-semibold text-[color:var(--wp-text)] active:scale-[0.99]"
              >
                <span className="min-w-0 flex-1 truncate">{a.label}</span>
                <ArrowRight size={14} className="shrink-0 text-violet-500" />
              </Link>
            ))}
          </div>
        </div>
      ) : null}
      {prose ? (
        <details className="mt-3 rounded-xl border border-indigo-100 bg-white/80 px-3 py-2">
          <summary className="cursor-pointer list-none text-xs font-bold text-indigo-800">
            Textový souhrn (interní)
          </summary>
          <p className="mt-2 text-xs leading-relaxed text-[color:var(--wp-text-secondary)]">{prose}</p>
        </details>
      ) : null}
      <Link
        href="/portal/contracts/review"
        className="mt-4 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-bold text-white"
      >
        <AiAssistantBrandIcon size={16} /> Otevřít AI Smlouvy <ArrowRight size={14} />
      </Link>
    </MobileCard>
  );
}

function TasksWidget({ kpis }: { kpis: DashboardKpis }) {
  const all = [...kpis.overdueTasks, ...(kpis.tasksDueToday ?? [])].slice(0, 5);
  const todayStr = new Date().toISOString().slice(0, 10);
  const isOverdue = (d: string) => d < todayStr;
  const timeLabel = (due: string) => {
    if (due < todayStr) return "Po termínu";
    if (due === todayStr) return "Dnes";
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (due === tomorrow.toISOString().slice(0, 10)) return "Zítra";
    return formatDisplayDateCs(due) || due;
  };

  if (all.length === 0) {
    return (
      <div className="flex flex-col items-center text-center py-4">
        <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 mb-2 border border-emerald-100">
          <CheckCircle2 size={24} />
        </div>
        <p className="font-bold text-emerald-600 text-sm">Vše splněno!</p>
        <p className="text-xs text-[color:var(--wp-text-secondary)] mt-1">Máte čistý stůl.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {all.map((t) => (
        <Link
          key={t.id}
          href={`/portal/tasks${isOverdue(t.dueDate) ? "?filter=overdue" : "?filter=today"}`}
          className="flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-[color:var(--wp-surface-muted)] transition-colors group"
        >
          <span className="mt-0.5 w-4 h-4 rounded border-2 border-amber-300 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-[color:var(--wp-text)] truncate group-hover:text-indigo-600 transition-colors">
              {t.title}
            </p>
            <span
              className={cx(
                "text-[10px] font-black uppercase tracking-widest flex items-center gap-1",
                isOverdue(t.dueDate) ? "text-rose-500" : "text-amber-500"
              )}
            >
              <Clock size={10} /> {timeLabel(t.dueDate)}
              {t.contactName && (
                <span className="normal-case font-semibold text-[color:var(--wp-text-secondary)]"> · {t.contactName}</span>
              )}
            </span>
          </div>
        </Link>
      ))}
      <Link
        href="/portal/tasks"
        className="text-xs font-bold text-indigo-600 hover:underline inline-flex items-center gap-1 pt-1"
      >
        Všechny úkoly <ChevronRight size={12} />
      </Link>
    </div>
  );
}

function ActiveDealsWidget({ kpis }: { kpis: DashboardKpis }) {
  const atRisk = kpis.pipelineAtRisk.slice(0, 3);
  const step34 = (kpis.opportunitiesInStep3And4 ?? []).slice(0, 3);

  if (atRisk.length === 0 && step34.length === 0) {
    return (
      <div className="flex flex-col items-center text-center py-4">
        <div className="w-12 h-12 bg-[color:var(--wp-surface-muted)] rounded-xl flex items-center justify-center text-[color:var(--wp-text-tertiary)] mb-2 border border-[color:var(--wp-surface-card-border)]">
          <Clock size={24} />
        </div>
        <p className="text-sm font-medium text-[color:var(--wp-text-secondary)]">Žádné aktivní obchody.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {atRisk.map((o) => (
        <Link
          key={o.id}
          href={`/portal/pipeline/${o.id}`}
          className="block p-2.5 rounded-xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-muted)]/50 hover:bg-[color:var(--wp-surface-card)] transition-colors"
        >
          <span className="text-[10px] font-black uppercase tracking-widest text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
            Ohrožení
          </span>
          <h4 className="font-bold text-sm text-[color:var(--wp-text)] mt-1.5">{o.title}</h4>
          <p className="text-xs text-[color:var(--wp-text-secondary)] mt-0.5 flex items-center gap-1">
            <Users size={11} /> {o.contactName ?? "—"}
          </p>
        </Link>
      ))}
      {step34.map((o) => (
        <Link
          key={o.id}
          href={`/portal/pipeline/${o.id}`}
          className="block p-2.5 rounded-xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-muted)]/50 hover:bg-[color:var(--wp-surface-card)] transition-colors"
        >
          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
            {o.stageName}
          </span>
          <h4 className="font-bold text-sm text-[color:var(--wp-text)] mt-1.5">{o.title}</h4>
          <p className="text-xs text-[color:var(--wp-text-secondary)] mt-0.5 flex items-center gap-1">
            <Users size={11} /> {o.contactName ?? "—"}
          </p>
        </Link>
      ))}
      <Link
        href="/portal/pipeline"
        className="text-xs font-bold text-indigo-600 hover:underline inline-flex items-center gap-1 pt-1"
      >
        Obchody <ChevronRight size={12} />
      </Link>
    </div>
  );
}

function ProductionWidget({
  productionSummary,
  productionError,
}: {
  productionSummary: ProductionSummary | null;
  productionError: string | null;
}) {
  if (productionError) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-rose-600 mb-2">{productionError}</p>
        <Link href="/portal/production" className="text-xs font-bold text-indigo-600 hover:underline">
          Otevřít produkci →
        </Link>
      </div>
    );
  }
  if (!productionSummary) {
    return (
      <div className="animate-pulse space-y-3 py-2 min-h-[80px] flex flex-col justify-center">
        <div className="h-3 bg-[color:var(--wp-surface-card-border)] rounded w-2/3 mx-auto" />
        <div className="h-8 bg-[color:var(--wp-surface-card-border)] rounded-lg w-3/4 mx-auto" />
        <div className="h-3 bg-[color:var(--wp-surface-muted)] rounded w-1/2 mx-auto" />
      </div>
    );
  }
  if (productionSummary.totalCount === 0) {
    return (
      <div className="flex flex-col items-center text-center py-4">
        <div className="w-12 h-12 bg-[color:var(--wp-surface-muted)] rounded-xl flex items-center justify-center text-[color:var(--wp-text-tertiary)] mb-2 border border-[color:var(--wp-surface-card-border)]">
          <PieChart size={24} />
        </div>
        <p className="text-sm font-medium text-[color:var(--wp-text-secondary)]">Žádná produkce za tento měsíc.</p>
      </div>
    );
  }
  return (
    <div className="text-center py-2">
      <span className="text-[10px] font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)] block mb-1">
        Produkce {productionSummary.periodLabel}
      </span>
      <div className="text-2xl font-black text-[color:var(--wp-text)]">
        {productionSummary.totalPremium.toLocaleString("cs-CZ")} Kč
      </div>
      <div className="text-xs font-bold text-[color:var(--wp-text-secondary)] mt-1">
        Roční: {productionSummary.totalAnnual.toLocaleString("cs-CZ")} Kč · {productionSummary.totalCount} smluv
      </div>
      <Link
        href="/portal/production"
        className="text-xs font-bold text-indigo-600 hover:underline mt-3 inline-flex items-center gap-1"
      >
        Detail <ChevronRight size={12} />
      </Link>
    </div>
  );
}

function BusinessPlanWidget({ data }: { data: BusinessPlanWidgetData | null }) {
  const HEALTH_LABELS: Record<string, string> = {
    achieved: "Splněno",
    exceeded: "Překročeno",
    on_track: "Podle plánu",
    slight_slip: "Mírný skluz",
    significant_slip: "Výrazný skluz",
    no_data: "—",
    not_applicable: "—",
  };
  const formatVal = (v: number, unit: string) =>
    unit === "czk" ? `${Math.round(v).toLocaleString("cs-CZ")} Kč` : String(Math.round(v));

  if (!data) {
    return (
      <div className="py-4">
        <p className="text-sm text-[color:var(--wp-text-secondary)] mb-2">Zatím nemáte nastavený business plán.</p>
        <Link
          href="/portal/business-plan"
          className="text-sm font-semibold text-indigo-600 hover:underline min-h-[44px] inline-flex items-center"
        >
          Nastavit plán →
        </Link>
      </div>
    );
  }

  return (
    <div className="py-1">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">
          {data.periodLabel}
        </span>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[color:var(--wp-surface-muted)] text-[color:var(--wp-text-secondary)]">
          {HEALTH_LABELS[data.overallHealth] ?? data.overallHealth}
        </span>
      </div>
      <div className="space-y-2">
        {data.metrics.map((m) => (
          <div key={m.metricType} className="flex justify-between items-center text-sm">
            <span className="font-medium text-[color:var(--wp-text-secondary)] truncate">{m.label}</span>
            <span className="text-[color:var(--wp-text-secondary)] shrink-0 ml-2 text-xs">
              {formatVal(m.actual, m.unit)} / {formatVal(m.target, m.unit)}
            </span>
          </div>
        ))}
      </div>
      <Link
        href="/portal/business-plan"
        className="text-xs font-bold text-indigo-600 hover:underline mt-3 inline-flex items-center gap-1"
      >
        Otevřít plán <ChevronRight size={12} />
      </Link>
    </div>
  );
}

function ClientCareWidget({
  serviceRecommendations,
  kpis,
}: {
  serviceRecommendations: ServiceRecommendationWithContact[];
  kpis: DashboardKpis;
}) {
  const recs = serviceRecommendations.slice(0, 4);
  const service = kpis.serviceDueContacts.slice(0, 3);
  const ann = kpis.upcomingAnniversaries.slice(0, 3);
  const hasRecs = recs.length > 0;
  const hasLegacy = service.length > 0 || ann.length > 0;

  if (!hasRecs && !hasLegacy) {
    return <p className="text-sm py-3 text-[color:var(--wp-text-secondary)]">Žádná péče k zobrazení.</p>;
  }

  if (hasRecs) {
    return (
      <div className="space-y-2">
        {recs.map((r) => {
          const cta = getServiceCtaHref(r, r.contactId);
          const name =
            [r.contactFirstName, r.contactLastName].filter(Boolean).join(" ") || "Klient";
          const isRecOverdue = r.urgency === "overdue";
          return (
            <div
              key={r.id}
              className={cx(
                "flex items-center justify-between gap-2 p-2.5 rounded-xl border min-h-[44px]",
                isRecOverdue ? "bg-red-50/50 border-red-100/50" : "bg-amber-50/30 border-amber-100/50"
              )}
            >
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-sm text-[color:var(--wp-text)]">{name}</h4>
                <p className="text-xs font-bold text-[color:var(--wp-text-secondary)] truncate">{r.title}</p>
              </div>
              <Link
                href={cta.href}
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-2.5 rounded-lg bg-[color:var(--wp-surface-card)] text-[color:var(--wp-text-secondary)] border border-[color:var(--wp-surface-card-border)] text-xs font-semibold shrink-0"
              >
                {cta.label}
              </Link>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {service.map((c) => (
        <div
          key={c.id}
          className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50/30 border border-amber-100/50 min-h-[44px]"
        >
          <div>
            <h4 className="font-bold text-sm text-[color:var(--wp-text)]">
              {c.firstName} {c.lastName}
            </h4>
            <p className="text-xs font-bold text-amber-600 flex items-center gap-1">
              <AlertCircle size={11} /> Servis ·{" "}
              {new Date(c.nextServiceDue).toLocaleDateString("cs-CZ")}
            </p>
          </div>
          <Link
            href={`/portal/contacts/${c.id}`}
            className="p-2 bg-[color:var(--wp-surface-card)] rounded-lg border border-[color:var(--wp-surface-card-border)] min-h-[44px] min-w-[44px] inline-flex items-center justify-center shrink-0"
          >
            <ChevronRight size={14} />
          </Link>
        </div>
      ))}
      {ann.map((c) => (
        <div
          key={c.id}
          className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50/30 border border-amber-100/50 min-h-[44px]"
        >
          <div>
            <h4 className="font-bold text-sm text-[color:var(--wp-text)]">{c.partnerName ?? "—"}</h4>
            <p className="text-xs font-bold text-amber-600 flex items-center gap-1">
              <AlertCircle size={11} /> Výročí ·{" "}
              {formatDisplayDateCs(c.anniversaryDate) || c.anniversaryDate}
            </p>
          </div>
          <Link
            href={`/portal/contacts/${c.contactId}`}
            className="p-2 bg-[color:var(--wp-surface-card)] rounded-lg border border-[color:var(--wp-surface-card-border)] min-h-[44px] min-w-[44px] inline-flex items-center justify-center shrink-0"
          >
            <ChevronRight size={14} />
          </Link>
        </div>
      ))}
    </div>
  );
}

function FinancialAnalysesWidget({ analyses }: { analyses: FinancialAnalysisListItem[] }) {
  const formatAgo = (d: Date | string) => {
    const t = new Date(d).getTime();
    const diff = Math.floor((Date.now() - t) / 86400000);
    if (diff === 0) return "Dnes";
    if (diff === 1) return "Včera";
    if (diff < 7) return `Před ${diff} dny`;
    return new Date(d).toLocaleDateString("cs-CZ", { day: "numeric", month: "short" });
  };

  if (analyses.length === 0) {
    return <p className="text-sm py-3 text-[color:var(--wp-text-secondary)]">Žádné finanční analýzy.</p>;
  }

  return (
    <div className="space-y-2">
      {analyses.slice(0, 3).map((a) => (
        <Link
          key={a.id}
          href={`/portal/analyses/financial?id=${encodeURIComponent(a.id)}`}
          className="block p-3 rounded-xl border border-[color:var(--wp-surface-card-border)] hover:border-indigo-200 transition-all bg-[color:var(--wp-surface-card)] group"
        >
          <div className="flex justify-between items-start mb-1.5">
            <span className="p-1 bg-blue-50 text-blue-600 rounded-lg">
              <FileText size={14} />
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">
              {formatAgo(a.updatedAt)}
            </span>
          </div>
          <h4 className="font-bold text-sm text-[color:var(--wp-text)] group-hover:text-indigo-600 transition-colors">
            {a.analysisTypeLabel ?? "Analýza"}
          </h4>
          <p className="text-xs text-[color:var(--wp-text-secondary)] mt-0.5">{a.clientName ?? "—"}</p>
          <div className="mt-2 pt-2 border-t border-[color:var(--wp-surface-card-border)] flex justify-between items-center">
            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
              {a.status === "completed"
                ? "Dokončeno"
                : a.status === "draft"
                  ? "Rozpracováno"
                  : a.status}
            </span>
            <ChevronRight
              size={12}
              className="text-[color:var(--wp-text-tertiary)] group-hover:text-indigo-600 transition-colors"
            />
          </div>
        </Link>
      ))}
      <Link
        href="/portal/analyses"
        className="text-xs font-bold text-indigo-600 hover:underline inline-flex items-center gap-1 pt-1"
      >
        Všechny analýzy <ChevronRight size={12} />
      </Link>
    </div>
  );
}

function MessagesWidget() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import("@/app/actions/messages")
      .then((mod) => mod.getUnreadConversationsCount())
      .then((c) => setUnreadCount(c))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-3 min-h-[52px] py-1">
        <div className="w-10 h-10 rounded-xl bg-[color:var(--wp-surface-muted)] animate-pulse shrink-0" />
        <div className="flex-1 space-y-2 min-w-0">
          <div className="h-6 bg-[color:var(--wp-surface-muted)] rounded-lg w-16 animate-pulse" />
          <div className="h-3 bg-[color:var(--wp-surface-muted)] rounded w-32 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="py-1 min-h-[52px]">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500 border border-emerald-100">
          <MessageSquare size={20} />
        </div>
        <div>
          <p className="text-2xl font-black text-[color:var(--wp-text)] tabular-nums">{unreadCount}</p>
          <p className="text-xs text-[color:var(--wp-text-secondary)] font-bold">nepřečtených zpráv</p>
        </div>
      </div>
    </div>
  );
}

function NotesWidget({ notes }: { notes: MeetingNoteForBoard[] }) {
  if (notes.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-[color:var(--wp-text-secondary)]">Žádné zápisky z posledních schůzek.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {notes.slice(0, 4).map((n) => {
        const title = noteContentTitle(n.content);
        const domainLabel = formatMeetingNoteDomainLabel(n.domain);
        const contact =
          n.contactName && n.contactName !== "Obecný zápisek" ? n.contactName : null;
        const meta = contact
          ? `${domainLabel} · ${new Date(n.meetingAt).toLocaleDateString("cs-CZ")} · ${contact}`
          : `${domainLabel} · ${new Date(n.meetingAt).toLocaleDateString("cs-CZ")}`;
        return (
          <div
            key={n.id}
            className="p-2.5 rounded-xl border border-amber-100 bg-amber-50/30"
          >
            <div className="flex justify-between items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[color:var(--wp-text)] truncate">
                  {title}
                </p>
                <p className="text-xs text-[color:var(--wp-text-secondary)] mt-0.5 line-clamp-2">
                  {meta}
                </p>
              </div>
              <StickyNote size={14} className="text-amber-400 shrink-0 mt-0.5" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main DashboardScreen                                               */
/* ------------------------------------------------------------------ */

export interface DashboardScreenProps {
  kpis: DashboardKpis;
  advisorName: string;
  serviceRecommendations: ServiceRecommendationWithContact[];
  initialNotes: MeetingNoteForBoard[];
  initialAnalyses: FinancialAnalysisListItem[];
  productionSummary: ProductionSummary | null;
  productionError: string | null;
  businessPlanWidgetData: BusinessPlanWidgetData | null;
  deviceClass: DeviceClass;
  onNewTask: () => void;
  onNewClient: () => void;
  onNewOpportunity: () => void;
}

export function DashboardScreen({
  kpis,
  advisorName,
  serviceRecommendations,
  initialNotes,
  initialAnalyses,
  productionSummary,
  productionError,
  businessPlanWidgetData,
  deviceClass,
  onNewTask,
  onNewClient,
  onNewOpportunity,
}: DashboardScreenProps) {
  const ai = useAIDashboardSummary();
  const dateLabel = new Date().toLocaleDateString("cs-CZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const isTablet = deviceClass === "tablet";
  const todayAgendaCount = kpis.todayEvents.length + kpis.tasksDueToday.length;
  const todayAgendaLabel =
    todayAgendaCount === 0
      ? ""
      : todayAgendaCount === 1
        ? "1 položka"
        : todayAgendaCount >= 2 && todayAgendaCount <= 4
          ? `${todayAgendaCount} položky`
          : `${todayAgendaCount} položek`;
  const actionCallbacks: Record<string, () => void> = {
    newTask: onNewTask,
    newClient: onNewClient,
    newOpportunity: onNewOpportunity,
  };

  const reviewHref = (id: string) => `/portal/contracts/review/${encodeURIComponent(id)}`;
  const priorityRows = buildPriorityRows(kpis, ai.summary, reviewHref);

  const formatPremiumShort = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")} mil.`;
    if (n >= 1000) return `${Math.round(n / 1000)} tis.`;
    return `${n}`;
  };

  return (
    <div className="w-full min-w-0 overflow-x-hidden space-y-5">
      {/* Datum + greeting — premium hierarchie */}
      <div className="space-y-1">
        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[color:var(--wp-text-secondary)] first-letter:uppercase">
          {dateLabel}
        </p>
        <h1 className="text-[1.65rem] font-black leading-[1.15] tracking-tight text-[#0a0f29]">
          Dobrý den, {advisorName.split(" ")[0]}
        </h1>
      </div>

      <HeroDashboardCard />

      {/* Rychlé signály — bez horizontálního scrollu */}
      <div className="grid grid-cols-3 gap-2 min-w-0">
        <QuickSignalTile
          label="AI kontrola čeká"
          value={
            ai.loading ? 0 : ai.fetchError ? "—" : (ai.summary?.contractsWaitingForReview?.length ?? 0)
          }
          href="/portal/contracts/review"
          loading={ai.loading}
          valueTone={
            !ai.loading && !ai.fetchError && (ai.summary?.contractsWaitingForReview?.length ?? 0) > 0
              ? "warning"
              : "default"
          }
        />
        <QuickSignalTile
          label="Po termínu"
          value={kpis.overdueTasks.length}
          href="/portal/tasks?filter=overdue"
          valueTone={kpis.overdueTasks.length > 0 ? "danger" : "default"}
        />
        <QuickSignalTile
          label="Dnes v agendě"
          value={todayAgendaCount}
          href="/portal/calendar"
        />
      </div>

      {/* KPI dlaždice — Produkce / Úkoly / AI Review */}
      <MobileSectionHeader
        title="Klíčové metriky"
        subtitle="Z produkčních dat CRM — interní přehled pro poradce."
      />
      <div className="grid grid-cols-3 gap-2 min-w-0">
        {productionError ? (
          <MobileCard className="min-w-0 p-3 border-rose-200/90 bg-rose-50/40">
            <p className="text-[9px] font-black uppercase tracking-wide text-rose-800">Produkce</p>
            <p className="mt-2 text-[11px] font-semibold leading-snug text-rose-700 line-clamp-3">Nepodařilo se načíst produkci.</p>
            <Link href="/portal/production" className="mt-2 inline-flex text-[11px] font-black text-indigo-700">
              Otevřít →
            </Link>
          </MobileCard>
        ) : !productionSummary ? (
          <MobileCard className="min-w-0 p-3">
            <p className="text-[9px] font-black uppercase text-[color:var(--wp-text-secondary)]">Produkce</p>
            <div className="mt-3">
              <MobileLoadingState rows={2} variant="row" />
            </div>
          </MobileCard>
        ) : productionSummary.totalCount === 0 ? (
          <Link href="/portal/production" className="block min-w-0">
            <MetricCard label="Produkce" value="—" tone="default" />
          </Link>
        ) : (
          <Link href="/portal/production" className="block min-w-0 [&_.text-xl]:text-lg [&_.text-xl]:truncate">
            <MetricCard
              label="Produkce"
              value={`${formatPremiumShort(productionSummary.totalPremium)} Kč`}
              tone="default"
            />
          </Link>
        )}
        <Link href="/portal/tasks" className="block min-w-0 [&_.text-xl]:text-lg">
          <MetricCard
            label="Úkoly"
            value={kpis.tasksOpen}
            tone={kpis.overdueTasks.length > 0 ? "warning" : "default"}
          />
        </Link>
        <Link href="/portal/contracts/review" className="block min-w-0 [&_.text-xl]:text-lg">
          {ai.loading ? (
            <MobileCard className="p-3">
              <p className="text-[9px] font-black uppercase text-[color:var(--wp-text-secondary)]">AI Review</p>
              <div className="mt-3">
                <MobileLoadingState rows={1} variant="row" />
              </div>
            </MobileCard>
          ) : ai.fetchError ? (
            <MobileCard className="p-3 border-amber-100 bg-amber-50/40">
              <p className="text-[9px] font-black uppercase text-amber-900">AI Review</p>
              <p className="mt-2 text-[11px] font-medium text-amber-900/90">Nepodařilo se načíst stav.</p>
              <span className="mt-2 block text-xl font-black text-[color:var(--wp-text)]">—</span>
            </MobileCard>
          ) : (
            <MetricCard
              label="AI Review"
              value={ai.summary?.contractsWaitingForReview?.length ?? 0}
              tone={(ai.summary?.contractsWaitingForReview?.length ?? 0) > 0 ? "warning" : "default"}
            />
          )}
        </Link>
      </div>

      {/* Klienti / péče — strip */}
      <MobileSection title="Klienti v záběru">
        <MobileCard className="pt-4">
          <KpiClientsStrip serviceRecommendations={serviceRecommendations} kpis={kpis} />
        </MobileCard>
      </MobileSection>

      {/* Priority list */}
      <MobileSectionHeader
        title="Priority"
        subtitle="Interní práce podle CRM — ověřte detaily před sdělením klientovi."
        action={
          <Link href="/portal/tasks" className="text-[11px] font-black uppercase tracking-wide text-indigo-600">
            Úkoly →
          </Link>
        }
      />
      {priorityRows.length === 0 ? (
        <MobileCard className="text-center py-10">
          <p className="text-sm font-medium text-[color:var(--wp-text-secondary)]">
            Žádné položky v prioritní frontě podle výřezu právě teď — obnovte úkoly nebo kalendář.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link
              href="/portal/tasks"
              className="inline-flex min-h-[44px] items-center rounded-xl bg-indigo-600 px-5 text-xs font-black uppercase tracking-wide text-white"
            >
              Úkoly
            </Link>
            <Link
              href="/portal/calendar"
              className="inline-flex min-h-[44px] items-center rounded-xl border border-[color:var(--wp-surface-card-border)] px-5 text-xs font-bold text-[color:var(--wp-text-secondary)]"
            >
              Kalendář
            </Link>
          </div>
        </MobileCard>
      ) : (
        <div className="space-y-2">
          {priorityRows.map((row) => (
            <PriorityLinkRow
              key={row.key}
              href={row.href}
              title={row.title}
              description={row.description}
              badge={row.badge}
              icon={row.icon}
            />
          ))}
        </div>
      )}

      <AiInsightsPanel summary={ai.summary} loading={ai.loading} fetchError={ai.fetchError} onRetry={ai.retry} />

      {/* Quick Actions — pouze wrap, žádný horizontální scroll */}
      <MobileSection title="Rychlé akce">
        <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((qa, i) => {
          const cls =
            "flex items-center gap-1.5 px-3 py-2 bg-[color:var(--wp-surface-card)] border border-[color:var(--wp-surface-card-border)] rounded-xl text-xs font-bold text-[color:var(--wp-text-secondary)] min-h-[40px] active:scale-95 transition-transform max-w-[100%]";
          const iconEl =
            "brandAi" in qa && qa.brandAi ? (
              <AiAssistantBrandIcon size={14} className="opacity-70 shrink-0" />
            ) : (
              (() => {
                const QIcon = (qa as Extract<QuickActionItem, { icon: LucideIcon }>).icon;
                return <QIcon size={14} className="opacity-70" />;
              })()
            );
          if (qa.href) {
            return (
              <Link key={i} href={qa.href} className={cls}>
                {iconEl}
                {qa.label}
              </Link>
            );
          }
          return (
            <button
              key={i}
              type="button"
              onClick={() => "action" in qa && qa.action && actionCallbacks[qa.action]?.()}
              className={cls}
            >
              {iconEl}
              {qa.label}
            </button>
          );
        })}
        </div>
      </MobileSection>

      <TodayInCalendarWidget
        czPublicHolidayToday={kpis.czPublicHolidayToday}
        czNameDaysToday={kpis.czNameDaysToday}
        birthdaysToday={kpis.birthdaysToday}
        pragueTodayYmd={kpis.pragueTodayYmd}
      />

      <MobileSection title="Agenda dnes">
        <MobileCard className="border-indigo-100/80 bg-gradient-to-br from-white to-indigo-50/40">
          <p className="text-sm font-bold text-[color:var(--wp-text)]">
            {todayAgendaCount === 0 ? "Dnes nic naplánováno" : `${todayAgendaLabel} — schůzky a úkoly`}
          </p>
          <p className="mt-1 text-xs text-[color:var(--wp-text-secondary)]">Otevřete kalendář nebo dnešní úkoly.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/portal/calendar"
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-black uppercase tracking-wide text-white active:scale-[0.99] sm:flex-none"
            >
              <Calendar size={16} aria-hidden />
              Kalendář
            </Link>
            <Link
              href="/portal/tasks?filter=today"
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] px-4 text-xs font-bold text-[color:var(--wp-text-secondary)] active:scale-[0.99] sm:flex-none"
            >
              <CheckSquare size={16} aria-hidden />
              Úkoly dnes
            </Link>
          </div>
        </MobileCard>
      </MobileSection>

      {/* Widget Grid — min-heights reduce layout shift as async widgets resolve */}
      <div className={cx("grid gap-3", isTablet ? "grid-cols-2" : "grid-cols-1")}>
        <div className="min-h-[120px]">
          <WidgetCard
            icon={CheckSquare}
            title="Moje úkoly"
            href="/portal/tasks"
            iconColor="text-amber-500"
            borderColor="border-t-4 border-t-emerald-500"
          >
            <TasksWidget kpis={kpis} />
          </WidgetCard>
        </div>

        <div className="min-h-[120px]">
          <WidgetCard
            icon={Briefcase}
            title="Aktivní obchody"
            href="/portal/pipeline"
            iconColor="text-purple-500"
            borderColor="border-t-4 border-t-blue-500"
          >
            <ActiveDealsWidget kpis={kpis} />
          </WidgetCard>
        </div>

        <div className="min-h-[120px]">
          <WidgetCard
            icon={TrendingUp}
            title="Produkce"
            href="/portal/production"
            iconColor="text-indigo-400"
            borderColor="border-t-4 border-t-blue-500"
          >
            <ProductionWidget
              productionSummary={productionSummary}
              productionError={productionError}
            />
          </WidgetCard>
        </div>

        <div className="min-h-[120px]">
          <WidgetCard
            icon={Target}
            title="Plnění plánu"
            href="/portal/business-plan"
            iconColor="text-blue-500"
            borderColor="border-t-4 border-t-blue-500"
          >
            <BusinessPlanWidget data={businessPlanWidgetData} />
          </WidgetCard>
        </div>

        <div className="min-h-[120px]">
          <WidgetCard
            icon={AlertCircle}
            title="Péče o klienty"
            href="/portal/contacts"
            iconColor="text-violet-500"
            borderColor="border-t-4 border-t-violet-500"
          >
            <ClientCareWidget
              serviceRecommendations={serviceRecommendations}
              kpis={kpis}
            />
          </WidgetCard>
        </div>

        <div className="min-h-[120px]">
          <WidgetCard
            icon={FileText}
            title="Finanční analýzy"
            href="/portal/analyses"
            iconColor="text-blue-600"
            borderColor="border-t-4 border-t-[color:var(--wp-text-tertiary)]"
          >
            <FinancialAnalysesWidget analyses={initialAnalyses} />
          </WidgetCard>
        </div>

        <div className="min-h-[60px]">
          <WidgetCard
            icon={MessageSquare}
            title="Zprávy"
            href="/portal/messages"
            iconColor="text-emerald-500"
            borderColor="border-t-4 border-t-emerald-500"
          >
            <MessagesWidget />
          </WidgetCard>
        </div>

        {/* Notes -- spans full width on tablet */}
        <div className={cx("min-h-[120px]", isTablet ? "col-span-2" : "")}>
          <WidgetCard
            icon={StickyNote}
            title="Zápisky"
            href="/portal/notes"
            iconColor="text-amber-500"
            borderColor="border-t-4 border-t-[color:var(--wp-text-tertiary)]"
          >
            <NotesWidget notes={initialNotes} />
          </WidgetCard>
        </div>
      </div>
    </div>
  );
}
