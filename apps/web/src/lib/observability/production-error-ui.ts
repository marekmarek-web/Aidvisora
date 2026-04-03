import * as Sentry from "@sentry/nextjs";

/**
 * User-visible Czech copy for production errors where Next.js omits details
 * or surfaces generic RSC failure messages.
 */
export function getPortalFriendlyErrorMessage(error: Error & { digest?: string }): string {
  const isProd = process.env.NODE_ENV === "production";
  const msg = (error.message ?? "").trim();
  const isGenericProdMessage =
    isProd &&
    (msg.includes("omitted in production") ||
      msg.includes("digest") ||
      msg.includes("Server Components") ||
      msg.includes("server components") ||
      !msg);
  const isServerRenderProd =
    isProd && (msg.includes("Server Components") || msg.includes("server components"));

  if (isServerRenderProd) {
    return "Načtení portálu selhalo — často jde o nesoulad databáze s nasazenou verzí (např. chybějící migrace). Zkuste znovu; pokud to trvá, kontaktujte správce nebo spusťte migrace podle provozní příručky.";
  }
  if (isGenericProdMessage) {
    return "Došlo k chybě na serveru nebo při vykreslení stránky. Zkuste znovu nebo se vraťte na přehled portálu.";
  }
  return msg || "Nastala neočekávaná chyba.";
}

export type AppErrorCaptureContext = {
  boundary: string;
  /** Current path when available (client). */
  route?: string;
  digest?: string;
  componentStack?: string | null;
  /** Další Sentry tagy (např. `{ app_zone: "client" }` pro filtr v dashboardu). */
  tags?: Record<string, string>;
};

/**
 * Report to Sentry with stable tags for triage. Safe no-op if Sentry is unavailable.
 */
export function captureAppError(error: unknown, context: AppErrorCaptureContext): void {
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    Sentry.withScope((scope) => {
      scope.setTag("error_boundary", context.boundary);
      if (context.tags) {
        for (const [k, v] of Object.entries(context.tags)) {
          scope.setTag(k, v);
        }
      }
      if (context.route) scope.setTag("route", context.route);
      if (context.componentStack) {
        scope.setContext("react", { componentStack: context.componentStack });
      }
      const digest = context.digest ?? (err as Error & { digest?: string }).digest;
      if (digest) scope.setTag("digest", String(digest));
      Sentry.captureException(err);
    });
  } catch {
    /* ignore */
  }
}
