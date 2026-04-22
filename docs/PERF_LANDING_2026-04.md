# Landing Performance – Maximum Scope Refactor

Datum: 22.04.2026
Scope: `www.aidvisora.cz/` + všechny marketing/legal routy.
Cíl: LCP <2.5 s (mobil, Slow 4G), TTFB <600 ms, INP <200 ms, First Load JS <100 KB gzip.

## Provedené změny (14 fází)

### Fáze 1 – TTFB (proxy + HomePage)

- [`apps/web/src/proxy.ts`](../apps/web/src/proxy.ts): pro anonymní marketing routy (`/`, `/pricing`, `/bezpecnost`, `/o-nas`, `/kontakt`, `/pro-brokery`, `/legal/*`, `/subprocessors`, `/terms`, `/privacy`, `/cookies`, `/demo`, `/beta-terms`, `/status`, `/sitemap*`, `/robots*`, `/gdpr`, `/vop`, `/dpa`, `/logos/*`, `/icons/*`, `/report-assets/*`) vracíme `NextResponse.next()` před `createServerClient` + `supabase.auth.getUser()`.
- [`apps/web/src/app/page.tsx`](../apps/web/src/app/page.tsx) a všechny marketing/legal pages: `export const dynamic = "force-static"` + `export const revalidate = 3600`. Odstraněn `await headers()` z HomePage.
- [`apps/web/next.config.js`](../apps/web/next.config.js): `Cache-Control: public, max-age=0, s-maxage=3600, stale-while-revalidate=86400` pro marketing routy; `public, max-age=31536000, immutable` pro `/_next/static/*`.

### Fáze 2 – Root layout odlehčení

- [`NativeOAuthDeepLinkBridge`](../apps/web/src/app/components/NativeOAuthDeepLinkBridge.tsx): Capacitor + Supabase client se dynamic-importují jen na nativní platformě (no-op na webu).
- [`DeferredIdleMount`](../apps/web/src/app/components/DeferredIdleMount.tsx): nová utilita, která odkládá mount potomků na `window.load` + `requestIdleCallback`.
- [`layout.tsx`](../apps/web/src/app/layout.tsx): `CookieNoticeBanner` + `SpeedInsights` zabaleny do `DeferredIdleMount`.

### Fáze 3 – Split monolitu `PremiumLandingPage`

- Nové komponenty v `apps/web/src/app/components/landing/`:
  - [`VimeoFacade.tsx`](../apps/web/src/app/components/landing/VimeoFacade.tsx) – thumbnail + on-click mount iframe.
  - [`AiSandbox.tsx`](../apps/web/src/app/components/landing/AiSandbox.tsx) – interaktivní AI demo, `next/dynamic` + `ssr: false`.
- `PremiumLandingPage.tsx` lazy-loaduje `AiSandbox` s placeholderem (drží aspect-ratio, žádný CLS).

### Fáze 4 – Fonty

- Odstraněn inline `@import url('https://fonts.googleapis.com/css2?...&family=Inter...&family=Plus_Jakarta_Sans...')` z landingu.
- Plus Jakarta Sans redukován z 4 na 3 váhy (`500`, `600`, `700`).
- `.font-inter` / `.font-jakarta` třídy mapují na `var(--font-primary)` / `var(--font-jakarta)` z `next/font/google`.

### Fáze 5 – Infinite CSS animace

- `shimmer` (hero gradient text): `infinite` → `animation-iteration-count: 1 forwards`, jen v `@media (prefers-reduced-motion: no-preference)`.
- `spin-gradient` (Pro pricing conic-gradient rotace): odstraněn, nahrazen statickým `linear-gradient`.
- `flowLine`, `dash-flow`, `notification-float`, `moveCardAcross`: `animation-play-state: paused` defaultně; IntersectionObserver přes `data-in-view="true"` pustí animaci jen ve viewportu.
- `@media (prefers-reduced-motion: reduce)` vypíná všechny tyhle animace.
- Blur orby z `blur-[150px]` na `blur-[80px]`.
- `ScrollReveal` transition z 1000 ms na 500 ms.
- `SpotlightCard` mousemove handler: CSS custom properties přes `element.style.setProperty` místo React state; limitováno na `pointerType === "mouse"`.

