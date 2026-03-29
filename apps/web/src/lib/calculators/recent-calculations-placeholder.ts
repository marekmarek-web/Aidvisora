/**
 * Demo data for „Nedávné propočty“ until CRM persists calculator runs per contact.
 */

export type RecentCalculationPlaceholder = {
  id: string;
  client: string;
  type: string;
  date: string;
  href: string;
};

export const RECENT_CALCULATIONS_PLACEHOLDER: RecentCalculationPlaceholder[] = [
  { id: "1", client: "Rodina Novákova", type: "Hypotéka 4.5M", date: "Před 2 hodinami", href: "/portal/calculators/mortgage" },
  { id: "2", client: "Ing. Lucie Opalenská", type: "Investiční plán", date: "Včera", href: "/portal/calculators/investment" },
  { id: "3", client: "Petr Malý", type: "Životní pojištění", date: "10. března 2026", href: "/portal/calculators/life" },
  { id: "4", client: "Jana Dvořáková", type: "Penzijní odhad", date: "8. března 2026", href: "/portal/calculators/pension" },
  { id: "5", client: "Tech Solutions s.r.o.", type: "Hypotéka – refinancování", date: "5. března 2026", href: "/portal/calculators/mortgage" },
  { id: "6", client: "Martin Černý", type: "Investiční plán", date: "1. března 2026", href: "/portal/calculators/investment" },
];
