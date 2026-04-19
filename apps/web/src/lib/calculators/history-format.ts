import type { CalculatorRunType } from "@/app/actions/calculator-runs";

const MONTHS_CS = [
  "ledna",
  "února",
  "března",
  "dubna",
  "května",
  "června",
  "července",
  "srpna",
  "září",
  "října",
  "listopadu",
  "prosince",
];

/**
 * Krátký popisek relativního času („před 2 hodinami“, „včera“, „10. března 2026“).
 * Orientační zobrazení pro historii propočtů.
 */
export function formatRelativeCs(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return "před chvílí";
  if (diffMin < 60) return `před ${diffMin} min.`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `před ${diffH} ${diffH === 1 ? "hodinou" : diffH < 5 ? "hodinami" : "hodinami"}`;
  const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((nowDate.getTime() - dayOnly.getTime()) / 86_400_000);
  if (days === 1) return "včera";
  if (days < 7) return `před ${days} dny`;
  return `${d.getDate()}. ${MONTHS_CS[d.getMonth()]} ${d.getFullYear()}`;
}

export function calculatorTypeLabelCs(t: CalculatorRunType | string): string {
  switch (t) {
    case "mortgage":
      return "Hypotéka";
    case "loan":
      return "Úvěr";
    case "investment":
      return "Investiční plán";
    case "pension":
      return "Penzijní odhad";
    case "life":
      return "Životní pojištění";
    default:
      return "Propočet";
  }
}

export function calculatorTypeRoute(t: CalculatorRunType | string): string {
  switch (t) {
    case "mortgage":
    case "loan":
      return "/portal/calculators/mortgage";
    case "investment":
      return "/portal/calculators/investment";
    case "pension":
      return "/portal/calculators/pension";
    case "life":
      return "/portal/calculators/life";
    default:
      return "/portal/calculators";
  }
}
