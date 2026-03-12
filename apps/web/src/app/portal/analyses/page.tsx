import { listFinancialAnalyses } from "@/app/actions/financial-analyses";
import { AnalysesPageClient } from "./AnalysesPageClient";

export default async function AnalysesPage() {
  const analyses = await listFinancialAnalyses();

  return (
    <div className="p-4 sm:p-6">
      <AnalysesPageClient analyses={analyses} />
    </div>
  );
}
