import { listFinancialAnalyses } from "@/app/actions/financial-analyses";
import AnalysesPageClient from "./AnalysesPageClient";

export default async function AnalysesPage() {
  let analyses: Awaited<ReturnType<typeof listFinancialAnalyses>> = [];
  try {
    analyses = await listFinancialAnalyses();
  } catch {
    analyses = [];
  }

  return <AnalysesPageClient analyses={analyses} />;
}
