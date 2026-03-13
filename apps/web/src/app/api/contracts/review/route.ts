import { NextResponse } from "next/server";
import { getMembership, hasPermission, type RoleName } from "@/lib/auth/get-membership";
import { listContractReviews } from "@/lib/ai/review-queue-repository";
import type { ContractReviewStatus } from "db";
import type { ContractProcessingStatus } from "db";

export const dynamic = "force-dynamic";

/** Set by middleware; /api/contracts/* autorizujeme jen přes hlavičku (bez Supabase v route). */
const USER_ID_HEADER = "x-user-id";

function matchSearch(row: { extractedPayload?: unknown }, q: string): boolean {
  if (!q || q.length < 2) return true;
  const s = q.toLowerCase();
  const p = row.extractedPayload as Record<string, unknown> | null;
  if (!p) return false;
  const str = (v: unknown) => (v != null ? String(v).toLowerCase() : "");
  const client = p.client as Record<string, unknown> | undefined;
  const fullName = client ? str(client.fullName) || [str(client.firstName), str(client.lastName)].filter(Boolean).join(" ") : "";
  return (
    str(p.institutionName).includes(s) ||
    str(p.contractNumber).includes(s) ||
    fullName.includes(s) ||
    (client ? str(client.email).includes(s) || str(client.phone).includes(s) : false)
  );
}

export async function GET(request: Request) {
  const url = request.url;
  const method = request.method;
  const xDebugMw = request.headers.get("x-debug-mw");
  const xDebugPath = request.headers.get("x-debug-path");
  const userId = request.headers.get(USER_ID_HEADER);
  // Diagnostický log: co route obdržela (bez citlivých dat)
  // eslint-disable-next-line no-console
  console.log("[route GET /api/contracts/review]", { url, method, xDebugMw, xDebugPath, hasUserIdHeader: !!userId, userIdMask: userId ? `${userId.slice(0, 8)}…` : null });

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const membership = await getMembership(userId);
    if (!membership || !hasPermission(membership.roleName as RoleName, "documents:read")) {
      // eslint-disable-next-line no-console
      console.log("[route GET /api/contracts/review] 403", { hasMembership: !!membership, roleName: membership?.roleName });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // #region agent log
    fetch("http://127.0.0.1:7387/ingest/30869546-c4c0-4805-9fd6-2bc75f3b0175", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "6af004" },
      body: JSON.stringify({
        sessionId: "6af004",
        hypothesisId: "H3",
        location: "api/contracts/review/route.ts:after_auth",
        message: "review list auth ok",
        data: { tenantId: membership.tenantId },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    const { searchParams } = new URL(request.url);
    const reviewStatus = searchParams.get("reviewStatus") as ContractReviewStatus | null;
    const processingStatus = searchParams.get("processingStatus") as ContractProcessingStatus | null;
    const search = searchParams.get("search")?.trim() ?? "";

    let rows = await listContractReviews(membership.tenantId, {
      limit: 100,
      ...(reviewStatus ? { reviewStatus } : {}),
    });

    if (processingStatus) {
      rows = rows.filter((r) => r.processingStatus === processingStatus);
    }
    if (search) {
      rows = rows.filter((r) => matchSearch(r, search));
    }

    // #region agent log
    fetch("http://127.0.0.1:7387/ingest/30869546-c4c0-4805-9fd6-2bc75f3b0175", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "6af004" },
      body: JSON.stringify({
        sessionId: "6af004",
        hypothesisId: "H4",
        location: "api/contracts/review/route.ts:after_list",
        message: "review list listContractReviews ok",
        data: { count: rows.length },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return NextResponse.json({ items: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const errName = err instanceof Error ? err.name : "";
    // eslint-disable-next-line no-console
    console.error("[route GET /api/contracts/review] 500", errName, message, err instanceof Error ? err.stack : "");
    // #region agent log
    fetch("http://127.0.0.1:7387/ingest/30869546-c4c0-4805-9fd6-2bc75f3b0175", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "6af004" },
      body: JSON.stringify({
        sessionId: "6af004",
        hypothesisId: "H3_H4",
        location: "api/contracts/review/route.ts:catch",
        message: "review list catch",
        data: { message },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return NextResponse.json(
      { error: "Načtení seznamu selhalo." },
      { status: 500 }
    );
  }
}
