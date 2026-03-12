import type { CalculatorDefinition } from "./types";

const CALCULATORS: CalculatorDefinition[] = [
  {
    id: "investment",
    slug: "investment",
    title: "Investiční kalkulačka",
    category: "investment",
    description:
      "Projekce zhodnocení – výpočet hodnoty investice v čase podle strategie.",
    icon: "trending-up",
    route: "/portal/calculators/investment",
    status: "active",
    engineRef: "investment",
    modes: ["standalone", "embedded"],
  },
  {
    id: "mortgage",
    slug: "mortgage",
    title: "Hypoteční kalkulačka",
    category: "mortgage",
    description: "Měsíční splátka a náklady hypotéky.",
    icon: "calculator",
    route: "/portal/calculators/mortgage",
    status: "active",
    engineRef: "mortgage",
    modes: ["standalone"],
  },
  {
    id: "pension",
    slug: "pension",
    title: "Penzijní kalkulačka",
    category: "pension",
    description: "Státní příspěvky a nutné úspory.",
    icon: "piggy-bank",
    route: "/portal/calculators/pension",
    status: "active",
    engineRef: "pension",
    modes: ["standalone"],
  },
  {
    id: "life",
    slug: "life",
    title: "Kalkulačka životního pojištění",
    category: "life",
    description: "Potřebné krytí pro zajištění rodiny a příjmů.",
    icon: "heart-pulse",
    route: "/portal/calculators/life",
    status: "active",
    engineRef: "life",
    modes: ["standalone"],
  },
];

export function getCalculators(): CalculatorDefinition[] {
  return CALCULATORS;
}

export function getCalculatorBySlug(slug: string): CalculatorDefinition | undefined {
  return CALCULATORS.find((c) => c.slug === slug);
}

export function getCalculatorById(id: string): CalculatorDefinition | undefined {
  return CALCULATORS.find((c) => c.id === id);
}
