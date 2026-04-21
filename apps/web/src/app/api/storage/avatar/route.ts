import { NextResponse } from "next/server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/auth/get-membership";
import { logAudit } from "@/lib/audit";
import { createSignedStorageUrl } from "@/lib/storage/signed-url";

/**
 * WS-2 Batch 5 / W4 — proxy route pro avatary a branding loga.
 *
 * Důvod existence:
 *   Dřívější upload funkce (`uploadContactAvatar`, `uploadAdvisorAvatar`, `uploadReportLogo`)
 *   generovaly **365denní** signed URL a ukládaly ji přímo do DB. To je v rozporu s DoD:
 *     „Avatary/loga nemají >24 h signed URL."
 *
 *   Místo dlouhé signed URL teď ukládáme jen **storage path** (dohledatelné podle tenant
 *   prefixu). Veřejné UI odkazuje na `/api/storage/avatar?path=<encoded>`. Tento route:
 *     1. Ověří auth (advisor nebo klient v rámci tenantu z path prefixu).
 *     2. Vygeneruje krátkodobou signed URL (1 h, purpose `advisor_document_preview`).
 *     3. Audituje signed URL generování (s hashovanou cestou, nikoli plnou cestou).
 *     4. Redirectem pošle klienta na signed URL.
 *
 * Povolené path prefixy:
 *   - `<tenantId>/avatars/<contactId>/...`            — contact avatar
 *   - `<tenantId>/advisor-avatars/<userId>/...`       — advisor avatar
 *   - `<tenantId>/advisor-report-logos/<userId>/...`  — branding logo
 *
 *   Všechny ostatní prefixy → 403. Dokumenty klientů jsou mimo scope (mají vlastní
 *   download route s audit loggingem: `/api/documents/[id]/download`).
 */

const ALLOWED_SECOND_SEGMENTS = new Set([
  "avatars",
  "advisor-avatars",
  "advisor-report-logos",
]);

function isAllowedPath(rawPath: string, authTenantId: string): boolean {
  const parts = rawPath.split("/");
  if (parts.length < 3) return false;
  const [tenantSeg, typeSeg] = parts;
  if (tenantSeg !== authTenantId) return false;
  if (!ALLOWED_SECOND_SEGMENTS.has(typeSeg)) return false;
  if (rawPath.includes("..")) return false;
  return true;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const path = url.searchParams.get("path");
  if (!path || path.length === 0) {
    return NextResponse.json({ error: "missing_path" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const membership = await getMembership(user.id);
  if (!membership) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (!isAllowedPath(path, membership.tenantId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const signed = await createSignedStorageUrl({
    adminClient: admin,
    bucket: "documents",
    path,
    purpose: "advisor_document_preview",
    audit: {
      tenantId: membership.tenantId,
      userId: user.id,
      entityType: "storage_object",
      meta: { category: "avatar_or_branding" },
      request,
    },
  });

  if (!signed.signedUrl) {
    await logAudit({
      tenantId: membership.tenantId,
      userId: user.id,
      action: "storage.signed_url_failed",
      entityType: "storage_object",
      meta: { category: "avatar_or_branding" },
      request,
    }).catch(() => {});
    return NextResponse.json({ error: "signed_url_failed" }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
