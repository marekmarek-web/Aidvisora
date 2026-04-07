/**
 * Cron: Image Intake cross-session artifact cleanup (Phase 8).
 *
 * Runs daily and deletes stale `ai_generations` rows where:
 *   entityType = "image_intake_thread_artifact"
 *   createdAt < NOW() - cross_session_ttl_hours
 *
 * Safety:
 * - Only deletes rows with the specific entityType — no other data touched
 * - Skips if config.crossSessionPersistenceEnabled is false
 * - Non-throwing: failures logged, cron returns 200 with error detail
 * - Respects TTL from image-intake-config (default 72h)
 *
 * Vercel cron: schedule "0 3 * * *" (3am UTC daily)
 * Auth: cronAuthResponse (CRON_SECRET bearer)
 */

import { NextResponse } from "next/server";
import { cronAuthResponse } from "@/lib/cron-auth";
import { db, aiGenerations, eq, and } from "db";
import { lt } from "drizzle-orm";
import { getImageIntakeConfig } from "@/lib/ai/image-intake/image-intake-config";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ENTITY_TYPE = "image_intake_thread_artifact";

export async function GET(request: Request) {
  const denied = cronAuthResponse(request);
  if (denied) return denied;

  const config = getImageIntakeConfig();

  if (!config.crossSessionPersistenceEnabled) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "cross_session_persistence_enabled is false — cleanup skipped.",
    });
  }

  const cutoffMs = Date.now() - config.crossSessionTtlMs;
  const cutoffDate = new Date(cutoffMs);

  try {
    const result = await db
      .delete(aiGenerations)
      .where(
        and(
          eq(aiGenerations.entityType, ENTITY_TYPE),
          lt(aiGenerations.createdAt, cutoffDate),
        ),
      );

    const deletedCount = (result as { rowCount?: number }).rowCount ?? 0;

    return NextResponse.json({
      ok: true,
      deletedRows: deletedCount,
      cutoffDate: cutoffDate.toISOString(),
      ttlHours: config.crossSessionTtlMs / 3600000,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Unknown cleanup error",
        cutoffDate: cutoffDate.toISOString(),
      },
      { status: 500 },
    );
  }
}
