/**
 * Investment calculator – string constants, colors, IDs.
 * Source of truth: html/investicni.html (1:1 parity).
 */

export const CZECH_MONTHS = [
  "Leden",
  "Únor",
  "Březen",
  "Duben",
  "Květen",
  "Červen",
  "Červenec",
  "Srpen",
  "Září",
  "Říjen",
  "Listopad",
  "Prosinec",
] as const;

/** Brand colors used by the calculator UI (match HTML) */
export const INVESTMENT_COLORS = {
  brandDark: "#0a0f29",
  brandGold: "#fbbf24",
  brandLightGold: "#fde047",
  brandMain: "#0B3A7A",
  brandLight: "#EAF3FF",
  brandBorder: "#D6E6FF",
} as const;

/** Backtest chart series colors (match ApexCharts in HTML) */
export const BACKTEST_CHART_COLORS = [
  "#E0E0E0", // Vloženo celkem
  "#2E3A8C", // S&P 500
  "#F2C94C", // Zlato
  "#775DD0", // Dluhopisy
  "#00E396", // Nemovitostní fondy
] as const;
