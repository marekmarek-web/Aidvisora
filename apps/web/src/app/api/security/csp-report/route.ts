import { NextResponse, type NextRequest } from "next/server";

/**
 * CSP Report endpoint. Prohlížeče sem posílají POST s `application/csp-report`
 * nebo `application/reports+json` při porušení CSP (v `Report-Only` módu).
 *
 * My CSP držíme v report-only módu min. 2 týdny od launche — zde jen
 * logujeme do stdout (Vercel logs) + Sentry `captureMessage`, abychom mohli
 * dohnat allowlist před přepnutím na enforcing režim.
 *
 * Odpověď vrátíme 204 No Content. Žádná auth — report poslaný anonymně.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CspReport = {
  "document-uri"?: string;
  "blocked-uri"?: string;
  "violated-directive"?: string;
  "effective-directive"?: string;
  "source-file"?: string;
  "status-code"?: number;
};

async function parseBody(request: NextRequest): Promise<unknown> {
  try {
    const text = await request.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const payload = await parseBody(request);
  let report: CspReport | null = null;
  if (payload && typeof payload === "object") {
    const maybeCsp = (payload as Record<string, unknown>)["csp-report"];
    if (maybeCsp && typeof maybeCsp === "object") {
      report = maybeCsp as CspReport;
    } else if (Array.isArray(payload) && payload.length > 0) {
      const first = payload[0] as Record<string, unknown> | undefined;
      const body = first && typeof first === "object" ? (first.body as Record<string, unknown> | undefined) : undefined;
      if (body && typeof body === "object") {
        report = {
          "document-uri": String(body["documentURL"] ?? ""),
          "blocked-uri": String(body["blockedURL"] ?? ""),
          "violated-directive": String(body["effectiveDirective"] ?? body["violatedDirective"] ?? ""),
          "effective-directive": String(body["effectiveDirective"] ?? ""),
          "source-file": String(body["sourceFile"] ?? ""),
          "status-code": typeof body["statusCode"] === "number" ? (body["statusCode"] as number) : undefined,
        };
      }
    }
  }

  if (report) {
    console.warn("[csp-report]", {
      doc: report["document-uri"],
      blocked: report["blocked-uri"],
      directive: report["violated-directive"] ?? report["effective-directive"],
      source: report["source-file"],
      ua: request.headers.get("user-agent")?.slice(0, 200),
    });
  }

  return new NextResponse(null, { status: 204 });
}

export async function GET() {
  return new NextResponse(null, { status: 204 });
}
