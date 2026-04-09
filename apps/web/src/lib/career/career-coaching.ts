/**
 * Manažerský coaching a mapování career state → doporučená akce (bez workflow enginu).
 */

import type { CareerEvaluationViewModel } from "./career-evaluation-vm";
import type { CareerTrackId } from "./types";

export type CareerRecommendedActionKind =
  | "adaptation_checkin"
  | "one_on_one"
  | "data_completion"
  | "performance_coaching"
  | "team_meeting_followup"
  | "monitor_only";

export type CoachingMetricsSlice = {
  meetingsThisPeriod: number;
  unitsThisPeriod: number;
  activityCount: number;
  daysWithoutActivity: number;
  directReportsCount: number;
};

export type CoachingAdaptationSlice = {
  adaptationStatus: string;
  daysInTeam: number;
  adaptationScore: number;
  warnings: string[];
  /** Neúplné kroky adaptace (popisky) */
  incompleteChecklistLabels: string[];
};

export type OneOnOneAgendaItem = {
  text: string;
  category: "evidenced" | "crm_signal" | "manual";
};

export type CareerCoachingPackage = {
  recommendedActionKind: CareerRecommendedActionKind;
  /** Krátký manažerský popis doporučené akce */
  recommendedActionLabelCs: string;
  /** Proč je člověk v pozornosti / co řešit */
  coachingFocusBullets: string[];
  /** Jedna věta: další doporučený krok */
  suggestedNextStepLine: string;
  /** Sloučení adaptace + startovní pozice, nebo null */
  adaptationGrowthLine: string | null;
  oneOnOneAgenda: OneOnOneAgendaItem[];
  /** Co udělat po rozhovoru */
  followUpSuggestion: string;
  /** Předvyplnění pro createTeamEvent / createTeamTask */
  cta: {
    eventTitlePresets: string[];
    taskTitlePresets: string[];
    notesPreset: string;
  };
};

export type TeamCoachingAttentionItem = {
  userId: string;
  displayName: string | null;
  email: string | null;
  reasonCs: string;
  recommendedActionKind: CareerRecommendedActionKind;
  recommendedActionLabelCs: string;
};

const ACTION_LABELS: Record<CareerRecommendedActionKind, string> = {
  adaptation_checkin: "Adaptační check-in",
  one_on_one: "Osobní 1:1",
  data_completion: "Doplnit kariérní zařazení",
  performance_coaching: "Koučink výkonu a návyků",
  team_meeting_followup: "Týmová porada / společný follow-up",
  monitor_only: "Pouze sledovat a chválit průběh",
};

export function recommendedActionLabel(kind: CareerRecommendedActionKind): string {
  return ACTION_LABELS[kind];
}

function isStarterPosition(vm: CareerEvaluationViewModel): boolean {
  return vm.progressionOrder !== null && vm.progressionOrder <= 0;
}

function inActiveAdaptation(a: CoachingAdaptationSlice | null): boolean {
  if (!a) return false;
  return (
    a.adaptationStatus === "V adaptaci" ||
    a.adaptationStatus === "Rizikový" ||
    a.adaptationStatus === "Začíná"
  );
}

function weakIndividualActivity(m: CoachingMetricsSlice | null): boolean {
  if (!m) return false;
  return (
    m.meetingsThisPeriod === 0 &&
    m.unitsThisPeriod === 0 &&
    (m.activityCount < 3 || m.daysWithoutActivity >= 7)
  );
}

/**
 * Lehké mapování stavu na typ akce — centrální místo pro úpravy.
 */
