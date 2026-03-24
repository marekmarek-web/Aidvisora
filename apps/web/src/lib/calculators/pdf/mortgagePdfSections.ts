import { PRODUCT_TYPES } from "../mortgage/mortgage.config";
import { getCalculatedLtv } from "../mortgage/mortgage.engine";
import type { BankOffer, MortgageResult, MortgageState } from "../mortgage/mortgage.types";
import { formatCurrencyCs, formatPercentCs } from "./format";
import type { CalculatorPdfSection } from "./types";

function subtypeLabel(state: MortgageState): string {
  if (state.product === "mortgage") {
    return PRODUCT_TYPES.mortgage.find((s) => s.id === state.mortgageType)?.label ?? state.mortgageType;
  }
  return PRODUCT_TYPES.loan.find((s) => s.id === state.loanType)?.label ?? state.loanType;
}

function modeLabel(type: MortgageState["type"]): string {
  return type === "new" ? "Nový úvěr / hypotéka" : "Refinancování";
}

export interface MortgageRatesMeta {
  fetchedAt?: string;
  source?: string;
  sourceUrl?: string;
}

export function buildMortgagePdfSections(
  state: MortgageState,
  result: MortgageResult,
  offers: BankOffer[],
  ratesMeta?: MortgageRatesMeta | null
): CalculatorPdfSection[] {
  const sections: CalculatorPdfSection[] = [];
  const calcLtv = getCalculatedLtv(state);

  const inputs: CalculatorPdfSection = {
    title: "Vstupy",
    rows: [
      { label: "Produkt", value: state.product === "mortgage" ? "Hypotéka" : "Úvěr" },
      { label: "Podtyp", value: subtypeLabel(state) },
      { label: "Režim", value: modeLabel(state.type) },
      { label: "Cílová jistina / částka úvěru", value: formatCurrencyCs(state.loan) },
      { label: "Vlastní zdroje / akontace", value: formatCurrencyCs(state.own) },
      ...(state.product === "loan" && state.loanType === "consolidation"
        ? [{ label: "Extra částka (konsolidace)", value: formatCurrencyCs(state.extra) }]
        : []),
      { label: "Splatnost", value: `${state.term} let` },
      ...(state.product === "mortgage"
        ? [{ label: "Fixace", value: `${state.fix} let` }]
        : []),
      { label: "Vypočtené LTV / akontace", value: `${calcLtv} %` },
      ...(state.ltvLock != null ? [{ label: "Předvolba LTV (tlačítko)", value: `${state.ltvLock} %` }] : []),
    ],
  };
  sections.push(inputs);

  sections.push({
    title: "Výsledek (modelový)",
    rows: [
      { label: "Měsíční splátka", value: formatCurrencyCs(Math.round(result.monthlyPayment)) },
      { label: "Úroková sazba (model)", value: formatPercentCs(result.finalRate) },
      { label: "Celkem zaplaceno (jistina + úrok)", value: formatCurrencyCs(Math.round(result.totalPaid)) },
      { label: "Čerpaná jistina", value: formatCurrencyCs(Math.round(result.borrowingAmount)) },
      ...(result.showLtvRow
        ? [{ label: result.ltvLabel, value: `${Math.round(result.displayLtv)} %` }]
        : []),
      { label: "Hodnota nemovitosti (odhad)", value: formatCurrencyCs(Math.round(result.propertyValue)) },
    ],
  });

  if (offers.length > 0) {
    sections.push({
      title: "Orientační srovnání bank",
      rows: offers.map((o) => ({
        label: o.bank.name,
        value: `sazba ${formatPercentCs(o.rate)} · splátka ${formatCurrencyCs(Math.round(o.monthlyPayment))}`,
      })),
    });
  }

  const metaRows: { label: string; value: string }[] = [];
  if (ratesMeta?.fetchedAt) {
    metaRows.push({ label: "Sazby aktualizovány", value: ratesMeta.fetchedAt });
  }
  if (ratesMeta?.source) {
    metaRows.push({ label: "Zdroj dat", value: ratesMeta.source });
  }
  if (ratesMeta?.sourceUrl) {
    metaRows.push({ label: "URL zdroje", value: ratesMeta.sourceUrl });
  }
  if (metaRows.length > 0) {
    sections.push({ title: "Metadata sazeb", rows: metaRows });
  }

  return sections;
}
