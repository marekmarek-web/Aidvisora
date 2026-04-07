/**
 * Cron: Image Intake cross-session artifact cleanup (Phase 8 / Phase 9 monitoring).
 *
 * Runs daily and deletes stale `ai_generations` rows where:
 *   entityType IN ("image_intake_thread_artifact", "image_intake_intent_assist_cache")
 *   createdAt < NOW() - cross_session_ttl_hours
 *
 * Phase 9 monitoring additions:
 * - Structured audit log per cron run (logAuditAction)
 * - Separate deleted counts per entityType
 * - Config summary in response for ops visibility
 * - Skipped/error states clearly signalled
 *
 * Safety:
 * - Only deletes rows with the specific entityTypes — no other data touched
 * - Skips if config.crossSessionPersistenceEnabled is false
 * - Non-throwing: failures logged + 500 with error detail
 * - Respects TTL from image-intake-config (default 72h)
 *
 * Vercel cron: schedule "0 3 * * *" (3am UTC daily)
 * Auth: cronAuthResponse (CRON_SECRET bearer)
 */

import { NextResponse } from "next/server";
import { cronAuthResponse } from "@/lib/cron-auth";
import { db, aiGenerations, eq, and, lt } from "db";
import { logAuditAction } from "@/lib/audit";
import { getImageIntakeConfig } from "@/lib/ai/image-intake/image-intake-config";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ENTITY_TYPE_ARTIFACT = "image_intake_thread_artifact";
const ENTITY_TYPE_CACHE = "image_intake_intent_assist_cache";
const CRON_AUDIT_TENANT = "system";
const CRON_AUDIT_USER = "cron";

export async function GET(request: Request) {
  const denied = cronAuthResponse(request);
  if (denied) return denied;

  const runStart = Date.now();
  const config = getImageIntakeConfig();

  if (!config.crossSessionPersistenceEnabled) {
    logAuditAction({
      tenantId: CRON_AUDIT_TENANT,
      userId: CRON_AUDIT_USER,
      action: "image_intake_cleanup.skipped",
      entityType: "cron_run",
      meta: {
        reason: "cross_session_persistence_enabled=false",
        ttlHours: config.crossSessionTtlMs / 3600000,
      },
    });
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "cross_session_persistence_enabled is false — cleanup skipped.",
    });
  }

  const cutoffMs = Date.now() - config.crossSessionTtlMs;
  const cutoffDate = new Date(cutoffMs);
  const ttlHours = config.crossSessionTtlMs / 3600000;

  logAuditAction({
    tenantId: CRON_AUDIT_TENANT,
    userId: CRON_AUDIT_USER,
    action: "image_intake_cleanup.started",
    entityType: "cron_run",
    meta: {
      cutoffDate: cutoffDate.toISOString(),
      ttlHours,
      entityTypes: [ENTITY_TYPE_ARTIFACT, ENTITY_TYPE_CACHE],
    },
  });

  try {
    // Delete cross-session artifacts
    const artifactResult = await db
      .delete(aiGenerations)
      .where(
        and(
          eq(aiGenerations.entityType, ENTITY_TYPE_ARTIFACT),
          lt(aiGenerations.createdAt, cutoffDate),
        ),
      );

    // Delete intent-assist cache entries
    const cacheResult = await db
      .delete(aiGenerations)
      .where(
        and(
          eq(aiGenerations.entityType, ENTITY_TYPE_CACHE),
          lt(aiGenerations.createdAt, cutoffDate),
        ),
      );

    const deletedArtifacts = (artifactResult as { rowCount?: number }).rowCount ?? 0;
    const deletedCache = (cacheResult as { rowCount?: number }).rowCount ?? 0;
    const totalDeleted = deletedArtifacts + deletedCache;
    const durationMs = Date.now() - runStart;

    logAuditAction({
      tenantId: CRON_AUDIT_TENANT,
      userId: CRON_AUDIT_USER,
      action: "image_intake_cleanup.completed",
      entityType: "cron_run",
      meta: {
        deletedArtifacts,
        deletedCache,
        totalDeleted,
        cutoffDate: cutoffDate.toISOString(),
        ttlHours,
        durationMs,
      },
    });

    return NextResponse.json({
      ok: true,
      deletedArtifacts,
      deletedCache,
      totalDeleted,
      cutoffDate: cutoffDate.toISOString(),
      ttlHours,
      durationMs,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown cleanup error";
    const durationMs = Date.now() - runStart;

    logAuditAction({
      tenantId: CRON_AUDIT_TENANT,
      userId: CRON_AUDIT_USER,
      action: "image_intake_cleanup.failed",
      entityType: "cron_run",
      meta: {
        error,
        cutoffDate: cutoffDate.toISOString(),
        ttlHours,
        durationMs,
      },
    });

    return NextResponse.json(
      {
        ok: false,
        error,
        cutoffDate: cutoffDate.toISOString(),
        ttlHours,
        durationMs,
      },
      { status: 500 },
    );
  }
}
