"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import type {
  TeamOverviewKpis,
  TeamMemberInfo,
  NewcomerAdaptation,
  TeamPerformancePoint,
  TeamOverviewPeriod,
  TeamRhythmCalendarData,
  TeamMemberDetail,
} from "@/app/actions/team-overview";
import type { TeamMemberMetrics, TeamAlert } from "@/lib/team-overview-alerts";
import type { TeamOverviewScope, TeamTreeNode } from "@/lib/team-hierarchy-types";
import {
  getTeamOverviewPageSnapshot,
  getTeamMemberDetail,
} from "@/app/actions/team-overview";
import { generateTeamSummaryAction, getLatestTeamSummaryAction, submitAiFeedbackAction } from "@/app/actions/ai-generations";
import { createTeamActionFromAi } from "@/app/actions/ai-actions";
import type { AiFeedbackVerdict, AiFeedbackActionTaken } from "@/app/actions/ai-feedback";
import type { AiActionType } from "@/lib/ai/actions/action-suggestions";
import { TeamCalendarModal, TeamCalendarButtons, type TeamCalendarModalPrefill } from "./TeamCalendarModal";
import { TeamRhythmPanel } from "./TeamRhythmPanel";
import { TeamStructurePanel } from "./TeamStructurePanel";
import { TeamOverviewSelectedMemberPanel } from "./TeamOverviewSelectedMemberPanel";
import { buildTeamOverviewPageModel, type PeopleSegmentFilter } from "@/lib/team-overview-page-model";
import { deriveTeamOverviewPriorities } from "@/lib/team-overview-priorities";
import type { CareerTrackId } from "@/lib/career/types";
import {
  sortTeamMembersForOverview,
  getVisibleTeamMembers,
  isSelectedMemberInScope,
  isSelectedInFilteredList,
} from "@/lib/team-overview-members";
import { TeamOverviewAttentionSection } from "./components/TeamOverviewAttentionSection";
import { TeamOverviewCareerSummarySection } from "./components/TeamOverviewCareerSummarySection";
import { TeamOverviewAdaptationSection } from "./components/TeamOverviewAdaptationSection";
import { TeamOverviewPeopleFiltersBar } from "./components/TeamOverviewPeopleFiltersBar";
import { TeamOverviewKpiDetailSection } from "./components/TeamOverviewKpiDetailSection";
import { TeamOverviewPerformanceTrendSection } from "./components/TeamOverviewPerformanceTrendSection";
import { TeamOverviewAiTeamSummarySection } from "./components/TeamOverviewAiTeamSummarySection";
import { TeamOverviewFullAlertsSection } from "./components/TeamOverviewFullAlertsSection";
import { TeamManagementPanel } from "./TeamManagementPanel";
import {
  TeamOverviewPremiumShell,
  TeamOverviewPremiumBriefingDark,
} from "./premium/TeamOverviewPremiumShell";
import { TeamOverviewPremiumMemberRow } from "./premium/TeamOverviewPremiumMemberRow";
import { TeamOverviewPremiumRuntimeChecks } from "./premium/TeamOverviewPremiumRuntimeChecks";
import { TeamOverviewCockpitFourCards } from "./TeamOverviewCockpitFourCards";
import { TeamOverviewCrmCardModal } from "./TeamOverviewCrmCardModal";
import { TeamOverviewProgressTreeModal } from "./TeamOverviewProgressTreeModal";
import { TeamOverviewCheckInModal } from "./TeamOverviewCheckInModal";
import { formatCareerProgramLabel, formatCareerTrackLabel } from "@/lib/career/evaluate-career-progress";
import { formatTeamOverviewProduction, poolProgramLabel } from "@/lib/team-overview-format";
import type { CareerProgramId } from "@/lib/career/types";

const PERIOD_OPTIONS: { value: TeamOverviewPeriod; label: string }[] = [
  { value: "week", label: "Týden" },
  { value: "month", label: "Měsíc" },
  { value: "quarter", label: "Kvartál" },
];

const VIEW_TAB_ORDER = [
  "Cockpit",
  "Lidé",
  "Kariéra",
  "Adaptace",
  "Struktura",
  "Správa týmu",
] as const;

function poolColumnLabel(programId: CareerProgramId): string {
  if (programId === "beplan" || programId === "premium_brokers") return poolProgramLabel(programId);
  return formatCareerProgramLabel(programId);
}

