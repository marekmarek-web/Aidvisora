import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMembership, hasPermission, type RoleName } from "@/lib/auth/get-membership";
import { listContractReviews } from "@/lib/ai/review-queue-repository";
import type { ContractReviewStatus } from "db";
import type { ContractProcessingStatus } from "db";

export const dynamic = "force-dynamic";

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
  // #region agent log
  fetch("http://127.0.0.1:7387/ingest/30869546-c4c0-4805-9fd6-2bc75f3b0175", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "6af004" },
    body: JSON.stringify({
      sessionId: "6af004",
      hypothesisId: "H3_H4",
      location: "api/contracts/review/route.ts:GET:entry",
      message: "review list GET entered",
      data: {},
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const membership = await getMembership(user.id);
    if (!membership || !hasPermission(membership.roleName as RoleName, "documents:read")) {
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
