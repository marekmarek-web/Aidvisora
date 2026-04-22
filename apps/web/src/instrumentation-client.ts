import * as Sentry from "@sentry/nextjs";
import { resolveSentryTracesSampleRate } from "@/lib/sentry-traces-sample-rate";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();

/**
 * Perf — anonymní marketing routy (`/`, `/pricing`, `/bezpecnost`, `/legal/*`, …)
 * nenačítají Session Replay integraci. Na těchto URL:
 *   - nemáme přihlášeného uživatele, replay by stejně nic užitečného neposkytl,
 *   - šetří ~50-80 KB gzip (Sentry replay bundle) na first-paint kritické cestě,
 *   - sampling je pak 0/0, i když by zachytil runtime error.
 * Na `/portal` a `/client` (authenticated app) replay dál běží pro on-error capture.
 */
const MARKETING_REPLAY_SKIP_PREFIXES = [
  "/pricing",
  "/bezpecnost",
  "/subprocessors",
  "/terms",
  "/privacy",
  "/cookies",
  "/o-nas",
  "/kontakt",
  "/pro-brokery",
  "/demo",
  "/beta-terms",
  "/legal",
  "/status",
  "/gdpr",
  "/vop",
  "/dpa",
];

function isMarketingRoute(pathname: string): boolean {
  if (pathname === "/") return true;
  return MARKETING_REPLAY_SKIP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

if (dsn) {
  const sentryEnvironment =
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT?.trim() ?? process.env.NODE_ENV;
  const isProduction = sentryEnvironment === "production";

  const currentPathname = typeof window !== "undefined" ? window.location.pathname : "/";
  const skipReplayForMarketing = isMarketingRoute(currentPathname);

  /**
   * B2.17 — ePrivacy: bez cookie consentu neběží Session Replay v produkci.
   * V production vzorkujeme pouze session replay při erroru (1 %); běžné
   * session replaye jsou vypnuté. V non-production (dev/preview) držíme
   * 10 % baseline + 100 % on error pro ladění.
   *
   * Post-launch rozšíření: po dodání CMP (consent management) zvýšit
   * `replaysSessionSampleRate` po opt-inu, nikdy bez něj.
   *
   * Perf — na marketing routách replay vypnut kompletně (sampling + integrace).
   */
  const replaysSessionSampleRate = skipReplayForMarketing ? 0 : isProduction ? 0 : 0.1;
  const replaysOnErrorSampleRate = skipReplayForMarketing ? 0 : isProduction ? 0.1 : 1.0;

  Sentry.init({
    dsn,
    environment: sentryEnvironment,
    sendDefaultPii: process.env.NODE_ENV !== "production",
    tracesSampleRate: skipReplayForMarketing
      ? 0
      : resolveSentryTracesSampleRate("browser"),
    replaysSessionSampleRate,
    replaysOnErrorSampleRate,
    enableLogs: true,
    debug: process.env.NEXT_PUBLIC_SENTRY_DEBUG === "true",
    // Perf — na marketingu replay integraci vůbec nepřipojujeme (nejenom sampling).
    // Ušetří ~50-80 KB gzip z landing page bundle.
    integrations: skipReplayForMarketing ? [] : [Sentry.replayIntegration()],
    ignoreErrors: [/has no method ['"]updateFrom['"]/, /sentry\/scripts\//i],
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
