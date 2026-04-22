/**
 * Team Overview F5 — recommendation engine.
 *
 * Vstupem je TeamMemberMetrics (vč. sources map + memberKind) + adaptation status
 * + volitelne career coaching package. Výstupem je pole `Recommendation` s explainable
 * rationale. Engine je **pure** — pouze počítá nad vstupy; UI/drawer řeší F5 UI vrstva.
 *
 * Klíčová pravidla:
 * - external_manual členům neníkdy nepřiřazujeme CRM-based doporučení (irelevantní).
 * - Pokud ključové metriky mají source = "missing" nebo "manual_estimated", engine to
 *   reflektuje přes `data_completion` / `data_confirm` recommendation.
 * - Všechna doporučení nesou `explanation` (co data říkají) a `cta` (co učinít dalšího).
 */

import type { TeamMemberMetrics } from "@/lib/team-overview-alerts";

export type RecommendationKind =
  | "adaptation_checkin"
  | "one_on_one"
  | "data_completion"
  | "data_confirm"
  | "career_review"
  | "career_promote"
  | "production_dip"
  | "meeting_dip"
  | "celebrate_win"
  | "no_activity"
  | "hierarchy_gap";

export type RecommendationPriority = "critical" | "high" | "medium" | "low";

export type RecommendationOwner = "manager" | "director" | "admin" | "member_self";

export type RecommendationTiming = "today" | "this_week" | "this_month";

export type Recommendation = {
  /** Stabilní id — ukázání v UI pro dismiss / snooze. */
  id: string;
  memberUserId: string;
  memberTeamMemberId: string | null;
  kind: RecommendationKind;
  priority: RecommendationPriority;
  owner: RecommendationOwner;
  timing: RecommendationTiming;
  /** Krátký title (1 řádek) — pro card. */
  title: string;
  /** Jedna věta / výsledek; `co?`. */
  summary: string;
  /** Strukturovaný explain blok — drawer ukaže tyto řádky. */
  explanation: Array<{ label: string; value: string }>;
  /** Navrhované CTA — UI může zapnout deep-link / modal. */
  cta: { label: string; action: string; payload?: Record<string, unknown> };
};

export type RecommendationInput = {
  metric: TeamMemberMetrics;
  displayName: string | null;
  adaptationStatus?: string | null;
  /** Počet dní od joinedAt — užitečné pro adaptation windows. */
  daysSinceJoin?: number | null;
};

const PRIORITY_ORDER: Record<RecommendationPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function buildRecommendations(inputs: RecommendationInput[]): Recommendation[] {
  const all: Recommendation[] = [];
  for (const inp of inputs) {
    all.push(...buildForMember(inp));
  }
  return all.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}

