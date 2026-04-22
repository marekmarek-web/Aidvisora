import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { AIDV_PROXY_AUTH_USER_HEADER } from "@/lib/auth/proxy-headers";
import { getPublicSupabaseKey } from "@/lib/supabase/get-public-supabase-key";
import {
  CLIENT_INVITE_QUERY_PARAM,
  LEGACY_CLIENT_INVITE_QUERY_PARAM,
  parseClientInviteTokenFromUrl,
} from "@/lib/auth/client-invite-url";
import { getKillSwitch } from "@/lib/ops/kill-switch";

const PRODUCTION_DOMAIN = "https://www.aidvisora.cz";

/**
 * B1.7 — maintenance mode gate. When `MAINTENANCE_MODE` kill-switch is on,
 * every user-facing route returns 503 with a static HTML body except for
 * ops lifelines (healthcheck, status page). Ops can bypass with
 * `x-maintenance-bypass: <secret>` header (compared against
 * `MAINTENANCE_BYPASS_SECRET` env).
 */
const MAINTENANCE_ALLOWLIST_EXACT = new Set<string>([
  "/status",
  "/api/health",
  "/api/healthcheck",
  "/maintenance",
]);

function isMaintenanceAllowlisted(pathname: string): boolean {
  if (MAINTENANCE_ALLOWLIST_EXACT.has(pathname)) return true;
  // Static assets, favicon, robots — leave untouched.
  if (pathname.startsWith("/_next/")) return true;
  if (pathname.startsWith("/api/auth/")) return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname === "/robots.txt") return true;
  if (pathname === "/sitemap.xml") return true;
  return false;
}

/**
 * Perf — seznam anonymních marketing rout, které **nepotřebují** Supabase
 * `auth.getUser()` v proxy. Skip auth path = rychlejší TTFB + statický CDN
 * cache. Auth gate pro `/portal`, `/client`, `/dashboard`, `/board` dál běží.
 */
const MARKETING_ANON_EXACT = new Set<string>([
  "/",
  "/pricing",
  "/bezpecnost",
  "/o-nas",
  "/kontakt",
  "/pro-brokery",
  "/subprocessors",
  "/terms",
  "/privacy",
  "/cookies",
  "/demo",
  "/beta-terms",
  "/status",
  "/sitemap.xml",
  "/robots.txt",
  "/manifest.webmanifest",
  "/site.webmanifest",
  "/favicon.ico",
  "/favicon.png",
  "/apple-touch-icon.png",
  "/aidvisora-logo-big.png",
  "/gdpr",
  "/vop",
  "/dpa",
]);

function isAnonymousMarketingRoute(pathname: string): boolean {
  if (MARKETING_ANON_EXACT.has(pathname)) return true;
  if (pathname.startsWith("/legal/")) return true;
  if (pathname.startsWith("/logos/")) return true;
  if (pathname.startsWith("/icons/")) return true;
  if (pathname.startsWith("/report-assets/")) return true;
  return false;
}

function maintenanceResponse(): NextResponse {
  const body = `<!doctype html>
<html lang="cs">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Aidvisora — údržba</title>
    <style>
      body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#060918;color:#e2e8f0;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;text-align:center}
      main{max-width:520px}
      h1{font-size:28px;margin:0 0 12px;color:#fff}
      p{color:#94a3b8;line-height:1.6;font-size:15px}
      a{color:#6366f1;text-decoration:none}
    </style>
  </head>
  <body>
    <main>
      <h1>Probíhá údržba</h1>
      <p>Aidvisora je dočasně nedostupná kvůli plánované nebo havarijní údržbě. Omlouváme se — vrátíme se během chvíle. Stav služeb: <a href="/status">status page</a>.</p>
    </main>
  </body>
</html>`;
  return new NextResponse(body, {
    status: 503,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Retry-After": "300",
    },
  });
}

async function maintenanceGate(request: NextRequest): Promise<NextResponse | null> {
  const pathname = request.nextUrl.pathname;
  if (isMaintenanceAllowlisted(pathname)) return null;
  const secret = process.env.MAINTENANCE_BYPASS_SECRET?.trim();
  if (secret) {
    const header = request.headers.get("x-maintenance-bypass")?.trim();
    if (header && header === secret) return null;
  }
  const enabled = await getKillSwitch("MAINTENANCE_MODE", false);
  if (!enabled) return null;
  return maintenanceResponse();
}

