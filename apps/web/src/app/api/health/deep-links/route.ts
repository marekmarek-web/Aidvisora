import { NextResponse } from "next/server";

/**
 * Deep-link handshake health check.
 *
 * Verifies that:
 *  1. Apple App Site Association (AASA) is reachable at `/.well-known/apple-app-site-association`
 *     (served via rewrite from `/api/apple-app-site-association`), returns JSON,
 *     and has at least one `applinks.details` entry with an `appIDs` array.
 *  2. Android assetlinks.json is reachable at `/.well-known/assetlinks.json`
 *     (served via rewrite from `/api/assetlinks`), returns JSON, and has at
 *     least one valid SHA-256 fingerprint.
 *  3. Both endpoints serve `application/json` — Apple and Google's validators
 *     reject `text/html`.
 *
 * In production we return 503 if anything is wrong so uptime monitors catch
 * mis-deployed env (missing APPLE_TEAM_ID / ANDROID_SHA256_FINGERPRINTS).
 * In preview/dev we return 200 with a `warnings` array so PR previews don't
 * flip the monitor red.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CheckResult = {
  ok: boolean;
  reason?: string;
  contentType?: string | null;
  details?: unknown;
};

async function checkAasa(origin: string): Promise<CheckResult> {
  try {
    const url = `${origin}/.well-known/apple-app-site-association`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return { ok: false, reason: `http_${res.status}` };
    const contentType = res.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return { ok: false, reason: "wrong_content_type", contentType };
    }
    const body = (await res.json()) as { applinks?: { details?: unknown[] } };
    const details = body.applinks?.details;
    if (!Array.isArray(details) || details.length === 0) {
      return { ok: false, reason: "empty_applinks_details", contentType, details };
    }
    const first = details[0] as { appIDs?: unknown[] } | undefined;
    if (!first?.appIDs || !Array.isArray(first.appIDs) || first.appIDs.length === 0) {
      return { ok: false, reason: "no_app_ids", contentType, details };
    }
    return { ok: true, contentType, details: { appIdCount: first.appIDs.length } };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "fetch_error" };
  }
}

async function checkAssetlinks(origin: string): Promise<CheckResult> {
  try {
    const url = `${origin}/.well-known/assetlinks.json`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return { ok: false, reason: `http_${res.status}` };
    const contentType = res.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return { ok: false, reason: "wrong_content_type", contentType };
    }
    const body = (await res.json()) as unknown;
    if (!Array.isArray(body) || body.length === 0) {
      return { ok: false, reason: "empty_array", contentType };
    }
    const first = body[0] as {
      target?: { sha256_cert_fingerprints?: unknown[] };
    } | undefined;
    const fps = first?.target?.sha256_cert_fingerprints;
    if (!Array.isArray(fps) || fps.length === 0) {
      return { ok: false, reason: "no_fingerprints", contentType };
    }
    return { ok: true, contentType, details: { fingerprintCount: fps.length } };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "fetch_error" };
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = `${url.protocol}//${url.host}`;
  const [aasa, assetlinks] = await Promise.all([
    checkAasa(origin),
    checkAssetlinks(origin),
  ]);

  const envName = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown";
  const isProdEnv = envName === "production";
  const everythingOk = aasa.ok && assetlinks.ok;

  const body = {
    status: everythingOk ? "ok" : isProdEnv ? "degraded" : "warn",
    env: envName,
    time: new Date().toISOString(),
    checks: {
      apple_app_site_association: aasa,
      assetlinks_json: assetlinks,
    },
  };

  return NextResponse.json(body, {
    status: everythingOk ? 200 : isProdEnv ? 503 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