function buildForMember(inp: RecommendationInput): Recommendation[] {
  const { metric, displayName, adaptationStatus, daysSinceJoin } = inp;
  const name = displayName ?? metric.userId;
  const out: Recommendation[] = [];

  const baseId = (suffix: string) => `${metric.userId}:${suffix}`;
  const member = { memberUserId: metric.userId, memberTeamMemberId: metric.teamMemberId };

  // 1) Externí člen bez manuálních dat — návrh vyplnit.
  if (metric.memberKind === "external_manual") {
    const missingKeys: string[] = [];
    for (const k of ["unitsThisPeriod", "productionThisPeriod", "meetingsThisPeriod", "closedDealsThisPeriod"] as const) {
      if (metric.sources[k] === "missing") missingKeys.push(k);
    }
    if (missingKeys.length > 0) {
      out.push({
        ...member,
        id: baseId("data_completion"),
        kind: "data_completion",
        priority: missingKeys.length >= 3 ? "high" : "medium",
        owner: "manager",
        timing: "this_week",
        title: `Doplňte produkci za aktuální období — ${name}`,
        summary: "Externí člen bez žádného záznamu za období. Bez dat nemůžeme hodnotit výkon.",
        explanation: [
          { label: "Typ člena", value: "Externí / manuální" },
          { label: "Chybějící KPI", value: missingKeys.join(", ") },
          { label: "Zdroj", value: "team_member_manual_periods (neexistuje)" },
        ],
        cta: { label: "Zadat měsíční data", action: "manual_period_upsert", payload: { teamMemberId: metric.teamMemberId } },
      });
    }
    // Pro externí většinou skáčneme dál — ostatní CRM pravidla neplatí.
    return out;
  }

  // 2) Odhadovaná data — potřeba potvrdit.
  const estimated: string[] = Object.entries(metric.sources)
    .filter(([, v]) => v === "manual_estimated")
    .map(([k]) => k);
  if (estimated.length > 0) {
    out.push({
      ...member,
      id: baseId("data_confirm"),
      kind: "data_confirm",
      priority: "low",
      owner: "manager",
      timing: "this_week",
      title: `Potvrďte odhadovaná čísla — ${name}`,
      summary: "Hodnoty jsou označené jako odhad; potvrďte / upravte před závěrkou období.",
      explanation: [
        { label: "Odhadované KPI", value: estimated.join(", ") },
        { label: "Zdroj", value: "team_member_manual_periods (confidence = manual_estimated)" },
      ],
      cta: { label: "Potvrdit období", action: "manual_period_confirm", payload: { teamMemberId: metric.teamMemberId } },
    });
  }

  // 3) Adaptation check-in (newcomer window)
  if (adaptationStatus && daysSinceJoin != null && daysSinceJoin <= 90) {
    const priority: RecommendationPriority = daysSinceJoin <= 30 ? "high" : daysSinceJoin <= 60 ? "medium" : "low";
    out.push({
      ...member,
      id: baseId("adaptation_checkin"),
      kind: "adaptation_checkin",
      priority,
      owner: "manager",
      timing: daysSinceJoin <= 30 ? "today" : "this_week",
      title: `Adaptační check-in — ${name} (D+${daysSinceJoin})`,
      summary: `Člen je v adaptaci: ${adaptationStatus}. Udržujte rytmus 30/60/90.`,
      explanation: [
        { label: "Dnů od nástupu", value: String(daysSinceJoin) },
        { label: "Adaptační status", value: adaptationStatus },
      ],
      cta: { label: "Otevřít adaptační kartu", action: "open_adaptation", payload: { userId: metric.userId } },
    });
  }

  // 4) No activity — critical if >=14 dní, high if >=7.
  if (metric.daysWithoutActivity >= 7) {
    const priority: RecommendationPriority = metric.daysWithoutActivity >= 14 ? "critical" : "high";
    out.push({
      ...member,
      id: baseId("no_activity"),
      kind: "no_activity",
      priority,
      owner: "manager",
      timing: priority === "critical" ? "today" : "this_week",
      title: `${metric.daysWithoutActivity} dní bez aktivity — ${name}`,
      summary: "Člen dlouho neeviduje nic v CRM. Dôvod může být běžný (dovolená), ale potvrďte.",
      explanation: [
        { label: "Dnů bez aktivity", value: String(metric.daysWithoutActivity) },
        { label: "Poslední aktivita", value: metric.lastActivityAt ? metric.lastActivityAt.toISOString().slice(0, 10) : "—" },
        { label: "Zdroj", value: "activity_log (auto)" },
      ],
      cta: { label: "Naplanovat 1:1", action: "schedule_1on1", payload: { userId: metric.userId } },
    });
  }

  // 5) Production dip
  if (metric.productionTrend <= -0.25 && metric.productionThisPeriod > 0) {
    out.push({
      ...member,
      id: baseId("production_dip"),
      kind: "production_dip",
      priority: metric.productionTrend <= -0.5 ? "high" : "medium",
      owner: "manager",
      timing: "this_week",
      title: `Pokles produkce — ${name} (${Math.round(metric.productionTrend * 100)} %)`,
      summary: "Produkce klesla oproti předchozímu období.",
      explanation: [
        { label: "Produkce (aktuální)", value: metric.productionThisPeriod.toLocaleString("cs-CZ") },
        { label: "Trend", value: `${Math.round(metric.productionTrend * 100)} %` },
        { label: "Zdroj", value: metric.sources.productionThisPeriod ?? "auto" },
      ],
      cta: { label: "Otevřít detail člena", action: "open_member", payload: { userId: metric.userId } },
    });
  }

  // 6) Meeting dip
  if (metric.daysSinceMeeting >= 14) {
    out.push({
      ...member,
      id: baseId("meeting_dip"),
      kind: "meeting_dip",
      priority: metric.daysSinceMeeting >= 21 ? "high" : "medium",
      owner: "manager",
      timing: "this_week",
      title: `${metric.daysSinceMeeting} dní bez schůzky — ${name}`,
      summary: "Dlouhá mezera ve schůzkách. Zjistěte, zda věč klientsky nevázne.",
      explanation: [
        { label: "Dnů od poslední schůzky", value: String(metric.daysSinceMeeting) },
        { label: "Schůzky (období)", value: String(metric.meetingsThisPeriod) },
      ],
      cta: { label: "Otevřít rytmus", action: "open_rhythm", payload: { userId: metric.userId } },
    });
  }

  // 7) Celebrate win — silný trend + target progress
  if (metric.productionTrend >= 0.3 && (metric.targetProgressPercent ?? 0) >= 80) {
    out.push({
      ...member,
      id: baseId("celebrate_win"),
      kind: "celebrate_win",
      priority: "low",
      owner: "manager",
      timing: "this_week",
      title: `Pochvalte výkon — ${name}`,
      summary: "Produkce roste a plnení cíle je na hraně / nad plánem. Uznaní zvyšuje motivaci.",
      explanation: [
        { label: "Produkční trend", value: `${Math.round(metric.productionTrend * 100)} %` },
        { label: "Plnění cíle", value: `${metric.targetProgressPercent ?? "?"} %` },
      ],
      cta: { label: "Poslat uznání", action: "send_kudos", payload: { userId: metric.userId } },
    });
  }

  // 8) Career review — trigger na základě career evaluation model completeness
  if (
    metric.careerEvaluation?.evaluationCompleteness === "low_confidence" ||
    metric.careerEvaluation?.evaluationCompleteness === "manual_required" ||
    metric.careerEvaluation?.progressEvaluation === "data_missing" ||
    metric.careerEvaluation?.progressEvaluation === "not_configured"
  ) {
    out.push({
      ...member,
      id: baseId("career_review"),
      kind: "career_review",
      priority: "medium",
      owner: "manager",
      timing: "this_month",
      title: `Kariérní revize — ${name}`,
      summary: "Kariérní evaluaci nelze spočítat: chybí vstupní data (program, pozice, KPI).",
      explanation: [
        { label: "Program", value: metric.careerEvaluation.careerProgramId ?? "not_set" },
        { label: "Pozice", value: metric.careerEvaluation.careerPositionLabel ?? "—" },
      ],
      cta: { label: "Otevřít kariéru", action: "open_career", payload: { userId: metric.userId } },
    });
  }
  if (
    metric.careerEvaluation?.progressEvaluation === "close_to_promotion" ||
    metric.careerEvaluation?.progressEvaluation === "promoted_ready"
  ) {
    out.push({
      ...member,
      id: baseId("career_promote"),
      kind: "career_promote",
      priority: "medium",
      owner: "director",
      timing: "this_month",
      title: `Zvážit posun pozice — ${name}`,
      summary: "Člen splňuje práh pro další kariérní pozici.",
      explanation: [
        { label: "Aktuální pozice", value: metric.careerEvaluation.careerPositionLabel ?? "—" },
        { label: "Doporučená další", value: metric.careerEvaluation.nextCareerPositionLabel ?? "—" },
        { label: "Progress", value: metric.careerEvaluation.progressEvaluation },
      ],
      cta: { label: "Otevřít kariéru", action: "open_career", payload: { userId: metric.userId } },
    });
  }

  return out;
}
