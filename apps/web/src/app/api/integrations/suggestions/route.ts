import { NextResponse } from "next/server";
import { getIntegrationApiAuth } from "../auth";
import { sendEmail } from "@/lib/email/send-email";

const INTERNAL_SUGGESTIONS_TO = process.env.INTERNAL_FEEDBACK_TO ?? "founders@aidvisora.cz";

function sanitize(value: unknown, maxLen = 2000): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLen);
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function POST(request: Request) {
  const authResult = await getIntegrationApiAuth(request);
  if (!authResult.ok) return authResult.response;
  const { userId, tenantId } = authResult.auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Neplatný požadavek." }, { status: 400 });
  }

  const payload = body as Record<string, unknown> | null;
  const name = sanitize(payload?.name, 200);
  const reason = sanitize(payload?.reason, 2000);
  const link = sanitize(payload?.link, 500);

  if (!name) {
    return NextResponse.json({ error: "Název integrace je povinný." }, { status: 400 });
  }

  const html = `
    <h2>Nový návrh integrace</h2>
    <p><strong>Název:</strong> ${esc(name)}</p>
    ${link ? `<p><strong>Odkaz:</strong> <a href="${esc(link)}">${esc(link)}</a></p>` : ""}
    ${reason ? `<p><strong>Popis:</strong></p><pre style="white-space:pre-wrap;font-family:inherit">${esc(reason)}</pre>` : ""}
    <hr />
    <p style="color:#888;font-size:12px">Tenant: ${esc(tenantId)} · User: ${esc(userId)}</p>
  `;

  const result = await sendEmail({
    to: INTERNAL_SUGGESTIONS_TO,
    subject: `[Aidvisora] Návrh integrace: ${name}`,
    html,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: "Odeslání se nezdařilo, zkuste to prosím znovu." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
