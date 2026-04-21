# iOS Submission Checklist — Aidvisora v1.0

> **Účel:** jeden checklist, který vede lidskou ruku od zelené CI po kliknutí
> **Submit for Review** v App Store Connect. Body odkazují do detailních
> runbooků, které už v repu existují. Cílem je **ne duplikovat obsah**, jen
> dát jasnou frontu kroků a single source of truth pro launch.

---

## Pre-flight (repo-side)

- [ ] `pnpm install` na čisté branchi projde.
- [ ] `pnpm --filter web typecheck` = 0 chyb.
- [ ] `pnpm --filter web test` = všechny testy green.
- [ ] Release gate pro AI extrakci: `pnpm --filter web vitest run src/lib/ai/__tests__/f0-anchor-registry.test.ts` (golden fixtures v2, optionalFields coverage pro OP/lékař/fundResolution). Viz `fixtures/golden-ai-review/anchor-golden-expectations.json`.
- [ ] Produkční web `https://www.aidvisora.cz` je up a `/api/health` vrací `200 ok`.
- [ ] Stripe Tax CZ je aktivní v Stripe dashboardu — viz `docs/billing/stripe-tax-cz-setup.md` (jinak první reálná faktura nevznikne správně).
- [ ] MFA enforcement flag `MFA_ENFORCE_ADVISORS` je nastavený v Vercel env podle rollout plánu — viz `apps/web/src/lib/auth/mfa-enforcement.ts`.

## Capacitor / Xcode build

Kroky, které vyžadují macOS + Xcode. Držíme se `docs/runbook-signing.md` a
`docs/MOBILE-APP.md`.

- [ ] `pnpm --filter web cap:sync:ios` proběhlo bez warningů na nativních modulech.
- [ ] `ios/App/App/Info.plist`: aktuální `CFBundleShortVersionString` (public verze) a `CFBundleVersion` (build number, inkrement vůči TestFlightu).
- [ ] Bundle ID `cz.aidvisora.app` matches Apple Developer Identifier + App Store Connect record.
- [ ] Archivace v Xcode (`Product → Archive`) projde **Release** schema.
- [ ] Archive → **Distribute App → App Store Connect → Upload** — build se objeví v ASC ve 15–45 min.
- [ ] Build prošel TestFlight Beta Review (první upload zabere ~24 h).

## App Store Connect — metadata

**Source of truth:** `docs/runbook-app-store-connect.md` (plné texty a pole).

- [ ] App Information vyplněné (Category, Age Rating, Copyright).
- [ ] Pricing: **Free**, regiony zvolené.
- [ ] **Privacy Nutrition Labels** dokončené. Copy-paste tabulka v §3 runbooku — **App Review shodí submit, když tam bude nesoulad**.
- [ ] Support / Marketing / Privacy URLs vyplněné a veřejně dostupné bez přihlášení.
- [ ] Screenshots (6.7" + 6.5" + iPad Pro 12.9") uploadnuté, popisky zkontrolované.
- [ ] App Preview video (volitelné, ale doporučené pro finance kategorii).

## Apple Sign-In (povinné)

Apple App Review vyžaduje Sign-In with Apple, pokud appka nabízí OAuth s
třetí stranou (Google). Setup: `docs/runbook-apple-signin.md`. Ověř:

- [ ] Services ID + Return URLs zvalidované v Supabase.
- [ ] Provider button je viditelný na webu i v iOS WebView (nesmí být schovaný za feature flagem, který by byl v produkci off).

## App Review Information

- [ ] **Demo účty vytvořené a otestované** — detail viz `docs/ios/REVIEW-NOTES.md`. Advisor + klient role, oba mají předvyplněná data.
- [ ] Review Notes vložené do App Store Connect — opět `docs/ios/REVIEW-NOTES.md`. Obsahují český průvodce reviewerem a poznámku o platbě mimo IAP.
- [ ] Sign-in credentials uložené v 1Password trezoru **Aidvisora / App Store Review**.

## Guideline-specific poznámky

- [ ] **Reader-type app:** Aidvisora nemá IAP. Předplatné jde skrz web Stripe,
  aplikace sama platby neprovádí. V review notes explicitně zmíněno — jinak
  App Review app shodí na 3.1.1.
- [ ] **B2B / finanční data:** reviewer bude hledat, jak se ukazují klientská
  data. Demo advisor účet musí mít min. 3 fiktivní kontakty + smlouvy +
  dokumenty.
- [ ] **Account deletion:** iOS ≥ 6.3 guideline — v appce musí být jasná cesta
  ke smazání účtu. Zkontroluj `/portal/setup` → nebezpečná zóna nebo ekvivalent.

## Submit

- [ ] Verze v ASC → **Add for Review**.
- [ ] Export compliance: **No** (nepoužíváme vlastní kryptografii mimo
  standardní TLS / OS API).
- [ ] Advertising Identifier: **No**.
- [ ] Content Rights: **No third-party content**.
- [ ] **Submit for Review**.

## Post-submit

- [ ] Sleduj mail + ASC notifikace každých pár hodin.
- [ ] Pokud **In Review**, zkontroluj dostupnost produkce (`/api/health`, auth).
- [ ] Pokud **Rejected**, přepiš do `docs/ios/SUBMISSION-HISTORY.md` (nová
  sekce) co review řekl a jakou patch jsme vydali.
- [ ] Po **Approved**: release přepnutý na **Manual release** → kliknout
  release v plánovaný slot, ne hned o 3 v noci.

---

## Odkazy

- `docs/MOBILE-APP.md` — architektura Capacitor shellu.
- `docs/runbook-release.md` — end-to-end release flow, CI/CD, rollback.
- `docs/runbook-signing.md` — certifikáty, provisioning, notarizace.
- `docs/runbook-app-store-connect.md` — ASC metadata + Privacy Labels.
- `docs/runbook-apple-signin.md` — Sign-In with Apple setup.
- `docs/runbook-push.md` — APNs + notifikace.
- `docs/billing/stripe-tax-cz-setup.md` — DPH + IČO/DIČ.
- `docs/security/audit-log-coverage.md` — compliance audit trail.
- `docs/ios/REVIEW-NOTES.md` — demo účty + text pro reviewera.
