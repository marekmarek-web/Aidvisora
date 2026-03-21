import { NextResponse } from "next/server";
import { getIntegrationApiAuth } from "../../../integrations/auth";
import { getValidGmailAccessToken } from "@/lib/integrations/google-gmail-integration-service";
import {
  decodeMessageBody,
  extractHeader,
  getGmailThread,
  type GmailMessage,
} from "@/lib/integrations/google-gmail";

function mapThreadMessage(message: GmailMessage) {
  return {
    id: message.id,
    threadId: message.threadId,
    snippet: message.snippet ?? "",
    bodyHtml: decodeMessageBody(message),
    internalDate: message.internalDate,
    labelIds: message.labelIds ?? [],
    headers: {
      from: extractHeader(message, "From"),
      to: extractHeader(message, "To"),
      cc: extractHeader(message, "Cc"),
      subject: extractHeader(message, "Subject"),
      date: extractHeader(message, "Date"),
      messageId: extractHeader(message, "Message-Id"),
    },
  };
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

  try {
    const accessToken = await getValidGmailAccessToken(userId, tenantId);
    const thread = await getGmailThread(accessToken, id);
    const messages = (thread.messages ?? []).map(mapThreadMessage);
    return NextResponse.json({
      id: thread.id,
      snippet: thread.snippet ?? "",
      messages,
    });
  } catch (e) {
    const code = (e as Error & { code?: string }).code;
    if (code === "not_connected") {
      return NextResponse.json({ error: "Gmail není připojen" }, { status: 400 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
