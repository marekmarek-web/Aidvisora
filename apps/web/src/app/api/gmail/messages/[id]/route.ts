import { NextResponse } from "next/server";
import { getIntegrationApiAuth } from "../../../integrations/auth";
import { getValidGmailAccessToken } from "@/lib/integrations/google-gmail-integration-service";
import {
  decodeMessageBody,
  extractHeader,
  getGmailAttachment,
  getGmailMessage,
  type GmailMessage,
  type GmailMessagePart,
} from "@/lib/integrations/google-gmail";

type AttachmentMeta = {
  partId?: string;
  mimeType?: string;
  filename: string;
  size?: number;
  attachmentId?: string;
  inline?: boolean;
};

function collectAttachments(parts?: GmailMessagePart[], out: AttachmentMeta[] = []): AttachmentMeta[] {
  if (!parts) return out;
  for (const part of parts) {
    const body = part.body as { attachmentId?: string; size?: number } | undefined;
    const filename = (part as { filename?: string }).filename ?? "";
    if (body?.attachmentId || filename) {
      out.push({
        partId: (part as { partId?: string }).partId,
        mimeType: part.mimeType,
        filename: filename || "attachment",
        size: body?.size,
        attachmentId: body?.attachmentId,
        inline: (part as { headers?: { name: string; value: string }[] }).headers?.some(
          (h) => h.name.toLowerCase() === "content-disposition" && h.value.toLowerCase().includes("inline")
        ),
      });
    }
    if (part.parts?.length) collectAttachments(part.parts, out);
  }
  return out;
}

function decodeAttachmentData(data?: string): Buffer | null {
  if (!data) return null;
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64");
}

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authResult = await getIntegrationApiAuth(request);
  if (!authResult.ok) return authResult.response;
  const { userId, tenantId } = authResult.auth;
  const { id } = await context.params;
  const includeAttachments = new URL(request.url).searchParams.get("includeAttachments") === "true";

  try {
    const accessToken = await getValidGmailAccessToken(userId, tenantId);
    const message = await getGmailMessage(accessToken, id, "full");
    const attachments = collectAttachments(message.payload?.parts);

    let resolvedAttachments: Array<AttachmentMeta & { contentBase64?: string }> = attachments;
    if (includeAttachments) {
      resolvedAttachments = await Promise.all(
        attachments.map(async (att) => {
          if (!att.attachmentId) return att;
          try {
            const payload = await getGmailAttachment(accessToken, id, att.attachmentId);
            const decoded = decodeAttachmentData(payload.data);
            return { ...att, contentBase64: decoded?.toString("base64") };
          } catch {
            return att;
          }
        })
      );
    }

    return NextResponse.json({
      id: message.id,
      threadId: message.threadId,
      snippet: message.snippet ?? "",
      bodyHtml: decodeMessageBody(message),
      headers: {
        from: extractHeader(message, "From"),
        to: extractHeader(message, "To"),
        cc: extractHeader(message, "Cc"),
        bcc: extractHeader(message, "Bcc"),
        subject: extractHeader(message, "Subject"),
        date: extractHeader(message, "Date"),
      },
      internalDate: message.internalDate,
      labelIds: message.labelIds ?? [],
      attachments: resolvedAttachments,
      raw: message as GmailMessage,
    });
  } catch (e) {
    const code = (e as Error & { code?: string }).code;
    if (code === "not_connected") {
      return NextResponse.json({ error: "Gmail není připojen" }, { status: 400 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
