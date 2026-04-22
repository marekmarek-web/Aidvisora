import type { Metadata, Viewport } from "next";
import { Source_Sans_3, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import "../styles/aidvisora-theme.css";
/*
 * Perf — `aidvisora-components.css` (897 ř., ~40 KB unminified) definuje
 * `.wp-card`, `.wp-table`, `.wp-popover`, `.wp-input`, … třídy používané JEN
 * v portal/client/board/dashboard UI. Marketing (landing, pricing, legal)
 * je nepoužívá. Import přesunut do příslušných layoutů, aby anonymní
 * návštěvník nestahoval CSS, který neuvidí.
 */
import { TooltipBlurListener } from "./components/TooltipBlurListener";
import { NativeOAuthDeepLinkBridge } from "./components/NativeOAuthDeepLinkBridge";
import { NativeRuntime } from "./shared/mobile-ui/native-runtime";
import { ConfirmProvider } from "./components/ConfirmDialog";
import { CookieNoticeBanner } from "./components/CookieNoticeBanner";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { DeferredIdleMount } from "./components/DeferredIdleMount";

const sourceSans = Source_Sans_3({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600", "700"],
  variable: "--font-primary",
  display: "swap",
  preload: true,
});

// Perf — redukce na 3 váhy (místo původních 4: 500/600/700/800). 800 se v landingu
// nepoužívá; zbylé váhy pokryjí nav, nadpisy i Pro badge. Každá váha = 1 WOFF2
// request (~15-25 KB), takže odstranění 800 šetří ~1 font request na první paint.
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
  variable: "--font-jakarta",
  display: "swap",
  preload: true,
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://aidvisora.cz";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  manifest: "/site.webmanifest",
  title: "Aidvisora – pracovní systém pro finanční poradce",
  description:
    "CRM, klientská zóna a workflow pro finanční poradce. Klienti, dokumenty, schůzky a úkoly na jednom místě — méně administrativy, více přehledu.",
  icons: {
    /** Tab favicon: PNG only so browsers do not pick legacy WebP tiles with baked-in padding. */
    icon: [{ url: "/favicon.png", sizes: "512x512", type: "image/png" }],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Aidvisora – pracovní systém pro finanční poradce",
    description:
      "CRM, klientská zóna a workflow pro finanční poradce. Klienti, dokumenty, schůzky a úkoly na jednom místě.",
    type: "website",
    locale: "cs_CZ",
    url: siteUrl,
    siteName: "Aidvisora",
    // B3.8 — social share obrázek. Prozatím použijeme existující brand logo;
    // dedikovaný 1200×630 `og-default.png` přidáme v launch-polish batchi,
    // jakmile bude hotový z brand designu.
    images: [
      {
        url: "/aidvisora-logo-big.png",
        width: 1200,
        height: 630,
        alt: "Aidvisora – pracovní systém pro finanční poradce",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Aidvisora – pracovní systém pro finanční poradce",
    description:
      "CRM, klientská zóna a workflow pro finanční poradce. Klienti, dokumenty, schůzky a úkoly na jednom místě.",
    images: ["/aidvisora-logo-big.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // B3.8 — accessibility: nechávat `maximumScale` / `userScalable` na defaultech,
  // aby uživatel s horším zrakem (nebo v mobilním zoomu na legal stránkách) mohl
  // pinch-to-zoomovat. Dříve jsme měli pevně `maximumScale: 1, userScalable: false`,
  // což je anti-pattern, který flagne Lighthouse.
  viewportFit: "cover",
};

// B3.8 — Organization JSON-LD pro Google Rich Results + AI overview.
// Drží se minimálního `Organization` schematu; rozšíříme o `contactPoint`,
// pokud vznikne dedicated support email/telefon pro public.
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Aidvisora",
  url: siteUrl,
  logo: `${siteUrl}/aidvisora-logo-big.png`,
  sameAs: [] as string[],
};

// Perf+SEO — WebSite JSON-LD pro sitelinks searchbox (Google) a AI overview
// kontext. `SearchAction` je no-op (nemáme public site-wide search), ale
// WebSite schema samo zlepšuje knowledge-graph parsing.
const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Aidvisora",
  url: siteUrl,
  inLanguage: "cs-CZ",
  publisher: {
    "@type": "Organization",
    name: "Aidvisora",
    url: siteUrl,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs" suppressHydrationWarning>
      <head>
        {/* Perf — preconnect pro Vimeo player + thumbnail CDN. Landing používá
            VimeoFacade (on-click mount iframe); preconnect zajistí, že DNS + TLS
            handshake proběhne už během první interakce a přehrání videa je okamžité. */}
        <link rel="preconnect" href="https://player.vimeo.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://i.vimeocdn.com" crossOrigin="anonymous" />
      </head>
      <body className={`${sourceSans.className} ${plusJakarta.variable}`}>
        {/* B3.8 — structured data: musí být v <body> (next/script strategy="beforeInteractive"
            v RSC layoutu není dostupný, ale raw `<script type="application/ld+json">`
            je v pořádku a Next.js ho nechá být). */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <TooltipBlurListener />
        {/*
          Perf — NativeOAuthDeepLinkBridge na webu je no-op a dynamic-importuje
          své těžké závislosti (Capacitor + Supabase client) jen na iOS/Android.
        */}
        <NativeOAuthDeepLinkBridge />
        {/*
          Central Capacitor plugin orchestrator — wires hardware back
          button, keyboard resize, status bar, splash screen, and network
          breadcrumbs. No-op on web (všechny pluginy dynamic-import uvnitř).
        */}
        <NativeRuntime />
        <ConfirmProvider>{children}</ConfirmProvider>
        {/*
          Perf — cookie banner a Vercel Speed Insights nepotřebujeme v první
          vlně hydratace. Montujeme po `window.load` + `requestIdleCallback`,
          aby nesoutěžily o CPU s hero/navigací a INP zůstal nízký.
        */}
        <DeferredIdleMount>
          <CookieNoticeBanner />
          <SpeedInsights />
        </DeferredIdleMount>
      </body>
    </html>
  );
}
