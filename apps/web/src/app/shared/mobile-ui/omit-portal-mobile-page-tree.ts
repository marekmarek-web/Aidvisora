/**
 * Mobile portal shell (`MobilePortalApp`) renders route UI client-side.
 * If we also mount `layout.tsx`'s `{children}` (the route's `page.tsx`), heavy client
 * pages duplicate (e.g. FinancialAnalysisPage + FinancialAnalysisWizardScreen) and
 * share global state — causing crashes. Omit the page tree when the shell owns the URL.
 */
export function shouldOmitPortalMobilePageTree(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return pathname === "/portal" || pathname.startsWith("/portal/");
}