export function deriveRecommendedCareerAction(input: {
  vm: CareerEvaluationViewModel;
  metrics: CoachingMetricsSlice | null;
  adaptation: CoachingAdaptationSlice | null;
}): { kind: CareerRecommendedActionKind; labelCs: string } {
  const { vm, metrics, adaptation } = input;
  const track = vm.careerTrackId;

  if (vm.careerProgramId === "not_set" || vm.progressEvaluation === "not_configured") {
    return { kind: "data_completion", labelCs: ACTION_LABELS.data_completion };
  }
  if (vm.progressEvaluation === "data_missing" || vm.progressEvaluation === "blocked") {
    return { kind: "data_completion", labelCs: ACTION_LABELS.data_completion };
  }
  if (track === "unknown" || vm.progressEvaluation === "unknown") {
    return { kind: "data_completion", labelCs: "Ověřit a doplnit zařazení" };
  }

  if (inActiveAdaptation(adaptation) && (isStarterPosition(vm) || weakIndividualActivity(metrics) || adaptation!.warnings.length > 0)) {
    return { kind: "adaptation_checkin", labelCs: ACTION_LABELS.adaptation_checkin };
  }

  if (track === "management_structure" && metrics && metrics.directReportsCount === 0) {
    return { kind: "one_on_one", labelCs: ACTION_LABELS.one_on_one };
  }

  if (track === "individual_performance" && weakIndividualActivity(metrics) && vm.progressEvaluation === "on_track") {
    return { kind: "performance_coaching", labelCs: ACTION_LABELS.performance_coaching };
  }

  if (vm.evaluationCompleteness === "manual_required" || vm.evaluationCompleteness === "low_confidence") {
    return { kind: "one_on_one", labelCs: ACTION_LABELS.one_on_one };
  }

  if (track === "reality") {
    return { kind: "one_on_one", labelCs: "Projít realitní zařazení a podmínky (bez auto-splnění)" };
  }

  if (vm.progressEvaluation === "on_track" && vm.evaluationCompleteness === "full") {
    return { kind: "monitor_only", labelCs: ACTION_LABELS.monitor_only };
  }

  if (vm.progressEvaluation === "on_track") {
    return { kind: "one_on_one", labelCs: ACTION_LABELS.one_on_one };
  }

  return { kind: "team_meeting_followup", labelCs: ACTION_LABELS.team_meeting_followup };
}

function trackCoachingBullets(track: CareerTrackId, vm: CareerEvaluationViewModel): string[] {
  const out: string[] = [];
  switch (track) {
    case "individual_performance":
      out.push("Diskutujte tempo schůzek, zápis v CRM a návyky — neinterpretujte to jako splnění BJ z řádu.");
      if (vm.nextCareerPositionLabel) {
        out.push(`Kontext dalšího kroku ve větvi: ${vm.nextCareerPositionLabel} — vždy ověřte podmínky v PDF / HR.`);
      }
      break;
    case "management_structure":
      out.push("Zaměřte se na přímé podřízené v CRM, pravidelnost 1:1 s týmem a rozvoj lidí — struktura v aplikaci nemusí odpovídat realitě.");
      out.push("Ověřte, zda má smysl upravit hierarchii nebo doplnit kariérní kódy u podřízených.");
      break;
    case "reality":
      out.push("U realitní větve buďte obezřetní: CRM metriky nemusí odrážet realitní podíly a podmínky z řádu.");
      out.push("Domluvte si ruční kontrolu kritérií z interní dokumentace — bez automatického „postup hotov“.");
      break;
    case "call_center":
      out.push("U call centra zkontrolujte kombinaci výkonu a případných týmových pravidel v konfiguraci.");
      break;
    default:
      out.push("Nejdřív sjednoťte program, větev a pozici v Nastavení → Tým, pak teprve plánujte rozvojové kroky.");
  }
  return out;
}

