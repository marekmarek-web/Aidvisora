import { permanentRedirect } from "next/navigation";

/**
 * FL-2.3 — alias `/dpa` → `/legal/zpracovatelska-smlouva` (ČJ kanonický slug).
 * Existuje pro krátký marketing/legal odkaz, který používáme v e-mailech
 * a v beta-terms / onboarding textech.
 */
export const dynamic = "force-static";

export default function DpaRedirect() {
  permanentRedirect("/legal/zpracovatelska-smlouva");
}
