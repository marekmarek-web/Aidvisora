/**
 * Hlavní (landing) stránka Aidvisora – marketingová stránka před přihlášením.
 * Přihlášení/registrace je na /prihlaseni. V demo režimu (NEXT_PUBLIC_SKIP_AUTH=true) přesměruje rovnou na /portal.
 *
 * Perf — `dynamic = "force-static"` + `revalidate = 3600` — landing HTML jede
 * z Vercel CDN (žádné `headers()`, `cookies()`, `getUser()`). Auth-based redirect
 * pro už přihlášeného uživatele řeší proxy (AIDV header) i `<NativeOAuthDeepLinkBridge />`
 * – ale na anonymní marketing routě proxy auth path skip, takže static je bezpečné.
 */
import { redirect } from "next/navigation";
import nextDynamic from "next/dynamic";

export const dynamic = "force-static";
export const revalidate = 3600;

const PremiumLandingPage = nextDynamic(() => import("./components/PremiumLandingPage"), {
  loading: () => (
    <div className="min-h-[40vh] flex items-center justify-center text-slate-500 text-sm" aria-busy="true">
      Načítám…
    </div>
  ),
});
import { LANDING_FAQS } from "@/data/landing-faq";

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
