"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Users, Calendar, UserPlus, RefreshCw } from "lucide-react";
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
import { CustomDropdown } from "@/app/components/ui/CustomDropdown";
import { buildTeamOverviewPageModel, type PeopleSegmentFilter } from "@/lib/team-overview-page-model";
import {
  sortTeamMembersForOverview,
  getVisibleTeamMembers,
  isSelectedMemberInScope,
  isSelectedInFilteredList,
} from "@/lib/team-overview-members";
import { TeamOverviewBriefing } from "./components/TeamOverviewBriefing";
import { TeamOverviewAttentionSection } from "./components/TeamOverviewAttentionSection";
import { TeamOverviewCareerSummarySection } from "./components/TeamOverviewCareerSummarySection";
import { TeamOverviewPoolSplitSection } from "./components/TeamOverviewPoolSplitSection";
import { TeamOverviewAdaptationSection } from "./components/TeamOverviewAdaptationSection";
import { TeamOverviewPeopleFiltersBar } from "./components/TeamOverviewPeopleFiltersBar";
import { TeamOverviewMembersTable } from "./components/TeamOverviewMembersTable";
import { TeamOverviewKpiDetailSection } from "./components/TeamOverviewKpiDetailSection";
import { TeamOverviewPerformanceTrendSection } from "./components/TeamOverviewPerformanceTrendSection";
import { TeamOverviewAiTeamSummarySection } from "./components/TeamOverviewAiTeamSummarySection";
import { TeamOverviewFullAlertsSection } from "./components/TeamOverviewFullAlertsSection";
import { TeamManagementPanel } from "./TeamManagementPanel";

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

  const scopeOptions: { value: TeamOverviewScope; label: string }[] =
    currentRole === "Advisor" || currentRole === "Viewer"
      ? [{ value: "me", label: "Já" }]
      : currentRole === "Manager"
        ? [
            { value: "me", label: "Já" },
            { value: "my_team", label: "Můj tým" },
          ]
        : [
            { value: "me", label: "Já" },
            { value: "my_team", label: "Můj tým" },
            { value: "full", label: "Celá struktura" },
          ];

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

  return (
    <div className="min-h-screen bg-[var(--wp-bg)]">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 py-6 md:py-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6 md:mb-7">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[color:var(--wp-text)] md:text-3xl">
              Team Overview
            </h1>
            <p className="mt-1 text-sm text-[color:var(--wp-text-secondary)] max-w-lg">
              Pozornost, coaching, kariéra a rytmus — manažerský cockpit vašeho týmu.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={teamManagementHref}
              className="inline-flex items-center gap-2 min-h-[44px] rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-black uppercase tracking-widest text-indigo-800 hover:bg-indigo-100 transition-colors"
            >
              <UserPlus className="w-4 h-4 shrink-0" />
              Pozvat člena
            </Link>
            <div id="team-calendar-actions" className="flex flex-wrap gap-2">
              <TeamCalendarButtons
                canCreate={canCreateTeamCalendar}
                onOpenEvent={() => openTeamEventModal(null)}
                onOpenTask={() => openTeamTaskModal(null)}
              />
            </div>
            <CustomDropdown
              value={scope}
              onChange={(id) => {
                const ns = id as TeamOverviewScope;
                setScope(ns);
                syncTeamOverviewUrl({ scope: ns });
              }}
              options={scopeOptions.map((o) => ({ id: o.value, label: o.label }))}
              placeholder="Rozsah"
              icon={Users}
            />
            <CustomDropdown
              value={period}
              onChange={(id) => {
                const np = id as TeamOverviewPeriod;
                setPeriod(np);
                syncTeamOverviewUrl({ period: np });
              }}
              options={PERIOD_OPTIONS.map((o) => ({ id: o.value, label: o.label }))}
              placeholder="Období"
              icon={Calendar}
            />
            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] px-4 py-2 text-sm font-medium text-[color:var(--wp-text-secondary)] shadow-sm hover:bg-[color:var(--wp-surface-muted)] disabled:opacity-60"
              aria-label="Obnovit data"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {kpis && scope !== "me" && !kpis.hierarchyParentLinksConfigured ? (
          <div
            className="mb-5 rounded-xl border border-amber-200/70 bg-amber-50/70 px-4 py-2.5 text-xs text-amber-950"
            role="status"
          >
            <span className="font-semibold">Hierarchie týmu není kompletní.</span>{" "}
            Vazby nadřízenosti zatím chybí — rozsah „Můj tým“ zobrazí jen vás.
            <a href={teamManagementHref} className="underline hover:text-amber-800">
              Doplňte ve Správě týmu níže
            </a>
            .
          </div>
        ) : null}

        <div className="xl:grid xl:grid-cols-1 xl:gap-8 xl:grid-cols-[minmax(0,1fr)_min(100%,380px)] xl:items-start">
        <div className="min-w-0">

        <TeamOverviewBriefing briefing={pageModel.briefing} kpis={kpis} scope={scope} loading={loading} />

        <TeamOverviewAttentionSection
          scope={scope}
          members={members}
          displayName={displayName}
          topAttentionAlerts={topAttentionAlerts}
          pageModel={pageModel}
          selectMember={selectMember}
          canCreateTeamCalendar={canCreateTeamCalendar}
        />

        <TeamOverviewCareerSummarySection
          members={members}
          pageModel={pageModel}
          displayName={displayName}
          selectMember={selectMember}
        />

        <TeamManagementPanel
          currentUserId={currentUserId}
          currentUserEmail={currentUserEmail}
          currentUserFullName={currentUserFullName}
          roleName={currentRole}
        />

        {members.length > 0 ? <TeamOverviewPoolSplitSection kpis={kpis} pageModel={pageModel} /> : null}

        {members.length > 0 ? (
          <TeamOverviewAdaptationSection
            members={members}
            newcomers={newcomers}
            displayName={displayName}
            memberDetailHref={memberDetailHref}
            selectMember={selectMember}
          />
        ) : null}

        <TeamStructurePanel
          roots={hierarchy}
          currentUserId={currentUserId}
          scope={scope}
          memberDetailQuery={`?${new URLSearchParams({ period, scope }).toString()}`}
          hierarchyParentLinksConfigured={kpis?.hierarchyParentLinksConfigured !== false}
          selectedUserId={selectedUserId}
          onSelectMember={selectMember}
        />

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

        <TeamOverviewMembersTable
          scope={scope}
          visibleMembers={visibleMembers}
          membersInScopeCount={members.length}
          metricsByUser={metricsByUser}
          selectedUserId={selectedUserId}
          selectMember={selectMember}
          memberDetailHref={memberDetailHref}
          displayName={displayName}
        />

        <TeamOverviewKpiDetailSection
          loading={loading}
          kpis={kpis}
          members={members}
          topMetric={topMetric}
          bottomMetric={bottomMetric}
        />

        <TeamOverviewPerformanceTrendSection performanceOverTime={performanceOverTime} />

        <TeamOverviewAiTeamSummarySection
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

        <TeamOverviewFullAlertsSection alerts={alerts} selectMember={selectMember} memberDetailHref={memberDetailHref} />

        </div>
        <TeamOverviewSelectedMemberPanel
          detail={selectedDetail}
          loading={detailLoading}
          fullDetailHref={selectedUserId ? memberDetailHref(selectedUserId) : "#"}
          onClose={() => selectMember(null)}
          canCreateTeamCalendar={canCreateTeamCalendar}
          canEditTeamCareer={canEditTeamCareer}
          outsideFilter={selectedOutsideFilter}
        />
      </div>

      </div>
    </div>
  );
}
