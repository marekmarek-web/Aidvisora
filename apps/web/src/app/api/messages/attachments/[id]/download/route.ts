import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/auth/get-membership";
import { db } from "db";
import { messageAttachments, messages } from "db";
import { eq } from "db";
import { createSignedStorageUrl } from "@/lib/storage/signed-url";
import { logAudit } from "@/lib/audit";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/", _request.url));
  }
  const membership = await getMembership(user.id);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [att] = await db
    .select({
      id: messageAttachments.id,
      messageId: messageAttachments.messageId,
      storagePath: messageAttachments.storagePath,
    })
    .from(messageAttachments)
    .where(eq(messageAttachments.id, id))
    .limit(1);
  if (!att) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [msg] = await db
    .select({ tenantId: messages.tenantId, contactId: messages.contactId })
    .from(messages)
    .where(eq(messages.id, att.messageId))
    .limit(1);
  if (!msg || msg.tenantId !== membership.tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (membership.roleName === "Client") {
    if (!membership.contactId || msg.contactId !== membership.contactId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const admin = createAdminClient();
  const signed = await createSignedStorageUrl({
    adminClient: admin,
    bucket: "documents",
    path: att.storagePath,
    purpose: "download",
  });
  if (!signed.signedUrl) {
    return NextResponse.json({ error: "Storage URL failed" }, { status: 500 });
  }
  await logAudit({
    tenantId: membership.tenantId,
    userId: user.id,
    action: "download",
    entityType: "message_attachment",
    entityId: att.id,
    request: _request,
  }).catch(() => {});
  return NextResponse.redirect(signed.signedUrl);
}