### Fáze 6 – Vimeo facade

- 4× `<iframe player.vimeo.com>` → `<VimeoFacade>` (Image z `vumbnail.com` + play button).
- [`layout.tsx`](../apps/web/src/app/layout.tsx): `<link rel="preconnect" href="https://player.vimeo.com">` + `href="https://i.vimeocdn.com">`.

### Fáze 7 – Obrázky a `public/`

- [`next.config.js`](../apps/web/next.config.js) `images`: `formats: ["image/avif", "image/webp"]`, `minimumCacheTTL: 31536000`, `deviceSizes` + `imageSizes`.
- `vumbnail.com` přidán do `remotePatterns` a `img-src` v CSP.
- Archivace duplicit (~2.3 MB): `public/_archive/{Aidvisora logo.png, aidvisora-logo.png, logo.png, Aidvisora logo A.png, logos-Aidvisora-logo.png, logos-Aidvisora-logo-A.png}`.
- Hero logo: `fetchPriority="high"` + `priority` pro preload hint.

### Fáze 8 – Bundle

- `@next/bundle-analyzer` aktivní přes `pnpm --filter web analyze`.
- `TRIAL_DURATION_DAYS` extrahován do [`trial-constants.ts`](../apps/web/src/lib/billing/trial-constants.ts); `public-pricing.ts` importuje odtud (marketing chunk netáhne celý `plan-catalog.ts`).
- `optimizePackageImports: ["lucide-react", "date-fns"]` už bylo; bundle analyzer prozradí finální velikost.

### Fáze 9 – Sentry

- [`instrumentation-client.ts`](../apps/web/src/instrumentation-client.ts): `isMarketingRoute(pathname)` → `replaysSessionSampleRate: 0`, `replaysOnErrorSampleRate: 0`, `tracesSampleRate: 0`, `integrations: []`. Replay bundle (~50–80 KB gzip) se pro marketing vůbec neparsuje.

### Fáze 10 – CSS

- `aidvisora-components.css` (897 ř., ~40 KB unminified) přesunut z root layoutu do `portal/layout.tsx`, `client/layout.tsx`, `board/layout.tsx`, `dashboard/layout.tsx`. Marketing HTML už nezahrnuje `.wp-*` třídy, které nepoužívá.
- `aidvisora-theme.css` zůstává v rootu (design tokeny přes `var(--wp-*)` používá `CustomDropdown` na landingu).

### Fáze 11 – Vercel + edge

- [`vercel.json`](../apps/web/vercel.json): `"regions": ["fra1"]` — edge functions v Frankfurtu (lepší latence pro ČR).
- `priority` + `fetchPriority="high"` na hero logu.
- Preconnect pro Vimeo v `<head>`.

### Fáze 12 – SEO / JSON-LD

- `Organization` JSON-LD už v rootu; přidán `WebSite` JSON-LD (knowledge-graph, AI overview kontext).
- `sitemap.ts` + `robots.ts` už existují; bez změny.
- `FAQPage` JSON-LD generuje `page.tsx` z `LANDING_FAQS`.

### Fáze 13 – Měření (ke spuštění po deployu)

**Baseline (před refaktorem):** nespouštěno samostatně před zásahem — batch zásah podle plánu.

**Po deployi udělat:**

```bash
# 1. Bundle analyzer
pnpm --filter web analyze
# Otevři .next/analyze/ — sledovat: hlavní client bundle marketing chunk <100 KB gzip.

# 2. Lighthouse (mobil, Slow 4G, CPU 4× throttle)
pnpm dlx lighthouse https://www.aidvisora.cz --preset=mobile --output=json --output-path=lighthouse-mobile.json
pnpm dlx lighthouse https://www.aidvisora.cz --output=json --output-path=lighthouse-desktop.json

# 3. WebPageTest (doplňkově)
# https://www.webpagetest.org/?url=https%3A%2F%2Fwww.aidvisora.cz&runs=3&fvonly=1&medianMetric=SpeedIndex

# 4. Vercel Speed Insights
# Real-user metriky sledovat 48 h po deployi: https://vercel.com/<team>/aidvisora/speed-insights
```

