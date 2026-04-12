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

const PERIOD_OPTIONS: { value: TeamOverviewPeriod; label: string }[] = [
  { value: "week", label: "Týden" },
  { value: "month", label: "Měsíc" },
  { value: "quarter", label: "Kvartál" },
];

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
  /** Cockpit = CRM dashboard; Kariéra = souhrn kariéry a výkonu; Struktura / Lidé = dílčí pohledy. */
  const [activeView, setActiveView] = useState("Cockpit");

  useEffect(() => {
    const syncViewWithHash = () => {
      if (window.location.hash === "#sprava-tymu") {
        setActiveView("Lidé");
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

  const hierarchyBanner =
    kpis && scope !== "me" && !kpis.hierarchyParentLinksConfigured ? (
      <div
        className="mb-5 rounded-xl border border-amber-200/70 bg-amber-50/70 px-4 py-2.5 text-xs text-amber-950"
        role="status"
      >
        <span className="font-semibold">Hierarchie týmu není kompletní.</span>{" "}
        Vazby nadřízenosti zatím chybí — rozsah „Můj tým“ zobrazí jen vás.
        <a href={teamManagementHref} className="underline hover:text-amber-800">
          Doplňte v pohledu Lidé → Správa týmu
        </a>
        .
      </div>
    ) : null;

  const peopleAndFilters = (
    <>
      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
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
            <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
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
      </div>
    </>
  );

  /** Lidé: správa + alerty — adaptace je jen v pohledu Kariéra. */
  const peopleOperationalSections = (
    <>
      <TeamManagementPanel
        currentUserId={currentUserId}
        currentUserEmail={currentUserEmail}
        currentUserFullName={currentUserFullName}
        roleName={currentRole}
      />
      <TeamOverviewFullAlertsSection alerts={alerts} selectMember={selectMember} memberDetailHref={memberDetailHref} />
    </>
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

        <div className="max-w-3xl rounded-lg border border-dashed border-slate-200/80 bg-slate-50/50 p-1.5 opacity-90">
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
        />
      </div>

      {peopleAndFilters}
    </>
  );

  const careerOnly = (
    <>
      <div className="mb-4 border-b border-slate-200 pb-3">
        <h2 className="text-base font-semibold text-slate-900">Kariéra a výkon</h2>
        <p className="mt-1 text-xs text-slate-600">
          {periodLabelActive} · {scopeLabelActive} · Beplan {pageModel.poolSplit.counts.beplan} lidí /{" "}
          {pageModel.poolSplit.units.beplan} j. · Premium Brokers {pageModel.poolSplit.counts.premium_brokers} lidí /{" "}
          {pageModel.poolSplit.units.premium_brokers} j.
        </p>
      </div>
      <div className="space-y-4">
        <TeamOverviewCareerSummarySection
          members={members}
          pageModel={pageModel}
          displayName={displayName}
          selectMember={selectMember}
        />
        <TeamOverviewKpiDetailSection
          loading={loading}
          kpis={kpis}
          members={members}
          topMetric={topMetric}
          bottomMetric={bottomMetric}
        />
        <TeamOverviewPerformanceTrendSection performanceOverTime={performanceOverTime} />
        {members.length > 0 ? (
          <TeamOverviewAdaptationSection
            members={members}
            newcomers={newcomers}
            displayName={displayName}
            memberDetailHref={memberDetailHref}
            selectMember={selectMember}
          />
        ) : null}
      </div>
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
      />
    </>
  );

  const peopleOnly = (
    <>
      {peopleAndFilters}
      {peopleOperationalSections}
    </>
  );

  const mainColumn =
    activeView === "Struktura"
      ? structureOnly
      : activeView === "Lidé"
        ? peopleOnly
        : activeView === "Kariéra"
          ? careerOnly
          : cockpitBody;

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
        viewItems={["Cockpit", "Kariéra", "Struktura", "Lidé"]}
        viewActive={activeView}
        onViewChange={setActiveView}
        teamManagementHref={teamManagementHref}
        onTeamManagementOpen={() => setActiveView("Lidé")}
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
    </>
  );
}
