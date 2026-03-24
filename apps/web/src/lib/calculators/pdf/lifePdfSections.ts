import type { LifeResult, LifeState } from "../life/life.types";
import { formatCurrencyCs } from "./format";
import type { CalculatorPdfSection } from "./types";

export function buildLifePdfSections(state: LifeState, result: LifeResult): CalculatorPdfSection[] {
  const maxChybi = result.chartData.reduce((m, r) => Math.max(m, r.chybi), 0);

  return [
    {
      title: "Vstupy",
      rows: [
        { label: "Věk", value: `${state.age} let` },
        { label: "Čistý měsíční příjem", value: formatCurrencyCs(state.netIncome) },
        { label: "Měsíční výdaje domácnosti", value: formatCurrencyCs(state.expenses) },
        { label: "Splátky a závazky (jistina)", value: formatCurrencyCs(state.liabilities) },
        { label: "Finanční rezerva", value: formatCurrencyCs(state.reserves) },
        { label: "Počet dětí", value: String(state.children) },
        { label: "Partner/ka v domácnosti", value: state.hasSpouse ? "Ano" : "Ne" },
      ],
    },
    {
      title: "Výsledky (orientační)",
      rows: [
        { label: "Krytí při úmrtí", value: formatCurrencyCs(result.deathCoverage) },
        { label: "Kapitál na invaliditu (D3)", value: formatCurrencyCs(result.capitalD3) },
        { label: "Denní potřeba PN (zaokrouhleno)", value: formatCurrencyCs(result.pnDailyNeed) },
        { label: "Trajné následky – základ", value: formatCurrencyCs(result.tnBase) },
        { label: "Trajné následky – progrese", value: formatCurrencyCs(result.tnProgression) },
        { label: "Mezera příjem vs. renta D3 (měsíčně)", value: formatCurrencyCs(result.gapD3Renta) },
        { label: "Nejvyšší měsíční mezera v grafu bilance", value: formatCurrencyCs(maxChybi) },
      ],
    },
  ];
}
