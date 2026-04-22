import { NextResponse, type NextRequest } from "next/server";
import { unsubscribeByToken } from "@/app/actions/unsubscribe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * RFC 8058 One-Click Unsubscribe endpoint.
 *
 * Gmail / Apple Mail / Outlook.com posílají POST s body
 * `List-Unsubscribe=One-Click` na URL v `List-Unsubscribe` headeru
 * (viz `@/lib/email/list-unsubscribe`).
 *
 * Očekávaný parameter: `?token=<opaque>`.
 * Respond 2xx = přijmuto. Nejednoznačné response provokuje retry.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const token =
    request.nextUrl.searchParams.get("token") ??
    (await readFormToken(request));
  if (!token) {
    return NextResponse.json({ ok: false, error: "missing_token" }, { status: 400 });
  }
  const result = await unsubscribeByToken(token);
  if (!result.ok) {
    // 200 i při chybě — podle spec máme potvrdit přijetí, aby se Gmail nezablokoval
    return NextResponse.json({ ok: false, error: result.error }, { status: 200 });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}

async function readFormToken(request: NextRequest): Promise<string | null> {
  try {
    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await request.text();
      const params = new URLSearchParams(text);
      return params.get("token");
    }
    if (contentType.includes("application/json")) {
      const json = (await request.json()) as { token?: string };
      return json.token ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

// Gmail / Apple někdy provedou HEAD probe.
export function HEAD(): NextResponse {
  return new NextResponse(null, { status: 200 });
}
