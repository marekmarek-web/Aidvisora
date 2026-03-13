import { NextResponse } from "next/server";
import { getMembership, hasPermission, type RoleName } from "@/lib/auth/get-membership";
import { getContractReviewById } from "@/lib/ai/review-queue-repository";

export const dynamic = "force-dynamic";

const USER_ID_HEADER = "x-user-id";

/**
 * GET /api/contracts/review/[id]
 * Returns contract review detail and payload for review queue UI.
 * Auth only via x-user-id from middleware (no Supabase in route).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = request.headers.get(USER_ID_HEADER);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const membership = await getMembership(userId);
    if (!membership || !hasPermission(membership.roleName as RoleName, "documents:read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const row = await getContractReviewById(id, membership.tenantId);
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: row.id,
      fileName: row.fileName,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      processingStatus: row.processingStatus,
      errorMessage: row.errorMessage,
      extractedPayload: row.extractedPayload,
      clientMatchCandidates: row.clientMatchCandidates,
      draftActions: row.draftActions,
      confidence: row.confidence,
      reasonsForReview: row.reasonsForReview,
      reviewStatus: row.reviewStatus,
      reviewedBy: row.reviewedBy,
      reviewedAt: row.reviewedAt,
      rejectReason: row.rejectReason,
      appliedBy: row.appliedBy,
      appliedAt: row.appliedAt,
      matchedClientId: row.matchedClientId ?? undefined,
      createNewClientConfirmed: row.createNewClientConfirmed ?? undefined,
      applyResultPayload: row.applyResultPayload ?? undefined,
      reviewDecisionReason: row.reviewDecisionReason ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  } catch {
    return NextResponse.json(
      { error: "Načtení detailu selhalo." },
      { status: 500 }
    );
  }
}
