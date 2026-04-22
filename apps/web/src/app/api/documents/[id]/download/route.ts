import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/auth/get-membership";
import { documents } from "db";
import { eq, and } from "db";
import { withTenantContextFromAuth } from "@/lib/auth/with-auth-context";
import { logAudit } from "@/lib/audit";
import { createSignedStorageUrl } from "@/lib/storage/signed-url";
import {
  checkDocumentAccess,
  logDocumentAccess,
} from "@/lib/security/document-access";
import { logSecurityEvent } from "@/lib/security/security-audit";
import type { RoleName } from "@/lib/auth/permissions";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/", _request.url));
  }
  const membership = await getMembership(user.id);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const [doc] = await withTenantContextFromAuth(
    { tenantId: membership.tenantId, userId: user.id },
    (tx) =>
      tx
        .select()
        .from(documents)
        .where(and(eq(documents.tenantId, membership.tenantId), eq(documents.id, id)))
        .limit(1),
  );
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // B3.2 — jeden centralizovaný access check místo inline logiky.
  // Vrací `requiresAudit`, podle kterého rozhodujeme o zápisu do
  // `document_access_log` (resp. `audit_log` s prefixem `document:access:*`).
  const accessCheck = checkDocumentAccess({
    documentId: id,
    tenantId: membership.tenantId,
    userId: user.id,
    roleName: membership.roleName as RoleName,
    purpose: "download",
    documentTenantId: doc.tenantId,
    isClientDoc: membership.roleName === "Client",
    visibleToClient: doc.visibleToClient ?? false,
    isSensitive: doc.sensitive ?? false,
    contactId: membership.contactId ?? undefined,
    documentContactId: doc.contactId ?? undefined,
  });

  if (!accessCheck.allowed) {
    if (accessCheck.requiresAudit) {
      await logSecurityEvent({
        tenantId: membership.tenantId,
        userId: user.id,
        eventType: "cross_tenant_attempt",
        severity: "critical",
        entityType: "document",
        entityId: id,
        meta: {
          reason: accessCheck.reason,
          purpose: "download",
          roleName: membership.roleName,
        },
        request: _request,
      }).catch(() => {});
    }
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await logAudit({
    tenantId: membership.tenantId,
    userId: user.id,
    action: "download",
    entityType: "document",
    entityId: id,
    request: _request,
  });
  if (accessCheck.requiresAudit) {
    await logDocumentAccess(
      {
        documentId: id,
        tenantId: membership.tenantId,
        userId: user.id,
        roleName: membership.roleName as RoleName,
        purpose: "download",
        documentTenantId: doc.tenantId,
        isSensitive: doc.sensitive ?? false,
        visibleToClient: doc.visibleToClient ?? false,
        contactId: membership.contactId ?? undefined,
        documentContactId: doc.contactId ?? undefined,
      },
      { request: _request },
    ).catch(() => {});
  }
  if (doc.sensitive) {
    await logAudit({
      tenantId: membership.tenantId,
      userId: user.id,
      action: "sensitive_document_view",
      entityType: "document",
      entityId: id,
      request: _request,
    }).catch(() => {});
  }
  const admin = createAdminClient();
  const signed = await createSignedStorageUrl({
    adminClient: admin,
    bucket: "documents",
    path: doc.storagePath,
    purpose: "download",
  });
  if (!signed.signedUrl) {
    return NextResponse.json({ error: "Storage URL failed" }, { status: 500 });
  }
  return NextResponse.redirect(signed.signedUrl);
}
