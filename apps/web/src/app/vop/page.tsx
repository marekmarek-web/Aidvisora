import { permanentRedirect } from "next/navigation";

/**
 * FL-2.3 — krátký alias `/vop` → `/terms`. Držíme ho z několika důvodů:
 * 1. Papírové materiály / QR kódy / e-maily odkazují na „VOP“ jako zkratku.
 * 2. Beta terms (`/beta-terms`) a DPA (`/dpa`) odkazují interně na `/vop`,
 *    kdyby se VOP někdy přejmenovávaly, stačí upravit jen jedno místo.
 * 3. Legal sign-off dokumentace partnerů má tvar `aidvisora.cz/vop` — kratší
 *    než canonical `/terms`.
 */
export const dynamic = "force-static";

export default function VopRedirect() {
  permanentRedirect("/terms");
}
