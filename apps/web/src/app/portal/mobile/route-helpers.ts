/**
 * Pure routing helpers used by the mobile portal shell.
 *
 * Extracted from `MobilePortalClient.tsx` so they can be unit-tested in
 * isolation without mounting the full React tree. No React imports, no DOM
 * access — every function is deterministic given its string input.
 */

export type TabId = "home" | "tasks" | "clients" | "pipeline" | "none";

/** Bottom navigation highlight only for primary tabs; other routes use "none". */
export function pathnameToBottomTab(pathname: string): TabId {
  if (pathname.startsWith("/portal/today")) return "home";
  if (pathname.startsWith("/portal/tasks")) return "tasks";
  if (pathname.startsWith("/portal/contacts")) return "clients";
  if (pathname.startsWith("/portal/pipeline")) return "pipeline";
  return "none";
}

/** True for routes with a dynamic segment (show back arrow, not hamburger). */
export function isDetailRoute(pathname: string): boolean {
  if (/^\/portal\/contacts\/[^/]+$/.test(pathname) && !pathname.endsWith("/new")) return true;
  if (/^\/portal\/households\/[^/]+$/.test(pathname)) return true;
  if (/^\/portal\/pipeline\/[^/]+$/.test(pathname)) return true;
  if (/^\/portal\/mindmap\/[^/]+$/.test(pathname)) return true;
  if (/^\/portal\/contracts\/review\/[^/]+$/.test(pathname)) return true;
  if (/^\/portal\/calculators\/[^/]+$/.test(pathname)) return true;
  if (pathname.startsWith("/portal/analyses/financial")) return true;
  if (pathname.startsWith("/portal/scan")) return true;
  return false;
}

/** Resolve the logical parent route for the back button (fallback only). */
export function resolveParentRoute(pathname: string): string {
  if (pathname.startsWith("/portal/analyses/financial")) return "/portal/analyses";
  if (/^\/portal\/contacts\/[^/]+/.test(pathname)) return "/portal/contacts";
  if (/^\/portal\/households\/[^/]+/.test(pathname)) return "/portal/households";
  if (/^\/portal\/pipeline\/[^/]+/.test(pathname)) return "/portal/pipeline";
  if (/^\/portal\/mindmap\/[^/]+/.test(pathname)) return "/portal/mindmap";
  if (/^\/portal\/contracts\/review\/[^/]+/.test(pathname)) return "/portal/contracts/review";
  if (/^\/portal\/calculators\/[^/]+/.test(pathname)) return "/portal/calculators";
  if (pathname.startsWith("/portal/scan")) return "/portal/documents";
  return "/portal/today";
}

export function parseContactIdFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/portal\/contacts\/([^/]+)/);
  return m?.[1] ?? null;
}

export function parseOpportunityIdFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/portal\/pipeline\/([^/]+)/);
  return m?.[1] ?? null;
}

export function parseHouseholdIdFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/portal\/households\/([^/]+)/);
  return m?.[1] ?? null;
}

/**
 * Decide whether a header "back" press should pop router history or replace
 * to a logical parent. Extracted so we can test the decision in isolation
 * without mocking `window.history` and `router`.
 *
 * @returns "back" when there's a prior entry we can pop, "replace" when we
 *   must replace the current entry with the parent route (cold-start /
 *   deep-link entry), with the target path included.
 */
export function decideHeaderBackAction(params: {
  pathname: string;
  historyLength: number;
}): { kind: "back" } | { kind: "replace"; target: string } {
  if (params.historyLength > 1) return { kind: "back" };
  const target = isDetailRoute(params.pathname)
    ? resolveParentRoute(params.pathname)
    : "/portal/today";
  return { kind: "replace", target };
}
