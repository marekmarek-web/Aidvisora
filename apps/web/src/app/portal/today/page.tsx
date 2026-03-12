import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getDashboardKpis } from "@/app/actions/dashboard";
import { getMeetingNotesForBoard } from "@/app/actions/meeting-notes";
import { listFinancialAnalyses } from "@/app/actions/financial-analyses";
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

async function DashboardContent() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const advisorName = (user?.user_metadata?.full_name as string | undefined) ?? null;

  const [kpis, notes, analyses] = await Promise.all([
    getDashboardKpis(),
    getMeetingNotesForBoard().catch(() => []),
    listFinancialAnalyses().catch(() => []),
  ]);
  return (
    <DashboardEditable
      kpis={kpis}
      initialNotes={notes}
      advisorName={advisorName}
      initialAnalyses={analyses}
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
