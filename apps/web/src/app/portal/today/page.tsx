import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getDashboardKpis } from "@/app/actions/dashboard";
import { getMeetingNotesForBoard } from "@/app/actions/meeting-notes";
import { listFinancialAnalyses } from "@/app/actions/financial-analyses";
import { getProductionSummary } from "@/app/actions/production";
import { DashboardEditable } from "./DashboardEditable";
import { LinesAndDotsLoader } from "@/app/components/LinesAndDotsLoader";

function DashboardLoader() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh] bg-[#f8fafc]">
      <div className="flex flex-col items-center gap-4">
        <LinesAndDotsLoader />
        <p className="text-slate-500 text-sm">Načítám nástěnku…</p>
      </div>
    </div>
  );
}

const FALLBACK_KPIS = {
  meetingsToday: 0,
  tasksOpen: 0,
  opportunitiesOpen: 0,
  totalContacts: 0,
  todayEvents: [],
  overdueTasks: [],
  upcomingAnniversaries: [],
  serviceDueContacts: [],
  pipelineAtRisk: [],
  recentActivity: [],
  tasksDueToday: [],
  opportunitiesInStep3And4: [],
} as Awaited<ReturnType<typeof getDashboardKpis>>;

async function DashboardContent() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const advisorName = (user?.user_metadata?.full_name as string | undefined) ?? null;

  let productionError: string | null = null;
  const [kpis, notes, analyses, production] = await Promise.all([
    getDashboardKpis().catch((e) => {
      console.error("[DashboardContent] getDashboardKpis", e);
      return FALLBACK_KPIS;
    }),
    getMeetingNotesForBoard().catch(() => []),
    listFinancialAnalyses().catch(() => []),
    getProductionSummary("month").catch((e) => {
      productionError = e instanceof Error ? e.message : "Nepodařilo se načíst produkci.";
      return null;
    }),
  ]);
  return (
    <DashboardEditable
      kpis={kpis}
      initialNotes={notes}
      advisorName={advisorName}
      initialAnalyses={analyses}
      productionSummary={production}
      productionError={productionError}
    />
  );
}

export default function TodayPage() {
  return (
    <Suspense fallback={<DashboardLoader />}>
      <DashboardContent />
    </Suspense>
  );
}
