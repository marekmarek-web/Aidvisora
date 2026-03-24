import { formatCurrency } from "../investment/formatters";
import type { BacktestResult } from "../investment/investment.backtest";
import type { ProjectionResult } from "../investment/investment.engine";
import { formatCurrencyCs, formatPercentCs } from "./format";
import type { CalculatorPdfSection } from "./types";

export function buildInvestmentPdfSections(
  profileName: string,
  profileRatePercent: number,
  initial: number,
  monthly: number,
  years: number,
  projection: ProjectionResult,
  backtest?: { startYear: number; result: BacktestResult } | null
): CalculatorPdfSection[] {
  const sections: CalculatorPdfSection[] = [
    {
      title: "Vstupy",
      rows: [
        { label: "Strategie", value: profileName },
        { label: "Modelová výnosnost", value: formatPercentCs(profileRatePercent, 1) },
        { label: "Počáteční vklad", value: `${formatCurrency(Math.round(initial))} Kč` },
        { label: "Měsíční vklad", value: `${formatCurrency(Math.round(monthly))} Kč` },
        { label: "Horizont", value: `${years} let` },
      ],
    },
    {
      title: "Projekce",
      rows: [
        { label: "Předpokládaná konečná hodnota", value: `${formatCurrency(Math.round(projection.totalBalance))} Kč` },
        { label: "Celkem investováno", value: `${formatCurrency(Math.round(projection.totalInvested))} Kč` },
        { label: "Zisk z investice", value: `${formatCurrency(Math.round(projection.totalGain))} Kč` },
        { label: "Zhodnocení", value: formatPercentCs(projection.totalGainPercent, 1) },
      ],
    },
  ];

  if (backtest && backtest.result.sp500.length > 0) {
    const last = backtest.result.sp500[backtest.result.sp500.length - 1];
    const lastInvested = backtest.result.invested[backtest.result.invested.length - 1];
    sections.push({
      title: "Historická simulace (DCA)",
      rows: [
        { label: "Rok startu", value: String(backtest.startYear) },
        {
          label: "Naspořeno (vloženo) k poslednímu datu",
          value: lastInvested ? formatCurrencyCs(Math.round(lastInvested[1])) : "—",
        },
        {
          label: "Hodnota alokace S&P 500 (model)",
          value: formatCurrencyCs(Math.round(last[1])),
        },
      ],
    });
  }

  return sections;
}