export function buildCareerCoachingPackage(
  vm: CareerEvaluationViewModel,
  metrics: CoachingMetricsSlice | null,
  adaptation: CoachingAdaptationSlice | null,
  alertTitles: string[]
): CareerCoachingPackage {
  const { kind, labelCs } = deriveRecommendedCareerAction({ vm, metrics, adaptation });

  const coachingFocusBullets: string[] = [];

  coachingFocusBullets.push(
    `Doporučený typ podpory: ${labelCs} — jde o orientační návrh, ne hodnocení člověka.`
  );

  if (adaptation && inActiveAdaptation(adaptation)) {
    coachingFocusBullets.push(
      `Adaptace: „${adaptation.adaptationStatus}“ (${adaptation.adaptationScore} % checklistu) — propojte s rozjezdem v roli, ne jako trest.`
    );
  }

  coachingFocusBullets.push(...trackCoachingBullets(vm.careerTrackId, vm));

  if (alertTitles.length > 0) {
    coachingFocusBullets.push(`Signály z přehledu: ${alertTitles.slice(0, 3).join(" · ")}.`);
  }

  let adaptationGrowthLine: string | null = null;
  if (adaptation && inActiveAdaptation(adaptation)) {
    const pos = vm.careerPositionLabel ?? "pozice doplnit";
    adaptationGrowthLine = `V adaptaci · ${adaptation.adaptationStatus} · evidovaná pozice: ${pos}${isStarterPosition(vm) ? " (start ve větvi)" : ""}`;
  } else if (isStarterPosition(vm) && vm.careerPositionLabel) {
    adaptationGrowthLine = `Startovní krok ve větvi: ${vm.careerPositionLabel} — zkontrolujte rozjezd a očekávání.`;
  }

  const oneOnOneAgenda: OneOnOneAgendaItem[] = [];

  oneOnOneAgenda.push({
    category: "evidenced",
    text: `Aktuální zařazení: ${vm.summaryLine ?? `${vm.careerProgramId} / ${vm.careerTrackId}`}`,
  });
  if (vm.nextCareerPositionLabel) {
    oneOnOneAgenda.push({
      category: "evidenced",
      text: `Další krok ve větvi (konfigurace): ${vm.nextCareerPositionLabel} — podmínky z řádu jen ručně.`,
    });
  }
  if (vm.missingRequirements.length > 0) {
    oneOnOneAgenda.push({
      category: "manual",
      text: `Co je potřeba ověřit / doplnit: ${vm.missingRequirements
        .slice(0, 3)
        .map((r) => r.labelCs)
        .join("; ")}`,
    });
  }
  if (metrics) {
    oneOnOneAgenda.push({
      category: "crm_signal",
      text: `CRM (období): schůzky ${metrics.meetingsThisPeriod}, jednotky ${metrics.unitsThisPeriod}, aktivita ${metrics.activityCount}, dní bez aktivity ${metrics.daysWithoutActivity} — orientační signály.`,
    });
  }
  if (adaptation && adaptation.incompleteChecklistLabels.length > 0) {
    oneOnOneAgenda.push({
      category: "crm_signal",
      text: `Adaptace — chybí: ${adaptation.incompleteChecklistLabels.join(", ")}.`,
    });
  }
  oneOnOneAgenda.push({
    category: "manual",
    text: "Domluvte se na jedné konkrétní akci do příštího setkání (např. X schůzek, doplnění údajů, check-in s nadřízeným).",
  });

  let suggestedNextStepLine: string;
  switch (kind) {
    case "adaptation_checkin":
      suggestedNextStepLine = "Navrhněte krátký adaptační check-in a společně vyberte jeden nejbližší krok v CRM.";
      break;
    case "data_completion":
      suggestedNextStepLine = "Nejdřív doplňte nebo opravte kariérní zařazení v Nastavení → Tým, pak naplánujte 1:1 k cílům.";
      break;
    case "performance_coaching":
      suggestedNextStepLine = "Projděte návyky práce v CRM a plán schůzek — podpůrně, bez tlaku na „výkonové trestání“.";
      break;
    case "monitor_only":
      suggestedNextStepLine = "Pokračujte v pravidelném kontaktu; pochvalte stabilní práci a nechte prostor pro vlastní nápady.";
      break;
    case "team_meeting_followup":
      suggestedNextStepLine = "Domluvte týmový kontext nebo společný follow-up, pokud jde o strukturu nebo sdílené téma.";
      break;
    default:
      suggestedNextStepLine = "Naplánujte 1:1 zaměřené na jasné očekávání, podporu a případné doplnění údajů.";
  }

  const followUpSuggestion =
    kind === "data_completion"
      ? "Po doplnění údajů: krátká kontrola v Team Overview, zda sedí program / větev / pozice."
      : kind === "adaptation_checkin"
        ? "Po check-inu: jeden úkol nebo schůzka v CRM jako follow-up (zapsat do úkolů)."
        : "Po 1:1: jedna věta shrnutí do poznámky nebo lehký úkol, ať zůstane závazek konkrétní.";

  const nameHint = "člena týmu";
  const cta = {
    eventTitlePresets:
      kind === "adaptation_checkin"
        ? ["Adaptační check-in", `1:1 — adaptace a rozjezd (${nameHint})`]
        : kind === "performance_coaching"
          ? ["1:1 — návyky a výkon v CRM", "Koučink — plán schůzek"]
          : kind === "data_completion"
            ? ["1:1 — doplnění kariérního zařazení", "Shrnutí kariérního zařazení"]
            : ["1:1 — kariérní progres", "Follow-up k rozvoji"],
    taskTitlePresets:
      kind === "adaptation_checkin"
        ? ["Follow-up po adaptačním check-inu", "Doplnit první schůzky v CRM"]
        : ["Follow-up k 1:1 (kariéra)", "Ověřit údaje v Nastavení → Tým"],
    notesPreset: [
      vm.summaryLine ? `Kariéra: ${vm.summaryLine}` : "",
      vm.nextCareerPositionLabel ? `Další krok (config): ${vm.nextCareerPositionLabel}` : "",
      "Orientační coaching z Aidvisora — ne oficiální HR zápis.",
    ]
      .filter(Boolean)
      .join("\n"),
  };

  return {
    recommendedActionKind: kind,
    recommendedActionLabelCs: labelCs,
    coachingFocusBullets: coachingFocusBullets.slice(0, 8),
    suggestedNextStepLine,
    adaptationGrowthLine,
    oneOnOneAgenda,
    followUpSuggestion,
    cta,
  };
}

