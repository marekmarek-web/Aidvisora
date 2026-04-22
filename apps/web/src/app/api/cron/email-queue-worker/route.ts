import { NextResponse } from "next/server";
import { cronAuthResponse } from "@/lib/cron-auth";
import {
  processEmailQueueBatch,
  activateDueScheduledCampaigns,
  reapStuckQueueJobs,
  finalizeCompletedCampaigns,
} from "@/lib/email/queue-worker";
import { finalizeDueAbTests } from "@/lib/email/ab-finalize-worker";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel Cron: spouští se každou minutu. Zpracuje jeden batch z `email_send_queue`
 * + aktivuje naplánované kampaně + reapne stuck processing jobs.
 *
 * Pokud chceš vyšší propustnost, volej více batchů v rámci `maxDuration`.
 */
export async function GET(request: Request) {
  const denied = cronAuthResponse(request);
  if (denied) return denied;

  const start = Date.now();
  try {
    const scheduledActivated = await activateDueScheduledCampaigns();
    const reapedStuck = await reapStuckQueueJobs(10);

    // Rozumná propustnost v jedné invokaci: max 5 batchů po 40 = 200 emailů / run.
    const totals = { processed: 0, sent: 0, failed: 0, deferred: 0 };
    let killed = false;
    for (let i = 0; i < 5; i++) {
      const result = await processEmailQueueBatch({ batchSize: 40 });
      totals.processed += result.processed;
      totals.sent += result.sent;
      totals.failed += result.failed;
      totals.deferred += result.deferred;
      if (result.killed) {
        killed = true;
        break;
      }
      if (result.processed === 0) break;
      if (Date.now() - start > 45_000) break; // leave 15s buffer
    }

    const finalized = await finalizeCompletedCampaigns();
    const abFinalized = await finalizeDueAbTests();

    return NextResponse.json({
      ok: true,
      scheduledActivated,
      reapedStuck,
      finalized,
      abFinalized,
      killed,
      ...totals,
      durationMs: Date.now() - start,
    });
  } catch (e) {
    console.error("[cron/email-queue-worker] error", e);
    return NextResponse.json(
      { ok: false, error: String(e).slice(0, 400) },
      { status: 500 },
    );
  }
}
