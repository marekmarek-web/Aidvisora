import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db-client";

/**
 * Out-of-band health endpoint pro Better Stack / Pingdom / Checkly / UptimeRobot.
 *
 * Kontroluje 3 závislosti:
 *   1. Postgres (Supabase) — `SELECT 1` přes Drizzle
 *   2. Stripe — přítomnost `STRIPE_SECRET_KEY` + lightweight API ping
 *   3. Resend — přítomnost `RESEND_API_KEY` + lightweight API ping
 *
 * Vrací:
 *   - HTTP 200 když všechno ok
 *   - HTTP 503 když kterákoli kritická závislost selže
 *   - `x-health-summary` header pro rychlé textové rozlišení
 *
 * Bez auth (externí monitor musí umět volat). Žádné citlivé info v odpovědi
 * (jen "ok" / "fail" per komponenta + latency v ms).
 *
 * Externí monitor setup viz `docs/ops/uptime-monitoring.md`.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ComponentStatus = {
  status: "ok" | "fail" | "skipped";
  latencyMs?: number;
  error?: string;
};

type HealthResponse = {
  status: "ok" | "degraded" | "down";
  version: string;
  region: string;
  timestamp: string;
  components: {
    database: ComponentStatus;
    stripe: ComponentStatus;
    resend: ComponentStatus;
  };
};

const HEALTHCHECK_TIMEOUT_MS = 4000;

async function withTimeout<T>(p: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}: timeout after ${timeoutMs}ms`)), timeoutMs);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

async function checkDatabase(): Promise<ComponentStatus> {
  const start = Date.now();
  try {
    await withTimeout(db.execute(sql`SELECT 1`), HEALTHCHECK_TIMEOUT_MS, "db");
    return { status: "ok", latencyMs: Date.now() - start };
  } catch (err) {
    return {
      status: "fail",
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message.slice(0, 120) : "unknown",
    };
  }
}

async function checkStripe(): Promise<ComponentStatus> {
  if (!process.env.STRIPE_SECRET_KEY) return { status: "skipped" };
  const start = Date.now();
  try {
    const res = await withTimeout(
      fetch("https://api.stripe.com/v1/balance", {
        headers: {
          Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
          "Stripe-Version": "2024-06-20",
        },
      }),
      HEALTHCHECK_TIMEOUT_MS,
      "stripe",
    );
    if (!res.ok) {
      return { status: "fail", latencyMs: Date.now() - start, error: `HTTP ${res.status}` };
    }
    return { status: "ok", latencyMs: Date.now() - start };
  } catch (err) {
    return {
      status: "fail",
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message.slice(0, 120) : "unknown",
    };
  }
}

async function checkResend(): Promise<ComponentStatus> {
  if (!process.env.RESEND_API_KEY) return { status: "skipped" };
  const start = Date.now();
  try {
    const res = await withTimeout(
      fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      }),
      HEALTHCHECK_TIMEOUT_MS,
      "resend",
    );
    if (!res.ok) {
      return { status: "fail", latencyMs: Date.now() - start, error: `HTTP ${res.status}` };
    }
    return { status: "ok", latencyMs: Date.now() - start };
  } catch (err) {
    return {
      status: "fail",
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message.slice(0, 120) : "unknown",
    };
  }
}

export async function GET() {
  const [database, stripe, resend] = await Promise.all([
    checkDatabase(),
    checkStripe(),
    checkResend(),
  ]);

  const criticalFailures = [database.status === "fail"];
  const softFailures = [stripe.status === "fail", resend.status === "fail"];

  const overall: HealthResponse["status"] = criticalFailures.some(Boolean)
    ? "down"
    : softFailures.some(Boolean)
      ? "degraded"
      : "ok";

  const body: HealthResponse = {
    status: overall,
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
    region: process.env.VERCEL_REGION ?? "local",
    timestamp: new Date().toISOString(),
    components: { database, stripe, resend },
  };

  return NextResponse.json(body, {
    status: overall === "down" ? 503 : 200,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "x-health-summary": `db=${database.status} stripe=${stripe.status} resend=${resend.status}`,
    },
  });
}

export async function HEAD() {
  const database = await checkDatabase();
  return new NextResponse(null, {
    status: database.status === "fail" ? 503 : 200,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "x-health-summary": `db=${database.status}`,
    },
  });
}