function attentionScore(input: {
  vm: CareerEvaluationViewModel;
  metrics: CoachingMetricsSlice | null;
  adaptation: CoachingAdaptationSlice | null;
}): number {
  let s = 0;
  const { vm, metrics, adaptation } = input;
  if (vm.progressEvaluation === "data_missing" || vm.progressEvaluation === "not_configured") s += 10;
  if (vm.progressEvaluation === "blocked" || vm.progressEvaluation === "unknown") s += 8;
  if (vm.evaluationCompleteness === "low_confidence") s += 5;
  if (inActiveAdaptation(adaptation) && (adaptation!.adaptationStatus === "Rizikový" || adaptation!.warnings.length > 0)) s += 9;
  if (vm.careerTrackId === "management_structure" && metrics && metrics.directReportsCount === 0) s += 7;
  if (vm.careerTrackId === "individual_performance" && weakIndividualActivity(metrics)) s += 6;
  if (vm.evaluationCompleteness === "manual_required") s += 3;
  return s;
}

export function buildTeamCoachingAttentionList(
  rows: Array<{
    userId: string;
    displayName: string | null;
    email: string | null;
    careerEvaluation: CareerEvaluationViewModel;
    metrics: CoachingMetricsSlice | null;
    adaptation: CoachingAdaptationSlice | null;
  }>,
  limit = 5
): TeamCoachingAttentionItem[] {
  const scored = rows.map((r) => {
    const sc = attentionScore({ vm: r.careerEvaluation, metrics: r.metrics, adaptation: r.adaptation });
    const { kind, labelCs } = deriveRecommendedCareerAction({
      vm: r.careerEvaluation,
      metrics: r.metrics,
      adaptation: r.adaptation,
    });
    let reasonCs = "";
    if (r.adaptation && inActiveAdaptation(r.adaptation) && (r.adaptation.warnings.length > 0 || r.adaptation.adaptationStatus === "Rizikový")) {
      reasonCs = `Adaptace (${r.adaptation.adaptationStatus})`;
    } else if (r.careerEvaluation.progressEvaluation === "data_missing" || r.careerEvaluation.progressEvaluation === "not_configured") {
      reasonCs = "Chybí nebo nejsou konzistentní kariérní údaje";
    } else if (r.careerEvaluation.careerTrackId === "management_structure" && r.metrics && r.metrics.directReportsCount === 0) {
      reasonCs = "Manažerská větev bez přímých v CRM";
    } else if (r.careerEvaluation.careerTrackId === "individual_performance" && weakIndividualActivity(r.metrics)) {
      reasonCs = "Individuální větev se slabým CRM signálem v období";
    } else if (r.careerEvaluation.evaluationCompleteness === "low_confidence") {
      reasonCs = "Evaluace s nízkou jistotou — doplnit údaje";
    } else {
      reasonCs = "Kombinace stavu kariéry a signálů vyžaduje krátký kontakt";
    }
    return {
      userId: r.userId,
      displayName: r.displayName,
      email: r.email,
      reasonCs,
      recommendedActionKind: kind,
      recommendedActionLabelCs: labelCs,
      _score: sc,
    };
  });

  scored.sort((a, b) => b._score - a._score);
  return scored
    .filter((x) => x._score >= 4)
    .slice(0, limit)
    .map(({ _score, ...rest }) => rest);
}
