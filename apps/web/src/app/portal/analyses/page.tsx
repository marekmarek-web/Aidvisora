import { listFinancialAnalyses } from "@/app/actions/financial-analyses";
import AnalysesPageClient from "./AnalysesPageClient";

export default async function AnalysesPage() {
  let analyses: Awaited<ReturnType<typeof listFinancialAnalyses>> = [];
  try {
    analyses = await listFinancialAnalyses();
  } catch (err) {
    console.error("[AnalysesPage] listFinancialAnalyses failed:", err);
    analyses = [];
  }

  return <AnalysesPageClient analyses={analyses} />;
}
