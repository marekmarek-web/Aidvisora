import { NextResponse } from "next/server";
import { cronAuthResponse } from "@/lib/cron-auth";
import { runDueAutomations } from "@/lib/email/automation-worker";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Vercel Cron: denní worker, který prochází všechna aktivní pravidla
 * `email_automation_rules` a pro matchnuté kontakty vytváří kampaně
 * a zařazuje je do `email_send_queue`.
 *
 * Pro bezpečnost proti výpadku: každé pravidlo má uvnitř idempotenci
 * (`email_automation_runs` dedupe okno). Pokud cron spadne a spustí se
 * znovu, duplicitní e-maily nepošle.
 */
export async function GET(request: Request) {
  const denied = cronAuthResponse(request);
  if (denied) return denied;

  const start = Date.now();
  try {
    const result = await runDueAutomations();
    return NextResponse.json({
      ok: true,
      durationMs: Date.now() - start,
      ...result,
    });
  } catch (e) {
    console.error("[cron/email-automations] error", e);
    return NextResponse.json(
      { ok: false, error: String(e).slice(0, 400) },
      { status: 500 },
    );
  }
}
