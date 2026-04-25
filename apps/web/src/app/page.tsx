/**
 * Hlavní (landing) stránka Aidvisora – marketingová stránka před přihlášením.
 * Přihlášení/registrace je na /prihlaseni. V demo režimu (NEXT_PUBLIC_SKIP_AUTH=true) přesměruje rovnou na /portal.
 *
 * Auth-based redirect pro už přihlášeného uživatele řeší proxy (AIDV header)
 * i `<NativeOAuthDeepLinkBridge />`. Landing route zůstává bez auth dat a bez
 * request-time závislostí, aby byla jednoduchá a stabilní i v dev režimu.
 */
import { redirect } from "next/navigation";
import PremiumLandingPage from "./components/PremiumLandingPage";
import { LANDING_FAQS } from "@/data/landing-faq";

/**
 * Dev: `force-dynamic` — vždy aktuální markup z editoru (žádné „zaseknuté“ statické HTML).
 * Prod: ISR; kratší interval, ať se po deployi rychle projeví změny na doméně.
 */
export const dynamic = process.env.NODE_ENV === "development" ? "force-dynamic" : "force-static";
export const revalidate = process.env.NODE_ENV === "development" ? 0 : 300;

function LandingFaqJsonLd() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: LANDING_FAQS.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export default function HomePage() {
  if (process.env.NEXT_PUBLIC_SKIP_AUTH === "true") {
    redirect("/portal");
  }

  return (
    <>
      <LandingFaqJsonLd />
      <PremiumLandingPage />
    </>
  );
}
