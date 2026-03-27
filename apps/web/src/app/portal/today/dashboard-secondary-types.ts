import type { ServiceRecommendationWithContact } from "@/app/actions/service-engine";
import type { MeetingNoteForBoard } from "@/app/actions/meeting-notes";
import type { FinancialAnalysisListItem } from "@/app/actions/financial-analyses";
import type { ProductionSummary } from "@/app/actions/production";

export type BusinessPlanWidgetData = {
  periodLabel: string;
  overallHealth: string;
  metrics: { metricType: string; label: string; actual: number; target: number; health: string; unit: string }[];
};

export type DashboardSecondaryBundle = {
  serviceRecommendations: ServiceRecommendationWithContact[];
  initialNotes: MeetingNoteForBoard[];
  initialAnalyses: FinancialAnalysisListItem[];
  productionSummary: ProductionSummary | null;
  productionError: string | null;
  businessPlanWidgetData: BusinessPlanWidgetData | null;
};
