/**
 * Breakpoints aligned with Tailwind (sm: 640, md: 768, lg: 1024, xl: 1280).
 * Use for JS matchMedia; in CSS use Tailwind md:/lg: etc.
 */
export const MD_BREAKPOINT_PX = 768;
export const LG_BREAKPOINT_PX = 1024;

/** Media query: viewport is below md (mobile/tablet). */
export const mediaBelowMd = () => typeof window !== "undefined" && window.matchMedia(`(max-width: ${MD_BREAKPOINT_PX - 1}px)`);
/** Media query: viewport is md or above (desktop). */
export const mediaMdUp = () => typeof window !== "undefined" && window.matchMedia(`(min-width: ${MD_BREAKPOINT_PX}px)`);
/** Media query: viewport is below lg. */
export const mediaBelowLg = () => typeof window !== "undefined" && window.matchMedia(`(max-width: ${LG_BREAKPOINT_PX - 1}px)`);
