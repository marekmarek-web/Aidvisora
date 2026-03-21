/**
 * Gmail API client (no SDK, fetch only).
 */

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

export type GmailMessage = {
  id: string;
  threadId: string;
  snippet?: string;
  internalDate?: string;
  labelIds?: string[];
  payload?: {
    headers?: { name: string; value: string }[];
    mimeType?: string;
    body?: { data?: string; size?: number };
    parts?: GmailMessagePart[];
  };
};

export type GmailMessagePart = {
  mimeType?: string;
  body?: { data?: string; size?: number };
  parts?: GmailMessagePart[];
};

export type GmailThread = {
  id: string;
  snippet?: string;
  messages?: GmailMessage[];
};

export type GmailLabel = {
  id: string;
  name: string;
  type?: "system" | "user";
  messageListVisibility?: string;
  labelListVisibility?: string;
};

export type GmailAttachment = {
  filename: string;
  mimeType: string;
  dataBase64: string;
};

export type GmailMessageList = {
  messages?: { id: string; threadId: string }[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
};

async function gmailRequest<T>(
  accessToken: string,
  method: string,
  path: string,
  body?: object
): Promise<T> {
  const url = path.startsWith("http") ? path : `${GMAIL_API}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
  const opts: RequestInit = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail API ${method} ${path}: ${res.status} ${err}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function listGmailMessages(
  accessToken: string,
  opts: { query?: string; maxResults?: number; pageToken?: string } = {}
): Promise<GmailMessageList> {
  const params = new URLSearchParams();
  if (opts.query) params.set("q", opts.query);
  params.set("maxResults", String(opts.maxResults ?? 20));
  if (opts.pageToken) params.set("pageToken", opts.pageToken);
  return gmailRequest<GmailMessageList>(accessToken, "GET", `/messages?${params.toString()}`);
}

export async function getGmailMessage(
  accessToken: string,
  messageId: string,
  format: "full" | "metadata" | "minimal" = "full"
): Promise<GmailMessage> {
  return gmailRequest<GmailMessage>(
    accessToken,
    "GET",
    `/messages/${encodeURIComponent(messageId)}?format=${format}`
  );
}

export async function listGmailThreads(
  accessToken: string,
  opts: { query?: string; maxResults?: number; pageToken?: string } = {}
): Promise<{ threads?: { id: string; snippet?: string }[]; nextPageToken?: string }> {
  const params = new URLSearchParams();
  if (opts.query) params.set("q", opts.query);
  params.set("maxResults", String(opts.maxResults ?? 20));
  if (opts.pageToken) params.set("pageToken", opts.pageToken);
  return gmailRequest(accessToken, "GET", `/threads?${params.toString()}`);
}

export async function getGmailThread(
  accessToken: string,
  threadId: string
): Promise<GmailThread> {
  return gmailRequest<GmailThread>(
    accessToken,
    "GET",
    `/threads/${encodeURIComponent(threadId)}?format=full`
  );
}

function buildRfc2822Message(opts: {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  replyToMessageId?: string;
  attachments?: GmailAttachment[];
}): string {
  const lines: string[] = [];
  lines.push(`To: ${opts.to}`);
  if (opts.cc) lines.push(`Cc: ${opts.cc}`);
  if (opts.bcc) lines.push(`Bcc: ${opts.bcc}`);
  lines.push(`Subject: =?UTF-8?B?${Buffer.from(opts.subject).toString("base64")}?=`);
  lines.push("Content-Type: text/html; charset=UTF-8");
  lines.push("MIME-Version: 1.0");
  if (opts.replyToMessageId) {
    lines.push(`In-Reply-To: ${opts.replyToMessageId}`);
    lines.push(`References: ${opts.replyToMessageId}`);
  }
  lines.push("");
  lines.push(opts.body);
  return lines.join("\r\n");
}

function toBase64Url(raw: Buffer): string {
  return raw
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function normalizeAttachmentBase64(value: string): string {
  const normalized = value.includes(",") ? value.split(",").pop() ?? value : value;
  return normalized.replace(/\s/g, "");
}

function buildMimeWithAttachments(opts: {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  replyToMessageId?: string;
  attachments: GmailAttachment[];
}): Buffer {
  const boundary = `----AidvisoraBoundary${Date.now()}`;
  const headers: string[] = [
    `To: ${opts.to}`,
  ];
  if (opts.cc) headers.push(`Cc: ${opts.cc}`);
  if (opts.bcc) headers.push(`Bcc: ${opts.bcc}`);
  headers.push(`Subject: =?UTF-8?B?${Buffer.from(opts.subject).toString("base64")}?=`);
  headers.push("MIME-Version: 1.0");
  headers.push(`Content-Type: multipart/mixed; boundary=\"${boundary}\"`);
  if (opts.replyToMessageId) {
    headers.push(`In-Reply-To: ${opts.replyToMessageId}`);
    headers.push(`References: ${opts.replyToMessageId}`);
  }
  headers.push("");
  headers.push(`--${boundary}`);
  headers.push("Content-Type: text/html; charset=UTF-8");
  headers.push("Content-Transfer-Encoding: 7bit");
  headers.push("");
  headers.push(opts.body);

  const chunks: Buffer[] = [Buffer.from(headers.join("\r\n") + "\r\n", "utf-8")];
  for (const attachment of opts.attachments) {
    const filename = attachment.filename || "attachment";
    const mimeType = attachment.mimeType || "application/octet-stream";
    const data = Buffer.from(normalizeAttachmentBase64(attachment.dataBase64), "base64");
    const partHeaders = [
      `--${boundary}`,
      `Content-Type: ${mimeType}; name=\"${filename}\"`,
      `Content-Disposition: attachment; filename=\"${filename}\"`,
      "Content-Transfer-Encoding: base64",
      "",
      data.toString("base64"),
      "",
    ].join("\r\n");
    chunks.push(Buffer.from(partHeaders, "utf-8"));
  }
  chunks.push(Buffer.from(`--${boundary}--`, "utf-8"));
  return Buffer.concat(chunks);
}

export async function sendGmailMessage(
  accessToken: string,
  opts: {
    to: string;
    subject: string;
    body: string;
    cc?: string;
    bcc?: string;
    replyToMessageId?: string;
    threadId?: string;
    attachments?: GmailAttachment[];
  }
): Promise<GmailMessage> {
  const hasAttachments = (opts.attachments?.length ?? 0) > 0;
  const rawBuffer = hasAttachments
    ? buildMimeWithAttachments({
        to: opts.to,
        subject: opts.subject,
        body: opts.body,
        cc: opts.cc,
        bcc: opts.bcc,
        replyToMessageId: opts.replyToMessageId,
        attachments: opts.attachments ?? [],
      })
    : Buffer.from(buildRfc2822Message(opts), "utf-8");
  const encoded = toBase64Url(rawBuffer);
  const payload: Record<string, string> = { raw: encoded };
  if (opts.threadId) payload.threadId = opts.threadId;
  return gmailRequest<GmailMessage>(accessToken, "POST", "/messages/send", payload);
}

export async function listGmailLabels(accessToken: string): Promise<GmailLabel[]> {
  const result = await gmailRequest<{ labels?: GmailLabel[] }>(accessToken, "GET", "/labels");
  return result.labels ?? [];
}

export async function modifyGmailMessage(
  accessToken: string,
  messageId: string,
  opts: { addLabelIds?: string[]; removeLabelIds?: string[] }
): Promise<GmailMessage> {
  return gmailRequest<GmailMessage>(
    accessToken,
    "POST",
    `/messages/${encodeURIComponent(messageId)}/modify`,
    {
      addLabelIds: opts.addLabelIds ?? [],
      removeLabelIds: opts.removeLabelIds ?? [],
    }
  );
}

export async function trashGmailMessage(
  accessToken: string,
  messageId: string
): Promise<GmailMessage> {
  return gmailRequest<GmailMessage>(
    accessToken,
    "POST",
    `/messages/${encodeURIComponent(messageId)}/trash`
  );
}

export async function deleteGmailMessage(
  accessToken: string,
  messageId: string
): Promise<void> {
  await gmailRequest<void>(
    accessToken,
    "DELETE",
    `/messages/${encodeURIComponent(messageId)}`
  );
}

export async function getGmailAttachment(
  accessToken: string,
  messageId: string,
  attachmentId: string
): Promise<{ data: string; size: number }> {
  return gmailRequest<{ data: string; size: number }>(
    accessToken,
    "GET",
    `/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`
  );
}

export function extractHeader(
  message: GmailMessage,
  name: string
): string | undefined {
  return message.payload?.headers?.find(
    (h) => h.name.toLowerCase() === name.toLowerCase()
  )?.value;
}

function findBodyData(parts?: GmailMessagePart[]): string | undefined {
  if (!parts) return undefined;
  for (const part of parts) {
    if (part.mimeType === "text/html" && part.body?.data) return part.body.data;
    if (part.parts) {
      const nested = findBodyData(part.parts);
      if (nested) return nested;
    }
  }
  for (const part of parts) {
    if (part.mimeType === "text/plain" && part.body?.data) return part.body.data;
    if (part.parts) {
      const nested = findBodyData(part.parts);
      if (nested) return nested;
    }
  }
  return undefined;
}

export function decodeMessageBody(message: GmailMessage): string {
  let data = message.payload?.body?.data;
  if (!data && message.payload?.parts) {
    data = findBodyData(message.payload.parts);
  }
  if (!data) return "";
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}
