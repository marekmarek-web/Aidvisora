/**
 * Shared types for the calculator framework.
 */

export interface FaqItem {
  question: string;
  answer: string;
}

export type CalculatorCategory =
  | "investment"
  | "mortgage"
  | "pension"
  | "life"
  | "other";

export type CalculatorStatus = "active" | "coming_soon" | "disabled";

export type CalculatorMode = "standalone" | "crm" | "embedded";

/** Icon identifier for mapping to Lucide (or other) icon component. */
export type CalculatorIconId =
  | "trending-up"
  | "calculator"
  | "piggy-bank"
  | "heart-pulse"
  | "circle-help";

export interface CalculatorDefinition {
  id: string;
  slug: string;
  title: string;
  category: CalculatorCategory;
  description: string;
  icon: CalculatorIconId;
  route: string;
  status: CalculatorStatus;
  engineRef?: string;
  featureFlags?: string[];
  modes?: CalculatorMode[];
}
