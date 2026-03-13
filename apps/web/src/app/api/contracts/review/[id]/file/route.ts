import { NextResponse } from "next/server";
import { getMembership } from "@/lib/auth/get-membership";
import { hasPermission, type RoleName } from "@/lib/auth/get-membership";
import { getContractReviewById } from "@/lib/ai/review-queue-repository";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const USER_ID_HEADER = "x-user-id";

/** Short-lived signed URL to download original contract file. Tenant-isolated. Auth only via x-user-id from middleware. */
const SIGNED_URL_EXPIRES_SEC = 60;

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

    const admin = createAdminClient();
    const { data: signed } = await admin.storage
      .from("documents")
      .createSignedUrl(row.storagePath, SIGNED_URL_EXPIRES_SEC);

    if (!signed?.signedUrl) {
      return NextResponse.json(
        { error: "Odkaz na soubor není k dispozici." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: signed.signedUrl, expiresIn: SIGNED_URL_EXPIRES_SEC });
  } catch {
    return NextResponse.json(
      { error: "Načtení souboru selhalo." },
      { status: 500 }
    );
  }
}