/** Legacy Vercel preview hostnames → redirect traffic to canonical production (comma-separated in env). */
function legacyVercelHosts(): string[] {
  const raw = process.env.AIDVISORA_LEGACY_VERCEL_HOSTS?.trim();
  if (raw) return raw.split(",").map((s) => s.trim()).filter(Boolean);
  return ["advisorcrm-web.vercel.app"];
}

export async function proxy(request: NextRequest) {
  const normalizeNext = (raw: string | null, fallback: string) => {
    if (!raw || !raw.startsWith("/")) return fallback;
    if (raw === "/" || raw === "/prihlaseni" || raw === "/login" || raw === "/register") return fallback;
    return raw;
  };

  const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
  const host = request.headers.get("host") ?? "";
  const isAuthCallbackWithCode =
    request.nextUrl.pathname === "/auth/callback" && request.nextUrl.searchParams.has("code");
  const isGoogleOAuthCallbackWithCode =
    request.nextUrl.pathname.startsWith("/api/integrations/") &&
    request.nextUrl.pathname.endsWith("/callback") &&
    request.nextUrl.searchParams.has("code");
  if (legacyVercelHosts().some((h) => host.includes(h)) && !isAuthCallbackWithCode && !isGoogleOAuthCallbackWithCode) {
    const path = request.nextUrl.pathname === "/" && request.nextUrl.searchParams.get("code") ? "/auth/callback" : request.nextUrl.pathname;
    const url = new URL(path + request.nextUrl.search, PRODUCTION_DOMAIN);
    return NextResponse.redirect(url);
  }

  const maintenance = await maintenanceGate(request);
  if (maintenance) return maintenance;

  if (request.nextUrl.pathname === "/" && request.nextUrl.searchParams.get("error_code") === "otp_expired") {
    const url = request.nextUrl.clone();
    url.pathname = "/prihlaseni";
    url.searchParams.set("error", "otp_expired");
    url.searchParams.delete("error_code");
    url.searchParams.delete("error_description");
    return NextResponse.redirect(url);
  }
  if (request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/prihlaseni";
    return NextResponse.redirect(url);
  }
  if (request.nextUrl.pathname === "/register") {
    const url = request.nextUrl.clone();
    url.pathname = "/prihlaseni";
    const inviteToken = parseClientInviteTokenFromUrl(request.nextUrl.searchParams);
    if (inviteToken) {
      url.searchParams.delete(LEGACY_CLIENT_INVITE_QUERY_PARAM);
      url.searchParams.delete(CLIENT_INVITE_QUERY_PARAM);
      url.searchParams.set(CLIENT_INVITE_QUERY_PARAM, inviteToken);
      url.searchParams.delete("register");
    } else {
      url.searchParams.delete(LEGACY_CLIENT_INVITE_QUERY_PARAM);
      url.searchParams.delete(CLIENT_INVITE_QUERY_PARAM);
      url.searchParams.set("register", "1");
    }
    return NextResponse.redirect(url);
  }

  // Perf — anonymní marketing routy skip Supabase auth.getUser() (šetří TTFB).
  // HomePage `page.tsx` se navíc staticky prerendruje (viz `dynamic = "force-static"`),
  // takže proxy tu má běžet minimálně.
  if (isAnonymousMarketingRoute(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const pathname = request.nextUrl.pathname;
  const isContractsApi = pathname.startsWith("/api/contracts");
  const isAiAssistantApi =
    pathname.startsWith("/api/ai/assistant") ||
    pathname === "/api/ai/dashboard-summary" ||
    pathname === "/api/ai/team-summary" ||
    pathname === "/api/ai/client-request-brief";
  const isDocumentsReviewApi = pathname.startsWith("/api/documents/review");
  const isCalendarApi = pathname.startsWith("/api/calendar");
  const isDriveApi = pathname.startsWith("/api/drive");
  const isGmailApi = pathname.startsWith("/api/gmail");
  const isIntegrationsApi = pathname.startsWith("/api/integrations");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublicKey = getPublicSupabaseKey();

  if (
    (isContractsApi ||
      isAiAssistantApi ||
      isDocumentsReviewApi ||
      isCalendarApi ||
      isDriveApi ||
      isGmailApi ||
      isIntegrationsApi) &&
    supabaseUrl &&
    supabasePublicKey
  ) {
    const response = NextResponse.next({ request });
    const supabase = createServerClient(supabaseUrl, supabasePublicKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    const { data: { user } } = await supabase.auth.getUser();
    const requestHeaders = new Headers(request.headers);
    if (user) {
      requestHeaders.set("x-user-id", user.id);
    }

    const isDebugAuth = pathname === "/api/contracts/debug-auth";
    if (isDebugAuth) {
      return NextResponse.next({ request: { headers: requestHeaders } });
    }
    if (!user) {
      const isDev = process.env.NODE_ENV === "development";
      const devUserId = process.env.NEXT_PUBLIC_DEV_CONTRACTS_USER_ID ?? process.env.DEV_CONTRACTS_USER_ID;
      const allowDevBypass = !isProduction && isDev && process.env.VERCEL_ENV !== "production" && devUserId?.trim();
      if (allowDevBypass) {
        requestHeaders.set("x-user-id", devUserId!.trim());
        return NextResponse.next({ request: { headers: requestHeaders } });
      }
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (!isProduction && process.env.VERCEL_ENV !== "production" && process.env.NEXT_PUBLIC_SKIP_AUTH === "true") {
    const requestHeaders = new Headers(request.headers);
    if (pathname.startsWith("/client")) {
      requestHeaders.set("x-demo-client-zone", "1");
    }
    if (pathname.startsWith("/portal") || pathname.startsWith("/client")) {
      requestHeaders.set("x-pathname", pathname);
    }
    return NextResponse.next({ request: { headers: requestHeaders } });
  }
  if (!supabaseUrl || !supabasePublicKey) {
    return NextResponse.next();
  }

  const forwardHeaders = new Headers(request.headers);
  forwardHeaders.delete(AIDV_PROXY_AUTH_USER_HEADER);
  if (pathname.startsWith("/portal") || pathname.startsWith("/client")) {
    forwardHeaders.set("x-pathname", pathname);
  }
  const response = NextResponse.next({ request: { headers: forwardHeaders } });
  const supabase = createServerClient(supabaseUrl, supabasePublicKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    forwardHeaders.set(AIDV_PROXY_AUTH_USER_HEADER, user.id);
  }
  const isDashboard = request.nextUrl.pathname.startsWith("/dashboard");
  const isClientZone = request.nextUrl.pathname.startsWith("/client");
  const isBoard = request.nextUrl.pathname.startsWith("/board");
  const isPortal = request.nextUrl.pathname.startsWith("/portal");

  if ((isDashboard || isClientZone || isBoard || isPortal) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/prihlaseni";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  if (request.nextUrl.pathname === "/login" && user) {
    const url = request.nextUrl.clone();
    url.pathname = normalizeNext(request.nextUrl.searchParams.get("next"), "/portal/today");
    url.searchParams.delete("next");
    return NextResponse.redirect(url);
  }
  if (request.nextUrl.pathname === "/prihlaseni" && user) {
    const errorParam = request.nextUrl.searchParams.get("error");
    const hasInviteToken = parseClientInviteTokenFromUrl(request.nextUrl.searchParams) !== null;
    if (
      hasInviteToken ||
      errorParam === "auth_error" ||
      errorParam === "database_error" ||
      errorParam === "client_no_access"
    ) {
      return NextResponse.next({ request });
    }
    const url = request.nextUrl.clone();
    url.pathname = normalizeNext(request.nextUrl.searchParams.get("next"), "/portal/today");
    url.searchParams.delete("next");
    return NextResponse.redirect(url);
  }
  if (request.nextUrl.pathname.startsWith("/prihlaseni/nastavit-heslo")) {
    const out = NextResponse.next({ request: { headers: forwardHeaders } });
    for (const c of response.cookies.getAll()) {
      out.cookies.set(c.name, c.value);
    }
    return out;
  }

  const out = NextResponse.next({ request: { headers: forwardHeaders } });
  for (const c of response.cookies.getAll()) {
    out.cookies.set(c.name, c.value);
  }
  return out;
}

export const config = {
  matcher: [
    "/",
    "/prihlaseni",
    "/prihlaseni/:path*",
    "/dashboard/:path*",
    "/client/:path*",
    "/board/:path*",
    "/portal/:path*",
    "/api/contracts/:path*",
    "/api/ai/assistant/:path*",
    "/api/ai/dashboard-summary",
    "/api/ai/team-summary",
    "/api/ai/client-request-brief",
    "/api/documents/review/:path*",
    "/api/calendar/:path*",
    "/api/drive/:path*",
    "/api/gmail/:path*",
    "/api/integrations/:path*",
    "/login",
    "/register",
  ],
};
