"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import type {
  TeamOverviewKpis,
  TeamMemberInfo,
  NewcomerAdaptation,
  TeamOverviewPeriod,
  TeamRhythmCalendarData,
  TeamMemberDetail,
  TeamPerformancePoint,
} from "@/app/actions/team-overview";
import type { TeamMemberMetrics, TeamAlert } from "@/lib/team-overview-alerts";
import type { TeamOverviewScope, TeamTreeNode } from "@/lib/team-hierarchy-types";
import {
  getTeamOverviewPageSnapshot,
  getTeamMemberDetail,
} from "@/app/actions/team-overview";
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
import { TeamOverviewPerformanceTrendSection } from "./components/TeamOverviewPerformanceTrendSection";
import { TeamOverviewCareerSummarySection } from "./components/TeamOverviewCareerSummarySection";
import { TeamOverviewAdaptationSection } from "./components/TeamOverviewAdaptationSection";
import { TeamOverviewPeopleFiltersBar } from "./components/TeamOverviewPeopleFiltersBar";
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
  /** Jednotky po obdobích pro cockpit trend (CRM). */
  initialPerformanceOverTime?: TeamPerformancePoint[];
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
  initialPerformanceOverTime = [],
  initialRhythmCalendar = null,
  defaultPeriod,
  canCreateTeamCalendar = false,
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
  const [hierarchy, setHierarchy] = useState<TeamTreeNode[]>(initialHierarchy);
  const [peopleSegment, setPeopleSegment] = useState<PeopleSegmentFilter>("all");
  const [performanceFilter, setPerformanceFilter] = useState<"all" | "top" | "bottom">("all");
  const [peopleSearch, setPeopleSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(initialSelectedMemberId);
  const [selectedDetail, setSelectedDetail] = useState<TeamMemberDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [teamCalendarModal, setTeamCalendarModal] = useState<"event" | "task" | null>(null);
  const [calendarPrefill, setCalendarPrefill] = useState<TeamCalendarModalPrefill | null>(null);
  const [rhythmCalendar, setRhythmCalendar] = useState<TeamRhythmCalendarData | null>(initialRhythmCalendar ?? null);
  const [performanceOverTime, setPerformanceOverTime] = useState<TeamPerformancePoint[]>(
    initialPerformanceOverTime,
  );
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
      setHierarchy(snap.hierarchy);
      setRhythmCalendar(snap.rhythmCalendar);
      setPerformanceOverTime(snap.performanceOverTime);
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

  const peopleLideTab = (
    <div className="rounded-[32px] border border-slate-200/80 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)] md:p-6">
      {selectedUserId ? (
        <div className="mb-6 rounded-[24px] border border-slate-200/80 bg-slate-50/70 px-5 py-4">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500">
            Vybraný člen
          </p>
          <div className="mt-2 flex items-center justify-between gap-4">
            <div>
              <p className="text-[18px] font-black tracking-tight text-slate-950">
                {members.find((member) => member.userId === selectedUserId)?.displayName ?? "Člen týmu"}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Detail je otevřený v pravém tmavém panelu.
              </p>
            </div>
            <button
              type="button"
              onClick={() => selectMember(null)}
              className="rounded-[14px] border border-slate-200 bg-white px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-700 transition hover:bg-slate-50"
            >
              Zrušit výběr
            </button>
          </div>
        </div>
      ) : null}
      <div>
        {peopleFiltersInner}
        {visibleMembers.length > 0 ? (
          <div className="mt-6 overflow-x-auto rounded-[24px] border border-slate-200/80 bg-white">
            <table className="w-full min-w-[860px] border-separate border-spacing-y-0 text-left text-sm">
              <thead className="sticky top-0 z-10 bg-white text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400">
                <tr>
                  <th className="border-b border-slate-200/80 px-6 py-4">Jméno a role</th>
                  <th className="border-b border-slate-200/80 px-6 py-4">Program / track / pozice</th>
                  <th className="border-b border-slate-200/80 px-6 py-4">Produkce + skupina</th>
                  <th className="border-b border-slate-200/80 px-6 py-4">Status</th>
                  <th className="border-b border-slate-200/80 px-6 py-4 text-right">Akce</th>
                </tr>
              </thead>
              <tbody>
                {visibleMembers.map((mem) => {
                  const mm = metricsByUser.get(mem.userId);
                  const ce = mm?.careerEvaluation;
                  return (
                    <tr
                      key={mem.userId}
                      className="cursor-pointer transition hover:bg-slate-50/70"
                      onClick={() => selectMember(mem.userId)}
                    >
                      <td className="border-b border-slate-100 px-6 py-5">
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-slate-100 text-sm font-black text-slate-700">
                            {displayName(mem).slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-extrabold text-[15px] text-slate-950">{displayName(mem)}</div>
                            <div className="mt-0.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
                              {mem.roleName}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="border-b border-slate-100 px-6 py-5">
                        <div className="text-xs font-bold text-slate-800">
                          {ce ? formatCareerProgramLabel(ce.careerProgramId) : "—"}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          {ce ? formatCareerTrackLabel(ce.careerTrackId) : "—"} · {ce?.careerPositionLabel ?? "—"}
                        </div>
                      </td>
                      <td className="border-b border-slate-100 px-6 py-5">
                        <div className="font-black text-slate-950">
                          {mm ? formatTeamOverviewProduction(mm.productionThisPeriod) : "—"}
                        </div>
                        <div className="mt-1 text-[11px] font-semibold text-slate-500">
                          {ce ? poolColumnLabel(ce.careerProgramId) : "—"} · Jednotky: {mm != null ? mm.unitsThisPeriod : "—"}
                        </div>
                      </td>
                      <td className="border-b border-slate-100 px-6 py-5">
                        <span className="inline-flex rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-700">
                          {ce?.managerProgressLabel ?? "—"}
                        </span>
                      </td>
                      <td className="border-b border-slate-100 px-6 py-5 text-right">
                        <div className="flex flex-col items-end gap-2 sm:flex-row sm:justify-end">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openMemberModal("progress", mem.userId);
                              selectMember(mem.userId);
                            }}
                            className="rounded-[12px] bg-slate-100 px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#16192b] transition hover:bg-slate-200"
                          >
                            Strom progresu
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openMemberModal("crm", mem.userId);
                              selectMember(mem.userId);
                            }}
                            className="rounded-[12px] border border-slate-200 bg-white px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#16192b] transition hover:bg-slate-50"
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
    </div>
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
    <div className="space-y-4">
      <TeamOverviewPremiumBriefingDark
        periodLabel={periodLabelActive}
        scopeLabel={scopeLabelActive}
        stats={briefingStats}
        priorityItems={priorityItems}
      />
      <TeamOverviewCockpitFourCards kpis={kpis} inProductionCount={inProductionCount} loading={loading} />
      <TeamOverviewPerformanceTrendSection performanceOverTime={performanceOverTime} />
      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
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
      </div>
    </div>
  );

  const careerOnly = (
    <>
      <div className="mb-4 rounded-[32px] border border-slate-200/80 bg-white px-6 py-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-500">Career plan</p>
        <h2 className="mt-2 text-[26px] font-black tracking-tight text-slate-950">Kariérní plán</h2>
        <p className="mt-2 text-sm text-slate-600">
          {periodLabelActive} · {scopeLabelActive} · Beplan {pageModel.poolSplit.counts.beplan} lidí /{" "}
          {pageModel.poolSplit.units.beplan} j. · Premium Brokers {pageModel.poolSplit.counts.premium_brokers} lidí /{" "}
          {pageModel.poolSplit.units.premium_brokers} j.
        </p>
      </div>
      <div>
        <TeamOverviewCareerSummarySection
          members={members}
          metrics={metrics}
          pageModel={pageModel}
          displayName={displayName}
          selectMember={selectMember}
          onOpenCrm={(uid) => openMemberModal("crm", uid)}
          onOpenProgress={(uid) => openMemberModal("progress", uid)}
        />
      </div>
    </>
  );

  const adaptationOnly = (
    <>
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
        title="Týmový přehled"
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
            onOpenTask={
              selectedUserId
                ? () => {
                    const m = members.find((x) => x.userId === selectedUserId);
                    setCalendarPrefill({
                      title: `Follow-up — ${m ? displayName(m) : "člen"}`,
                      memberUserIds: [selectedUserId],
                    });
                    setTeamCalendarModal("task");
                  }
                : undefined
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
