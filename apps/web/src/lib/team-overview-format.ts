/**
 * Jednotné formátování čísel a copy pro pool / BJ vs BJS v Team Overview.
 * Komponenty nemají duplikovat řetězce — importují odtud.
 */

import type { CareerProgramId } from "@/lib/career/types";
import { CAREER_PROGRAM_LABELS } from "@/lib/career/types";
import { crmUnitsFootnoteForProgram } from "@/lib/career/crm-units-copy";

export function formatTeamOverviewProduction(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString("cs-CZ");
}

/** Sloupec „Jednotky“ v tabulce — jednotný podtitulek (CRM ≠ BJ/BJS z řádu). */
export const TEAM_OVERVIEW_UNITS_COLUMN_SUBTITLE = "CRM · ne BJ/BJS";

/** Dlouhá poznámka podle kariérního programu (detail, tooltip). */
export { crmUnitsFootnoteForProgram };

/** Krátká poznámka u pool karty — Beplan vs Premium Brokers, konzistentní s crm-units-copy. */
export function poolCardUnitsFootnote(program: "beplan" | "premium_brokers"): string {
  return program === "beplan"
    ? "Nejedná se o BJ z kariérního řádu — jen součet jednotek u členů s programem Beplan."
    : "Nejedná se o BJS z kariérního řádu — jen součet jednotek u členů s programem Premium Brokers.";
}

export function poolProgramLabel(program: "beplan" | "premium_brokers"): string {
  return CAREER_PROGRAM_LABELS[program];
}

/** Formát řádku „Jednotky (období, CRM)“ pro pool split. */
export function poolUnitsLineLabel(periodLabel: string): string {
  return `Jednotky (${periodLabel}, CRM)`;
}

/** Alias pro metriky — stejné pravidlo jako produkce. */
export const formatTeamOverviewMetricNumber = formatTeamOverviewProduction;

export function careerProgramFootnoteForDetail(programId: CareerProgramId): string {
  return crmUnitsFootnoteForProgram(programId);
}
