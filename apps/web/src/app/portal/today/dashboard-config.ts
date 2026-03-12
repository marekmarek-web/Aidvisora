/**
 * Dashboard widget registry and section mapping.
 * Sections: A = Dnes a teď, B = Obchod a výkon, C = Servis a klienti, D = Přehled a akce.
 */
import type { LucideIcon } from "lucide-react";
import {
  Sparkles,
  CheckSquare,
  MessageSquare,
  Briefcase,
  TrendingUp,
  Wrench,
  FileText,
} from "lucide-react";

export const WIDGET_IDS = [
  "summaryDay",
  "myTasks",
  "messages",
  "activeDeals",
  "production",
  "clientCare",
  "financialAnalyses",
] as const;

export type WidgetId = (typeof WIDGET_IDS)[number];

export const WIDGET_LABELS: Record<WidgetId, string> = {
  summaryDay: "Shrnutí dne",
  myTasks: "Moje úkoly",
  messages: "Zprávy od klientů",
  activeDeals: "Aktivní obchody",
  production: "Produkce",
  clientCare: "Péče o klienty",
  financialAnalyses: "Finanční analýzy",
};

export const WIDGET_ICONS: Record<WidgetId, LucideIcon> = {
  summaryDay: Sparkles,
  myTasks: CheckSquare,
  messages: MessageSquare,
  activeDeals: Briefcase,
  production: TrendingUp,
  clientCare: Wrench,
  financialAnalyses: FileText,
};

/** Section for content hierarchy: A = Dnes a teď, B = Obchod a výkon, C = Servis a klienti, D = Přehled a akce */
export type DashboardSection = "A" | "B" | "C" | "D";

export const WIDGET_SECTION: Record<WidgetId, DashboardSection> = {
  summaryDay: "A",
  myTasks: "A",
  messages: "A",
  activeDeals: "B",
  production: "B",
  clientCare: "C",
  financialAnalyses: "D",
};

export const WIDGET_HREF: Partial<Record<WidgetId, string>> = {
  summaryDay: "/portal/calendar",
  myTasks: "/portal/tasks",
  messages: "/portal/contacts",
  activeDeals: "/portal/pipeline",
  production: "/portal/production",
  clientCare: "/portal/contacts",
  financialAnalyses: "/portal/analyses",
};
