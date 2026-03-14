import { listFinancialAnalyses } from "@/app/actions/financial-analyses";
import AnalysesPageClient from "./AnalysesPageClient";

export default async function AnalysesPage() {
  const analyses = await listFinancialAnalyses();

  return <AnalysesPageClient analyses={analyses} />;
}
