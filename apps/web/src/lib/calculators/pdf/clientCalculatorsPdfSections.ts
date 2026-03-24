import { formatCurrencyCs } from "./format";
import type { CalculatorPdfSection } from "./types";

export function buildClientHypoPdfSections(params: {
  amount: number;
  years: number;
  ratePercent: number;
  monthlyPayment: number;
}): CalculatorPdfSection[] {
  return [
    {
      title: "Hypoteční kalkulačka (klientská)",
      rows: [
        { label: "Výše úvěru", value: formatCurrencyCs(params.amount) },
        { label: "Splatnost", value: `${params.years} let` },
        { label: "Úroková sazba", value: `${params.ratePercent.toLocaleString("cs-CZ")} %` },
        { label: "Orientační měsíční splátka", value: formatCurrencyCs(params.monthlyPayment) },
      ],
    },
  ];
}

export function buildClientInvestPdfSections(params: {
  deposit: number;
  monthly: number;
  years: number;
  futureValue: number;
}): CalculatorPdfSection[] {
  return [
    {
      title: "Investiční kalkulačka (klientská)",
      rows: [
        { label: "Počáteční vklad", value: formatCurrencyCs(params.deposit) },
        { label: "Měsíční vklad", value: formatCurrencyCs(params.monthly) },
        { label: "Horizont", value: `${params.years} let` },
        { label: "Model 7 % p.a. – předpokládaná hodnota", value: formatCurrencyCs(params.futureValue) },
      ],
    },
  ];
}
