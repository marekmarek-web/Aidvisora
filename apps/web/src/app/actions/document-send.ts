"use server";

import { requireAuthInAction } from "@/lib/auth/require-auth";
import { withTenantContextFromAuth } from "@/lib/auth/with-auth-context";
import { hasPermission } from "@/lib/auth/permissions";
import { documents, eq, and } from "db";
import { createAdminClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { logNotification } from "@/lib/email/send-email";
import { loadAdvisorMailHeadersForCurrentUser } from "@/lib/email/advisor-mail-headers";
import { documentAttachmentEmailTemplate } from "@/lib/email/templates";

const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function safeAttachmentFilename(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._\-\u00C0-\u024F]/g, "_").slice(0, 180);
  if (base.toLowerCase().endsWith(".pdf")) return base;
  return `${base || "dokument"}.pdf`;
}

function recipientDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at === -1 ? "unknown" : email.slice(at + 1).toLowerCase();
}

export async function sendDocumentByEmail(
  documentId: string,
  recipientEmail: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireAuthInAction();
  if (!hasPermission(auth.roleName, "documents:write")) {
    return { ok: false, error: "Forbidden" };
  }

  const to = recipientEmail.trim();
  if (!isValidEmail(to)) {
    return { ok: false, error: "Neplatná e-mailová adresa." };
  }

  const [doc] = await withTenantContextFromAuth(auth, async (tx) =>
    tx
      .select({
        id: documents.id,
        name: documents.name,
        mimeType: documents.mimeType,
        storagePath: documents.storagePath,
        sizeBytes: documents.sizeBytes,
        contactId: documents.contactId,
      })
      .from(documents)
      .where(and(eq(documents.tenantId, auth.tenantId), eq(documents.id, documentId)))
      .limit(1),
  );

  if (!doc) {
    return { ok: false, error: "Dokument nenalezen." };
  }
  if (doc.mimeType !== "application/pdf") {
    return { ok: false, error: "Odeslat e-mailem lze zatím jen PDF." };
  }
  if (doc.sizeBytes != null && doc.sizeBytes > MAX_ATTACHMENT_BYTES) {
    return { ok: false, error: "Soubor je příliš velký pro odeslání e-mailem (max 20 MB)." };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY není nastaven." };
  }

  const admin = createAdminClient();
  const { data: blob, error: dlError } = await admin.storage.from("documents").download(doc.storagePath);
  if (dlError || !blob) {
    return { ok: false, error: "Soubor se nepodařilo načíst z úložiště." };
  }

  const buffer = Buffer.from(await blob.arrayBuffer());
  if (buffer.byteLength > MAX_ATTACHMENT_BYTES) {
    return { ok: false, error: "Soubor je příliš velký pro odeslání e-mailem (max 20 MB)." };
  }

  const mail = await loadAdvisorMailHeadersForCurrentUser();
  const { subject, html } = documentAttachmentEmailTemplate({ documentName: doc.name });
  const filename = safeAttachmentFilename(doc.name);

  try {
    const Resend = (await import("resend")).Resend;
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: mail.from,
      to,
      subject,
      html,
      attachments: [{ filename, content: buffer }],
      ...(mail.replyTo ? { replyTo: mail.replyTo } : {}),
    });

    if (error) {
      await logNotification({
        tenantId: auth.tenantId,
        contactId: doc.contactId ?? undefined,
        template: "document_email_attachment",
        subject,
        recipient: to,
        status: "failed",
        meta: { documentId, error: error.message },
      });
      return { ok: false, error: error.message };
    }

    await logAudit({
      tenantId: auth.tenantId,
      userId: auth.userId,
      action: "document_email_send",
      entityType: "document",
      entityId: documentId,
      meta: { recipientDomain: recipientDomain(to) },
    });

    await logNotification({
      tenantId: auth.tenantId,
      contactId: doc.contactId ?? undefined,
      template: "document_email_attachment",
      subject,
      recipient: to,
      status: "sent",
      meta: { documentId, documentName: doc.name },
    });

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Chyba odeslání.";
    await logNotification({
      tenantId: auth.tenantId,
      contactId: doc.contactId ?? undefined,
      template: "document_email_attachment",
      subject,
      recipient: to,
      status: "failed",
      meta: { documentId, error: msg },
    });
    return { ok: false, error: msg };
  }
}
