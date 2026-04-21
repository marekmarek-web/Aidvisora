import { NextResponse } from "next/server";
import { db, sql } from "db";
import { checkRateLimit } from "@/lib/security/rate-limit";

/**
 * Public liveness + lightweight DB readiness endpoint for statuspage / uptime
 * monitoring (Better Uptime, UptimeRobot, BetterStack etc.).
 *
 * Contract:
 * - GET /api/health → 200 `{ status: "ok", ... }` when app + DB responding.
 * - GET /api/health → 503 `{ status: "degraded", ... }` when DB ping fails.
 *
 * Intentionally:
 * - No auth (needs to be reachable by third-party monitors).
 * - No heavy work (only `select 1` on DB — must stay under ~500 ms).
 * - Rate-limited per IP so it cannot be used to probe infra.
 * - No internal secrets / build metadata leaked (only commit SHA + env name).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function buildBody(params: {
  status: "ok" | "degraded";
  db: "up" | "down";
  dbError?: string;
  tookMs: number;
}) {
  return {
    status: params.status,
    time: new Date().toISOString(),
    env:
      process.env.VERCEL_ENV ??
      (process.env.NODE_ENV === "production" ? "production" : "development"),
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? null,
    checks: {
      db: params.db,
      dbError: params.dbError ?? null,
    },
    tookMs: params.tookMs,
  };
}

export async function GET(request: Request) {
  const limiter = checkRateLimit(request, "health", null, {
    windowMs: 60_000,
    maxRequests: 60,
  });
  if (!limiter.ok) {
    return NextResponse.json(
      { status: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limiter.retryAfterSec) } },
    );
  }

  const started = Date.now();
  try {
    await db.execute(sql`select 1`);
    const tookMs = Date.now() - started;
    return NextResponse.json(
      buildBody({ status: "ok", db: "up", tookMs }),
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const tookMs = Date.now() - started;
    const message =
      err instanceof Error ? err.message.slice(0, 200) : "db_error";
    return NextResponse.json(
      buildBody({ status: "degraded", db: "down", dbError: message, tookMs }),
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function HEAD(request: Request) {
  const limiter = checkRateLimit(request, "health", null, {
    windowMs: 60_000,
    maxRequests: 60,
  });
  if (!limiter.ok) {
    return new Response(null, {
      status: 429,
      headers: { "Retry-After": String(limiter.retryAfterSec) },
    });
  }
  try {
    await db.execute(sql`select 1`);
    return new Response(null, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return new Response(null, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