**Cíle:**

| Metrika | Cíl (mobil) | Cíl (desktop) |
|---|---|---|
| LCP | <2.5 s | <1.5 s |
| FCP | <1.8 s | <1.0 s |
| INP | <200 ms | <100 ms |
| CLS | <0.1 | <0.1 |
| TTFB | <600 ms | <300 ms |
| First Load JS | <100 KB gzip | <100 KB gzip |

### Fáze 14 – Rollback / regrese

**Nasazení / rollback:**

1. Deploy na preview (`vercel`) → smoke test checklist níž.
2. Promote to production přes Vercel dashboard.
3. Sentry release tag: `landing-perf-v1` (přes `SENTRY_RELEASE` env, automaticky z git SHA).
4. Monitorování error rate 24 h v Sentry (filtr `release:landing-perf-v1`).
5. Speed Insights 48 h — porovnat s předchozím window.

**Rollback:**

- Commit je izolovaný v jedné PR. Revert PR + redeploy.
- Případně Vercel Instant Rollback na předchozí production deploy.

**Smoke test checklist (po deployi):**

- [ ] Hero text a logo viditelné do 2 s (mobil, Slow 4G).
- [ ] Nav odkazy fungují: Jak to funguje, Pro koho, Ukázka, Ceník, Bezpečnost, FAQ.
- [ ] "Domluvit demo" + "Zkusit zdarma" CTA klikají.
- [ ] Vimeo facade thumbnail se zobrazí; klik na play spustí video (autoplay=1).
- [ ] AI sandbox: "Nahrát ukázkovou smlouvu" → scanning → result → reset funguje.
- [ ] ROI kalkulačka: slidery počítají.
- [ ] Pricing switch měsíc/rok mění ceny.
- [ ] FAQ accordion otevírá/zavírá.
- [ ] `CustomDropdown` v klientské zóně mock funguje.
- [ ] Cookie banner se objeví po ~1 s po `window.load`.
- [ ] Footer odkazy fungují: /bezpecnost, /legal/*, /subprocessors, /terms, /privacy, /cookies, /o-nas, /kontakt, /pro-brokery, /demo, /beta-terms, /gdpr, /vop, /dpa.
- [ ] `/sitemap.xml` a `/robots.txt` vrací 200.
- [ ] JSON-LD Organization + WebSite + FAQPage jsou v HTML (`view-source:`).
- [ ] Sentry: první session na `/` **NEpokazuje** replay bundle v Network (= skip funguje).
- [ ] Portal `/portal` po přihlášení: UI (`.wp-card`, `.wp-table`, kalendář) vypadá identicky (regrese po přesunu components.css).
- [ ] Client zone `/client` po přihlášení: UI vypadá identicky.
- [ ] Mobile portal (mobile UI V1): drawery, toolbar, bottom nav funkční.

## Metriky dopadu (odhad podle teorie)

- **TTFB**: ~600–800 ms → ~100–200 ms (proxy short-circuit + static HTML).
- **First Load JS**: ~250 KB gzip → ~80–100 KB gzip (Capacitor skip, landing split, Sentry replay off).
- **LCP**: ~4–6 s → ~1.5–2.5 s (static HTML + hero logo preload + font redukce).
- **INP**: ~300–500 ms → <200 ms (infinite animace off, SpotlightCard bez re-renderů, lazy islands).
- **GPU/CPU na mobilu**: velké blur orby + 6 infinite animací → viewport-gated animace + 2× menší blur.

## Sledovat do budoucna

- Pokud `experimental.ppr` v Next 16 zesílí, přidat `experimental_ppr: true` na marketing pages.
- Portal CSS (`aidvisora-components.css`) je stále 897 ř. — po analýze přes purgeCSS nebo Tailwind refaktor by šlo zmenšit.
- Favicon `public/favicon.png` (217 KB) → oxipng komprese.
- `public/logos/slavia.jpg` (696 KB) — pokud je používán na landingu, optimalizovat.
