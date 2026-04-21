# DPA Register — podepsané smlouvy se subdodavateli (subprocesory)

> Delta audit A22 — právník při enterprise DD žádá důkaz o podepsaných DPA. Tato tabulka je zdrojem pravdy, co je a co není podepsáno. Aktualizujte při každém novém subprocesoru, rotaci účtu, nebo změně regionu.

## Status legend

- ✅ **Signed** — DPA podepsané a na file (link ke scan / PDF v 1Password / Dropbox Sign).
- 🟡 **Click-through** — akceptováno přes dashboard (vystačí pro malé SaaS, nedostatečné pro enterprise DD).
- ❌ **Missing** — žádný DPA, HARD BLOCKER pro paid launch.
- ⚠ **Expired** — DPA bylo podepsáno, ale expiroval nebo je na starém právním subjektu.

## Tabulka

| # | Vendor | Funkce | Region | DPA status | Odkaz / poznámka | Odpovědnost |
|---|--------|--------|--------|------------|------------------|-------------|
| 1 | **Supabase Inc.** | DB, Auth, Storage | EU (Frankfurt) | 🟡 click-through | Supabase dashboard → Settings → Billing → DPA download (auto-generated when accepting ToS) | Infra owner |
| 2 | **Vercel Inc.** | Hosting, CDN, Functions | Global | 🟡 click-through | Vercel dashboard → Settings → Legal → DPA (Pro plán auto-DPA) | Infra owner |
| 3 | **Stripe, Inc.** | Payments, billing | Global | 🟡 click-through | [stripe.com/legal/dpa](https://stripe.com/legal/dpa) — implicit při podpisu Services Agreement | Billing owner |
| 4 | **Resend, Inc.** | Transakční mail | EU (Frankfurt — pokud nastaveno) | ❌ **missing** | [resend.com/legal/dpa](https://resend.com/legal/dpa) — podepsat přes dashboard nebo email | Legal owner |
| 5 | **Sentry (Functional Software, Inc.)** | Error tracking | EU region (musí být nastaven v projektu!) | ❌ **missing** | [sentry.io/legal/dpa](https://sentry.io/legal/dpa) — u Business planu přes dashboard | Infra owner |
| 6 | **OpenAI, L.L.C.** | AI (klasifikace, kopilot, shrnutí) | USA | ❌ **missing** | [openai.com/policies/data-processing-addendum](https://openai.com/policies/data-processing-addendum) — **vyžaduje Enterprise / API business account** + aktivace zero data retention (ZDR) pro API | Legal + AI owner |
| 7 | **Anthropic PBC** | AI Review (Claude) | USA | ❌ **missing** | [anthropic.com/legal/dpa](https://anthropic.com/legal/dpa) — vyžaduje business account; data by default do tréninku **nejdou** pro API customers | Legal + AI owner |
| 8 | **Google LLC (Firebase FCM)** | Push notifikace | Global | 🟡 click-through | [firebase.google.com/terms/data-processing-terms](https://firebase.google.com/terms/data-processing-terms) — implicit; push payload projde Google | Infra + mobile owner |
| 9 | **Apple Inc. (APNs)** | Push notifikace iOS | Global | N/A | APNs ToS v rámci Apple Developer Program; nepovažuje se za subprocesor ve striktním smyslu (bezstavové push routing) | Mobile owner |

## Akce před first paid user

1. **Resend DPA** — poslat email sales@resend.com s žádostí o signed DPA (standard, dostanete do 48 h). Nebo v dashboardu Workspace → Billing → DPA.
2. **Sentry DPA** — přepnout projekt na EU region (Sentry → Settings → Organizations → Data region) + aktivovat DPA.
3. **OpenAI Enterprise/Business** — pokud nemáte business tier, DPA click-through nestačí pro Aidvisora usecase (zpracování smluv = GDPR článek 9 kategorie). Minimálně aktivovat **zero data retention** přes form.
4. **Anthropic Commercial** — stejně — business tier + DPA.
5. Aktualizovat tabulku `✅ Signed` s odkazem na PDF v 1Password.

## Kadence

- Q/2 — review subprocesorů: jsou aktivní? Přidali jsme nějaký (Slack, PostHog, Better Stack)? Odstranili?
- Při každém přidání nového SaaS: **nejdřív DPA**, pak integrace.
- Při změně region settingu (Sentry EU → US nebo obráceně): update v této tabulce + v `LegalSubprocessorsTable.tsx`.

## Cross-reference

- UI tabulka subprocesorů: [apps/web/src/app/legal/LegalSubprocessorsTable.tsx](../../apps/web/src/app/legal/LegalSubprocessorsTable.tsx)
- Privacy blocks: [apps/web/src/app/legal/content/privacy-blocks.json](../../apps/web/src/app/legal/content/privacy-blocks.json)
- RLS matrix (WS-2): [docs/security/rls-policy-matrix.md](../security/rls-policy-matrix.md)