interface TeamOverviewViewProps {
  teamId: string;
  currentUserId: string;
  currentUserEmail: string;
  currentUserFullName: string | null;
  currentRole: string;
  initialScope: TeamOverviewScope;
  initialHierarchy: TeamTreeNode[];
  initialKpis: TeamOverviewKpis | null;
  initialMembers: TeamMemberInfo[];
  initialMetrics: TeamMemberMetrics[];
  initialAlerts: TeamAlert[];
  initialNewcomers: NewcomerAdaptation[];
  initialPerformanceOverTime: TeamPerformancePoint[];
  initialRhythmCalendar?: TeamRhythmCalendarData | null;
  defaultPeriod: TeamOverviewPeriod;
  canCreateTeamCalendar?: boolean;
  /** Úkol/schůzka z AI follow-up — stejná logika jako createTask (contacts:write | tasks:*). */
  canCreateAiTeamFollowUp?: boolean;
  /** Z ?member= — výběr pro boční panel (server předává z URL). */
  initialSelectedMemberId?: string | null;
  canEditTeamCareer?: boolean;
}

export function TeamOverviewView({
  teamId,
  currentUserId,
  currentUserEmail,
  currentUserFullName,
  currentRole,
  initialScope,
  initialHierarchy,
  initialKpis,
  initialMembers,
  initialMetrics,
  initialAlerts,
  initialNewcomers,
  initialPerformanceOverTime,
  initialRhythmCalendar = null,
  defaultPeriod,
  canCreateTeamCalendar = false,
  canCreateAiTeamFollowUp = true,
  initialSelectedMemberId = null,
  canEditTeamCareer = false,
}: TeamOverviewViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const teamManagementHref = `${pathname}#sprava-tymu`;
  const [period, setPeriod] = useState<TeamOverviewPeriod>(defaultPeriod);
  const [scope, setScope] = useState<TeamOverviewScope>(initialScope);
  const [kpis, setKpis] = useState<TeamOverviewKpis | null>(initialKpis);
  const [members, setMembers] = useState<TeamMemberInfo[]>(initialMembers);
  const [metrics, setMetrics] = useState<TeamMemberMetrics[]>(initialMetrics);
  const [alerts, setAlerts] = useState<TeamAlert[]>(initialAlerts);
  const [newcomers, setNewcomers] = useState<NewcomerAdaptation[]>(initialNewcomers);
  const [performanceOverTime, setPerformanceOverTime] = useState<TeamPerformancePoint[]>(initialPerformanceOverTime);
  const [hierarchy, setHierarchy] = useState<TeamTreeNode[]>(initialHierarchy);
  const [peopleSegment, setPeopleSegment] = useState<PeopleSegmentFilter>("all");
  const [performanceFilter, setPerformanceFilter] = useState<"all" | "top" | "bottom">("all");
  const [peopleSearch, setPeopleSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(initialSelectedMemberId);
  const [selectedDetail, setSelectedDetail] = useState<TeamMemberDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiGenerationId, setAiGenerationId] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiFeedbackSubmitted, setAiFeedbackSubmitted] = useState(false);
  const [aiFeedbackSaving, setAiFeedbackSaving] = useState(false);
  const [teamActionSaving, setTeamActionSaving] = useState(false);
  const [teamActionError, setTeamActionError] = useState<string | null>(null);
  const [teamCalendarModal, setTeamCalendarModal] = useState<"event" | "task" | null>(null);
  const [calendarPrefill, setCalendarPrefill] = useState<TeamCalendarModalPrefill | null>(null);
  const [rhythmCalendar, setRhythmCalendar] = useState<TeamRhythmCalendarData | null>(initialRhythmCalendar ?? null);
  /** Cockpit / Lidé / Kariéra / Adaptace / Struktura / Správa týmu — podle mocku týmového přehledu. */
  type ActiveTab = (typeof VIEW_TAB_ORDER)[number];
  const [activeView, setActiveView] = useState<ActiveTab>("Cockpit");

  const [overviewModal, setOverviewModal] = useState<
    null | { type: "crm" | "progress" | "checkin"; userId: string }
  >(null);

  useEffect(() => {
    const syncViewWithHash = () => {
      if (window.location.hash === "#sprava-tymu") {
        setActiveView("Správa týmu");
      }
    };

    syncViewWithHash();
    window.addEventListener("hashchange", syncViewWithHash);
    return () => window.removeEventListener("hashchange", syncViewWithHash);
  }, []);

  const syncTeamOverviewUrl = useCallback(
    (next: { period?: TeamOverviewPeriod; memberId?: string | null; scope?: TeamOverviewScope }) => {
      const p = new URLSearchParams();
      const per = next.period ?? period;
      const sc = next.scope ?? scope;
      if (per !== "month") p.set("period", per);
      p.set("scope", sc);
      const mem = next.memberId !== undefined ? next.memberId : selectedUserId;
      if (mem) p.set("member", mem);
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, period, router, scope, selectedUserId]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getTeamOverviewPageSnapshot(period, scope);
      setKpis(snap.kpis ?? null);
      setMembers(snap.members);
      setMetrics(snap.metrics);
      setAlerts(snap.alerts);
      setNewcomers(snap.newcomers);
      setPerformanceOverTime(snap.performanceOverTime);
      setHierarchy(snap.hierarchy);
      setRhythmCalendar(snap.rhythmCalendar);
    } finally {
      setLoading(false);
    }
  }, [period, scope]);

  const selectMember = useCallback(
    (userId: string | null) => {
      setSelectedUserId(userId);
      syncTeamOverviewUrl({ memberId: userId });
    },
    [syncTeamOverviewUrl]
  );

  const loadLatestTeamSummary = useCallback(async () => {
    setAiError(null);
    setAiLoading(true);
    try {
      const item = await getLatestTeamSummaryAction();
      if (item) {
        setAiSummary(item.outputText);
        setAiGenerationId(item.id);
      } else {
        setAiSummary(null);
        setAiGenerationId(null);
      }
    } catch {
      setAiError("Načtení shrnutí se nepovedlo.");
    } finally {
      setAiLoading(false);
    }
  }, []);

  const generateTeamSummary = useCallback(async () => {
    setAiError(null);
    setAiLoading(true);
    try {
      const result = await generateTeamSummaryAction(period, scope);
      if (result.ok) {
        setAiSummary(result.text);
        if (result.generationId) setAiGenerationId(result.generationId);
        setAiFeedbackSubmitted(false);
      } else {
        setAiError(result.error ?? "Generování se nepovedlo.");
      }
    } catch {
      setAiError("Generování se nepovedlo. Zkuste to později.");
    } finally {
      setAiLoading(false);
    }
  }, [period, scope]);

  const submitTeamSummaryFeedback = useCallback(
    async (verdict: AiFeedbackVerdict, actionTaken: AiFeedbackActionTaken) => {
      if (!aiGenerationId) return;
      setAiFeedbackSaving(true);
      setAiError(null);
      try {
        const result = await submitAiFeedbackAction(aiGenerationId, verdict, { actionTaken });
        if (result.ok) setAiFeedbackSubmitted(true);
        else setAiError(result.error ?? "Odeslání zpětné vazby se nepovedlo.");
      } catch {
        setAiError("Odeslání zpětné vazby se nepovedlo.");
      } finally {
        setAiFeedbackSaving(false);
      }
    },
    [aiGenerationId]
  );

  const createTeamFollowUp = useCallback(
    async (actionType: AiActionType, title: string, memberId: string | null, dueAt?: string) => {
      if (!aiGenerationId || actionType === "deal") return;
      setTeamActionSaving(true);
      setTeamActionError(null);
      try {
        const result = await createTeamActionFromAi(
          {
            sourceGenerationId: aiGenerationId,
            sourcePromptType: "teamSummary",
            actionType,
            title: title.trim(),
            dueAt: dueAt || undefined,
          },
          teamId,
          memberId,
          {
            sourceSurface: "portal_team",
            idempotencyKey: `${aiGenerationId}:${actionType}:${title.trim().toLowerCase()}:${memberId ?? "self"}`,
          }
        );
        if (result.ok) {
          setTeamActionError(null);
          if (result.entityType === "event") window.location.href = "/portal/calendar";
          else window.location.href = "/portal/tasks";
        } else {
          setTeamActionError(result.error ?? "Vytvoření akce se nepovedlo.");
        }
      } catch {
        setTeamActionError("Vytvoření akce se nepovedlo.");
      } finally {
        setTeamActionSaving(false);
      }
    },
    [aiGenerationId, teamId]
  );

  useEffect(() => {
    loadLatestTeamSummary();
  }, [loadLatestTeamSummary]);
  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!selectedUserId) {
      setSelectedDetail(null);
      setDetailLoading(false);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setSelectedDetail(null);
    getTeamMemberDetail(selectedUserId, { period, scope })
      .then((d) => {
        if (!cancelled) setSelectedDetail(d);
      })
      .catch(() => {
        if (!cancelled) setSelectedDetail(null);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedUserId, period, scope]);

  useEffect(() => {
    if (!selectedUserId) return;
    if (!isSelectedMemberInScope(selectedUserId, members)) {
      selectMember(null);
    }
  }, [members, selectedUserId, selectMember]);

  const metricsByUser = useMemo(() => new Map(metrics.map((m) => [m.userId, m])), [metrics]);
  const inProductionCount = useMemo(
    () => metrics.filter((m) => m.productionThisPeriod > 0).length,
    [metrics]
  );
  const displayName = useCallback((m: TeamMemberInfo) => m.displayName || "Člen týmu", []);
  const newcomerSet = useMemo(() => new Set(newcomers.map((n) => n.userId)), [newcomers]);

  const memberDetailHref = useCallback(
    (userId: string) =>
      `/portal/team-overview/${userId}?${new URLSearchParams({ period, scope }).toString()}`,
    [period, scope]
  );

  const pageModel = useMemo(
    () =>
      buildTeamOverviewPageModel({
        scope,
        kpis,
        members,
        metrics,
        newcomers,
        alerts,
        rhythmCalendar,
      }),
    [scope, kpis, members, metrics, newcomers, alerts, rhythmCalendar]
  );

  const attentionUserIdSet = useMemo(() => new Set(pageModel.attentionUserIds), [pageModel.attentionUserIds]);

  const openTeamEventModal = useCallback((prefill?: TeamCalendarModalPrefill | null) => {
    setCalendarPrefill(prefill ?? null);
    setTeamCalendarModal("event");
  }, []);

  const openTeamTaskModal = useCallback((prefill?: TeamCalendarModalPrefill | null) => {
    setCalendarPrefill(prefill ?? null);
    setTeamCalendarModal("task");
  }, []);

  const resolveRhythmMemberLabel = useCallback(
    (userId: string) => {
      const m = members.find((x) => x.userId === userId);
      return m ? m.displayName || "Člen týmu" : "Člen týmu";
    },
    [members]
  );

  const scopeOptions: { value: TeamOverviewScope; label: string }[] = useMemo(() => {
    if (currentRole === "Advisor" || currentRole === "Viewer") return [{ value: "me", label: "Já" }];
    if (currentRole === "Manager") {
      return [
        { value: "me", label: "Já" },
        { value: "my_team", label: "Můj tým" },
      ];
    }
    return [
      { value: "me", label: "Já" },
      { value: "my_team", label: "Můj tým" },
      { value: "full", label: "Celá struktura" },
    ];
  }, [currentRole]);

  const sortedMembers = useMemo(
    () => sortTeamMembersForOverview(members, metricsByUser, performanceFilter),
    [members, metricsByUser, performanceFilter]
  );

  const visibleMembers = useMemo(
    () =>
      getVisibleTeamMembers({
        sortedMembers,
        metricsByUser,
        newcomerSet,
        attentionUserIds: attentionUserIdSet,
        peopleSegment,
        peopleQueryTrimmed: peopleSearch.trim(),
      }),
    [sortedMembers, metricsByUser, newcomerSet, attentionUserIdSet, peopleSegment, peopleSearch]
  );

  const rankedMetrics = useMemo(
    () => [...metrics].sort((a, b) => b.productionThisPeriod - a.productionThisPeriod),
    [metrics]
  );
  const topMetric = rankedMetrics[0] ?? null;
  const bottomMetric = rankedMetrics.length > 0 ? rankedMetrics[rankedMetrics.length - 1] : null;

  const topAttentionAlerts = alerts.slice(0, 5);

  const selectedOutsideFilter =
    selectedUserId != null &&
    isSelectedMemberInScope(selectedUserId, members) &&
    !isSelectedInFilteredList(selectedUserId, visibleMembers);

  const briefingStats = useMemo(() => {
    const cs = pageModel.careerTeamSummary;
    const byTrack = (id: CareerTrackId) => cs.byTrack.find((t) => t.trackId === id)?.count ?? 0;
    return {
      attention: pageModel.attentionUserIds.length,
      adaptation: newcomers.length,
      onTrack: cs.byManagerLabel["Na dobré cestě"] ?? 0,
      managerial: byTrack("management_structure"),
      performance: byTrack("individual_performance") + byTrack("reality") + byTrack("call_center"),
    };
  }, [pageModel, newcomers]);

  const priorityItems = useMemo(
    () =>
      deriveTeamOverviewPriorities({
        briefing: pageModel.briefing,
        newcomers,
        rhythm: pageModel.rhythmComputed,
        kpis,
        scopeIsTeam: scope !== "me",
      }),
    [pageModel, newcomers, kpis, scope]
  );

  const scopeLabelActive = scopeOptions.find((o) => o.value === scope)?.label ?? "Já";
  const periodLabelActive = PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? "Měsíc";

  const handleScopeToggle = useCallback(
    (label: string) => {
      const opt = scopeOptions.find((o) => o.label === label);
      if (opt) {
        setScope(opt.value);
        syncTeamOverviewUrl({ scope: opt.value });
      }
    },
    [scopeOptions, syncTeamOverviewUrl]
  );

  const handlePeriodToggle = useCallback(
    (label: string) => {
      const opt = PERIOD_OPTIONS.find((o) => o.label === label);
      if (opt) {
        setPeriod(opt.value);
        syncTeamOverviewUrl({ period: opt.value });
      }
    },
    [syncTeamOverviewUrl]
  );

  const handleViewChange = useCallback((label: string) => {
    if ((VIEW_TAB_ORDER as readonly string[]).includes(label)) {
      setActiveView(label as ActiveTab);
    }
  }, []);

  const openMemberModal = useCallback(
    (type: "crm" | "progress" | "checkin", userId: string) => {
      setOverviewModal({ type, userId });
    },
    []
  );

  const hierarchyBanner =
    kpis && scope !== "me" && !kpis.hierarchyParentLinksConfigured ? (
      <div
        className="mb-5 rounded-xl border border-amber-200/70 bg-amber-50/70 px-4 py-2.5 text-xs text-amber-950"
        role="status"
      >
        <span className="font-semibold">Hierarchie týmu není kompletní.</span>{" "}
        Vazby nadřízenosti zatím chybí — rozsah „Můj tým“ zobrazí jen vás.
        <a href={teamManagementHref} className="underline hover:text-amber-800">
          Doplňte v záložce Správa týmu
        </a>
        .
      </div>
    ) : null;

  const peopleFiltersInner = (
    <>
      <TeamOverviewPeopleFiltersBar
        peopleSearch={peopleSearch}
        onPeopleSearchChange={setPeopleSearch}
        peopleSegment={peopleSegment}
        onPeopleSegmentChange={setPeopleSegment}
        performanceFilter={performanceFilter}
        onPerformanceFilterChange={setPerformanceFilter}
        visibleCount={visibleMembers.length}
        totalCount={members.length}
      />
      <div className="mt-4 space-y-3">
        {visibleMembers.length === 0 ? (
          <p className="rounded-3xl border border-slate-200/80 bg-slate-50/90 px-5 py-7 text-center text-sm leading-6 text-slate-600">
            {members.length === 0
              ? "V tomto rozsahu zatím nejsou žádní členové — zkuste jiný rozsah nebo doplnění hierarchie."
              : "Žádný člen neodpovídá filtru — upravte segment nebo vyhledávání."}
          </p>
        ) : (
          visibleMembers.map((m) => (
            <TeamOverviewPremiumMemberRow
              key={m.userId}
              member={m}
              metrics={metricsByUser.get(m.userId)}
              displayName={displayName}
              active={selectedUserId === m.userId}
              onClick={() => selectMember(m.userId)}
            />
          ))
        )}
      </div>
    </>
  );

  const peopleAndFilters = (
    <div className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm md:p-6">{peopleFiltersInner}</div>
  );

  const peopleLideTab = (
    <>
      <div className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm md:p-6">
        {peopleFiltersInner}
        {visibleMembers.length > 0 ? (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-left text-sm">
              <thead className="sticky top-0 z-10 bg-white/95 text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400 backdrop-blur-sm">
                <tr>
                  <th className="px-4 py-3">Jméno a role</th>
                  <th className="px-4 py-3">Kariéra (program / větev)</th>
                  <th className="px-4 py-3">Skupina (pool)</th>
                  <th className="px-4 py-3">Výkon (produkce)</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Akce</th>
                </tr>
              </thead>
              <tbody>
                {visibleMembers.map((mem) => {
                  const mm = metricsByUser.get(mem.userId);
                  const ce = mm?.careerEvaluation;
                  return (
                    <tr
                      key={mem.userId}
                      className="cursor-pointer bg-white shadow-sm ring-1 ring-slate-200/70 transition hover:-translate-y-px hover:bg-slate-50"
                      onClick={() => selectMember(mem.userId)}
                    >
                      <td className="rounded-l-2xl px-4 py-4">
                        <div className="font-semibold text-slate-950">{displayName(mem)}</div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{mem.roleName}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-xs font-semibold text-slate-800">
                          {ce ? formatCareerProgramLabel(ce.careerProgramId) : "—"}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {ce ? formatCareerTrackLabel(ce.careerTrackId) : "—"} · {ce?.careerPositionLabel ?? "—"}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-xs font-semibold text-slate-800">
                        {ce ? poolColumnLabel(ce.careerProgramId) : "—"}
                      </td>
                      <td className="px-4 py-4 font-black text-slate-950">
                        {mm ? formatTeamOverviewProduction(mm.productionThisPeriod) : "—"}
                        <div className="text-[10px] font-medium text-slate-500">
                          Jednotky: {mm != null ? mm.unitsThisPeriod : "—"}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                          {ce?.managerProgressLabel ?? "—"}
                        </span>
                      </td>
                      <td className="rounded-r-2xl px-4 py-4 text-right">
                        <div className="flex flex-col items-end gap-1.5 sm:flex-row sm:justify-end">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openMemberModal("progress", mem.userId);
                              selectMember(mem.userId);
                            }}
                            className="rounded-2xl bg-violet-100 px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-violet-900 transition hover:bg-violet-200/80"
                          >
                            Strom
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openMemberModal("crm", mem.userId);
                              selectMember(mem.userId);
                            }}
                            className="rounded-2xl bg-slate-100 px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#16192b] transition hover:bg-slate-200"
                          >
                            CRM karta
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
      <TeamOverviewFullAlertsSection alerts={alerts} selectMember={selectMember} memberDetailHref={memberDetailHref} />
    </>
  );

  const teamAdminOnly = (
    <TeamManagementPanel
      currentUserId={currentUserId}
      currentUserEmail={currentUserEmail}
      currentUserFullName={currentUserFullName}
      roleName={currentRole}
    />
  );

  const cockpitBody = (
    <>
      {/* First fold: briefing → KPI / výkon → pozornost; AI až pod tím jako sekundární */}
      <div className="space-y-3">
        <TeamOverviewPremiumBriefingDark
          periodLabel={periodLabelActive}
          scopeLabel={scopeLabelActive}
          stats={briefingStats}
          priorityItems={priorityItems}
        />

        <TeamOverviewCockpitFourCards kpis={kpis} inProductionCount={inProductionCount} loading={loading} />

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(280px,1fr)]">
          <div className="min-w-0 space-y-3">
            <TeamOverviewKpiDetailSection
              loading={loading}
              kpis={kpis}
              members={members}
              topMetric={topMetric}
              bottomMetric={bottomMetric}
            />
            <TeamOverviewPerformanceTrendSection performanceOverTime={performanceOverTime} />
          </div>
          <div className="min-w-0">
            <TeamOverviewAttentionSection
              variant="firstFold"
              scope={scope}
              members={members}
              displayName={displayName}
              topAttentionAlerts={topAttentionAlerts}
              pageModel={pageModel}
              selectMember={selectMember}
              canCreateTeamCalendar={canCreateTeamCalendar}
            />
          </div>
        </div>

        <div className="max-w-3xl rounded-[24px] border border-dashed border-slate-200/80 bg-slate-50/60 p-1.5 opacity-90">
          <TeamOverviewAiTeamSummarySection
            compact
            aiLoading={aiLoading}
            aiError={aiError}
            aiSummary={aiSummary}
            aiGenerationId={aiGenerationId}
            aiFeedbackSubmitted={aiFeedbackSubmitted}
            aiFeedbackSaving={aiFeedbackSaving}
            teamActionSaving={teamActionSaving}
            teamActionError={teamActionError}
            canCreateAiTeamFollowUp={canCreateAiTeamFollowUp}
            members={members}
            onLoadLatest={loadLatestTeamSummary}
            onGenerate={generateTeamSummary}
            onSubmitFeedback={submitTeamSummaryFeedback}
            onCreateFollowUp={createTeamFollowUp}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-4 2xl:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
        <TeamRhythmPanel
          computed={pageModel.rhythmComputed}
          disclaimer={
            rhythmCalendar?.disclaimerCs ??
            "Týmové položky pocházejí z team_events / team_tasks a jsou filtrované podle rozsahu přehledu."
          }
          scope={scope}
          canCreate={canCreateTeamCalendar}
          memberDetailHref={memberDetailHref}
          resolveMemberLabel={resolveRhythmMemberLabel}
          onOpenEvent={openTeamEventModal}
          onOpenTask={openTeamTaskModal}
        />
        <TeamStructurePanel
          roots={hierarchy}
          currentUserId={currentUserId}
          scope={scope}
          memberDetailQuery={`?${new URLSearchParams({ period, scope }).toString()}`}
          hierarchyParentLinksConfigured={kpis?.hierarchyParentLinksConfigured !== false}
          selectedUserId={selectedUserId}
          onSelectMember={selectMember}
          metricsByUser={metricsByUser}
          newcomerUserIds={newcomerSet}
        />
      </div>

      {peopleAndFilters}
    </>
  );

  const careerOnly = (
    <>
      <div className="mb-4 rounded-[28px] border border-slate-200/80 bg-white px-5 py-4 shadow-sm">
        <h2 className="text-lg font-black tracking-tight text-slate-950">Kariéra a výkon</h2>
        <p className="mt-1.5 text-sm text-slate-600">
          {periodLabelActive} · {scopeLabelActive} · Beplan {pageModel.poolSplit.counts.beplan} lidí /{" "}
          {pageModel.poolSplit.units.beplan} j. · Premium Brokers {pageModel.poolSplit.counts.premium_brokers} lidí /{" "}
          {pageModel.poolSplit.units.premium_brokers} j.
        </p>
      </div>
      <div className="space-y-4">
        <TeamOverviewCareerSummarySection
          members={members}
          metrics={metrics}
          pageModel={pageModel}
          displayName={displayName}
          selectMember={selectMember}
          onOpenCrm={(uid) => openMemberModal("crm", uid)}
          onOpenProgress={(uid) => openMemberModal("progress", uid)}
        />
        <TeamOverviewKpiDetailSection
          loading={loading}
          kpis={kpis}
          members={members}
          topMetric={topMetric}
          bottomMetric={bottomMetric}
        />
        <TeamOverviewPerformanceTrendSection performanceOverTime={performanceOverTime} />
      </div>
    </>
  );

  const adaptationOnly = (
    <>
      {hierarchyBanner}
      <TeamOverviewAdaptationSection
        variant="standalone"
        members={members}
        newcomers={newcomers}
        displayName={displayName}
        memberDetailHref={memberDetailHref}
        selectMember={selectMember}
        onCheckIn={(userId) => openMemberModal("checkin", userId)}
      />
    </>
  );

  const structureOnly = (
    <>
      {hierarchyBanner}
      <TeamStructurePanel
        roots={hierarchy}
        currentUserId={currentUserId}
        scope={scope}
        memberDetailQuery={`?${new URLSearchParams({ period, scope }).toString()}`}
        hierarchyParentLinksConfigured={kpis?.hierarchyParentLinksConfigured !== false}
        selectedUserId={selectedUserId}
        onSelectMember={selectMember}
        metricsByUser={metricsByUser}
        newcomerUserIds={newcomerSet}
      />
    </>
  );

  const mainColumn =
    activeView === "Struktura"
      ? structureOnly
      : activeView === "Lidé"
        ? peopleLideTab
        : activeView === "Kariéra"
          ? careerOnly
          : activeView === "Adaptace"
            ? adaptationOnly
            : activeView === "Správa týmu"
              ? teamAdminOnly
              : cockpitBody;

  const overviewModalMetrics =
    overviewModal != null ? metricsByUser.get(overviewModal.userId) ?? null : null;
  const overviewModalMember =
    overviewModal != null ? members.find((m) => m.userId === overviewModal.userId) ?? null : null;
  const overviewModalName = overviewModalMember ? displayName(overviewModalMember) : "Člen týmu";
  const overviewModalCareer =
    overviewModalMetrics?.careerEvaluation ??
    (overviewModal != null && selectedDetail?.userId === overviewModal.userId
      ? selectedDetail.careerEvaluation
      : null) ??
    null;

  return (
    <>
      <TeamOverviewPremiumShell
        title="Tým"
        subtitle="Výkon, struktura a navazující práce v týmu."
        scopeItems={scopeOptions.map((o) => o.label)}
        scopeActive={scopeLabelActive}
        onScopeItemChange={handleScopeToggle}
        periodItems={PERIOD_OPTIONS.map((o) => o.label)}
        periodActive={periodLabelActive}
        onPeriodItemChange={handlePeriodToggle}
        viewItems={[...VIEW_TAB_ORDER]}
        viewActive={activeView}
        onViewChange={handleViewChange}
        teamManagementHref={teamManagementHref}
        onTeamManagementOpen={() => setActiveView("Správa týmu")}
        showTeamManagementQuickLink={false}
        calendarActions={
          <div id="team-calendar-actions" className="flex flex-wrap gap-2">
            <TeamCalendarButtons
              canCreate={canCreateTeamCalendar}
              onOpenEvent={() => openTeamEventModal(null)}
              onOpenTask={() => openTeamTaskModal(null)}
            />
          </div>
        }
        onRefresh={refresh}
        loading={loading}
        runtimeChecksSlot={
          process.env.NODE_ENV === "development" ? (
            <TeamOverviewPremiumRuntimeChecks
              membersCount={members.length}
              metricsCount={metrics.length}
              hierarchyRoots={hierarchy.length}
            />
          ) : null
        }
        aside={
          <TeamOverviewSelectedMemberPanel
            detail={selectedDetail}
            loading={detailLoading}
            fullDetailHref={selectedUserId ? memberDetailHref(selectedUserId) : "#"}
            onClose={() => selectMember(null)}
            canCreateTeamCalendar={canCreateTeamCalendar}
            canEditTeamCareer={canEditTeamCareer}
            outsideFilter={selectedOutsideFilter}
            variant="premium"
            selectedUserId={selectedUserId}
            metricsSnapshot={selectedUserId ? metricsByUser.get(selectedUserId) ?? null : null}
            onOpenCrm={
              selectedUserId ? () => openMemberModal("crm", selectedUserId) : undefined
            }
            onOpenProgress={
              selectedUserId ? () => openMemberModal("progress", selectedUserId) : undefined
            }
            onOpenCheckIn={
              selectedUserId ? () => openMemberModal("checkin", selectedUserId) : undefined
            }
            onOpenOneToOne={
              selectedUserId
                ? () => {
                    const m = members.find((x) => x.userId === selectedUserId);
                    setCalendarPrefill({
                      title: `1:1 — ${m ? displayName(m) : "člen"}`,
                      memberUserIds: [selectedUserId],
                    });
                    setTeamCalendarModal("event");
                  }
                : undefined
            }
          />
        }
      >
        {activeView === "Cockpit" || activeView === "Kariéra" ? hierarchyBanner : null}
        {mainColumn}
      </TeamOverviewPremiumShell>

      <TeamCalendarModal
        open={teamCalendarModal != null}
        type={teamCalendarModal}
        onClose={() => {
          setTeamCalendarModal(null);
          setCalendarPrefill(null);
        }}
        members={members}
        metrics={metrics}
        newcomers={newcomers}
        onSuccess={refresh}
        prefill={calendarPrefill}
      />

      {overviewModal?.type === "crm" && overviewModalMetrics ? (
        <TeamOverviewCrmCardModal
          open
          userId={overviewModal.userId}
          memberName={overviewModalName}
          metrics={overviewModalMetrics}
          careerEvaluation={overviewModalMetrics.careerEvaluation}
          period={period}
          onClose={() => setOverviewModal(null)}
        />
      ) : null}

      {overviewModal?.type === "progress" && overviewModalCareer ? (
        <TeamOverviewProgressTreeModal
          open
          memberName={overviewModalName}
          careerEvaluation={overviewModalCareer}
          onClose={() => setOverviewModal(null)}
        />
      ) : null}

      {overviewModal?.type === "checkin" ? (
        <TeamOverviewCheckInModal
          open={true}
          memberName={overviewModalName}
          memberUserId={overviewModal.userId}
          onClose={() => setOverviewModal(null)}
          onSuccess={refresh}
        />
      ) : null}
    </>
  );
}
