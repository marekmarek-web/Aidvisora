# Store Submission + Launch Ops Pack — Aidvisora v1.0

**Verze:** 2026-04-23
**Owner:** Marek (solo on-call)
**Scope:** iOS App Store + Google Play + production public launch (Android v1.0 dle rozhodnutí D-A16).
**Účel:** Jediný operativní balík pro **ruční** kroky. Není to code plan. Co je mimo repo = **MANUAL**.

**Zdroje pravdy** (nepřepisuji je, jen konsoliduji):
- [docs/SUPERLAUNCH_MANUAL_CHECKLIST.md](../SUPERLAUNCH_MANUAL_CHECKLIST.md) — SL-IDs jsou autoritativní
- [docs/release-v1-decisions.md](../release-v1-decisions.md) — co JDE / NEJDE v1.0
- [docs/audit/pre-launch-verify-checklist-2026-04-22.md](../audit/pre-launch-verify-checklist-2026-04-22.md)
- [docs/audit/human-decisions-required-2026-04-22.md](../audit/human-decisions-required-2026-04-22.md)
- [docs/mobile-audit.md](../mobile-audit.md)
- [docs/ios/SUBMISSION-CHECKLIST.md](../ios/SUBMISSION-CHECKLIST.md), [docs/ios/REVIEW-NOTES.md](../ios/REVIEW-NOTES.md)
- [apps/web/ios/APP_STORE.md](../../apps/web/ios/APP_STORE.md), [apps/web/android/PLAY_STORE.md](../../apps/web/android/PLAY_STORE.md)
- [docs/incident-runbook.md](../incident-runbook.md), [docs/breach-playbook.md](../breach-playbook.md)

---

## 0. Výchozí stav (co je už v repu hotové — bez této práce nepokračuj)

**Repo-side HOTOVO** (ověřeno z auditů):
- iOS Capacitor projekt `apps/web/ios/App` + entitlements `App.release.entitlements` (aps-environment=production).
- Android projekt `apps/web/android/` (min SDK 23, target 34, AAB), keystore template `key.properties.example`.
- `PrivacyInfo.xcprivacy` + iOS Required Reason API manifest.
- `usePushNotifications.ts` gated na iOS (Android registrace vypnuta kvůli chybějícímu FCM — v1.0 záměr).
- Custom scheme `aidvisora://auth/{callback,done,error}` v iOS Info.plist + Android Manifest.
- `NativeOAuthDeepLinkBridge.tsx` + whitelist hostů.
- `MobileLoginView` má Apple + Google buttony; OAuth handler + `/auth/native-bridge` route.
- Stripe in-app CTA skrytá v native (`WorkspaceStripeBilling`) — reader-style compliance.
- Account deletion cesta v `/portal/nastaveni`.
- Pricing / privacy / terms / `/bezpecnost` + DPA register + breach playbook + incident runbook.
- Edge Config kill-switches (`/portal/admin/kill-switches`).
- Review tenant seed script `scripts/seed/review-tenant-seed.ts`.
- Landing copy po B1.4 (oslabená claim o AES-256-GCM).

**Repo-side NE-HOTOVO k 2026-04-23** (blokuje launch, ale není to úkol tohoto packu):
- D2 PII backfill execution (skript existuje, musí běžet v maintenance okně).
- D3 rozhodnutí net vs gross a úprava `pricing/page.tsx`.
- `STRIPE_CHECKOUT_DISABLED` env guard — runbook ho slibuje, v kódu ověřit (SL-045).
- Feature graphic 1024×500 + Android screenshoty.
- Re-roll review hesel + `docs/launch/review-tenant-credentials.gpg`.

---

## I. APP STORE / PLAY CHECKLIST (MANUAL)

### I.A Apple — tvrdý checklist

**I.A.1 Apple Developer Portal** (MANUAL — developer.apple.com)
- [ ] Team ID poznamenán, uložen do 1Password „Aidvisora / Apple".
- [ ] App ID `cz.aidvisora.app`: capabilities **Push Notifications**, **App Groups**, **Sign In with Apple**.
- [ ] App ID `cz.aidvisora.app.share` (share extension) + stejná App Group `group.cz.aidvisora.app`.
- [ ] **Services ID** `cz.aidvisora.app.signinwithapple` s Return URL = `https://<project-ref>.supabase.co/auth/v1/callback`.
- [ ] **SIWA P8 private key** vygenerován, staženo jednou, v 1Password.
- [ ] **APNs P8 Auth Key** vygenerován (druhý klíč!), v 1Password; Key ID + Team ID poznamenány. **Destinace: Firebase console** (APNs → FCM relay), NE Vercel env. Detaily [docs/runbook-push.md](../runbook-push.md) §2.
- [ ] Distribuční certifikát + provisioning profil (App Store) platné ≥ 60 dní.

**I.A.2 App Store Connect record** (MANUAL — appstoreconnect.apple.com)
- [ ] App record `Aidvisora`, Bundle ID `cz.aidvisora.app`, SKU nastaveno.
- [ ] Primary language: **Czech**.
- [ ] Category: Primary **Business**, Secondary **Finance** (ověřit — Finance může triggerovat enhanced review).
- [ ] Age Rating: 4+ (IARC po dotazníku: všechno No).
- [ ] Pricing: **Free**, dostupnost: CZ + EU (rozhodnout okamžitě, ne po schválení).
- [ ] **Export Compliance:** `ITSAppUsesNonExemptEncryption = false` v Info.plist → v submitu „No".
- [ ] **Content Rights:** No third-party content.
- [ ] **Advertising Identifier:** No.

**I.A.3 Metadata + assets** (MANUAL)
- [ ] **Privacy Policy URL:** `https://www.aidvisora.cz/privacy` (ověř 200 bez auth).
- [ ] **Support URL:** `https://www.aidvisora.cz/podpora` nebo `mailto:support@aidvisora.cz` landing.
- [ ] **Marketing URL:** `https://www.aidvisora.cz`.
- [ ] Screenshots: **6.7" (iPhone 15 Pro Max/16 Pro Max)** povinné, **6.5" (fallback)**, **iPad 12.9"** — pokud je LSRequiresIPhoneOS=true, iPad screenshots NE-dodávat (dle release-v1-decisions iPad-native NE).
  - Min 3 screenshoty, doporučeno 5–6. Mockup framed nebo raw.
  - Obrazovky: Today/Dashboard, Contacts list, Contact detail + smlouvy, AI Review, Client portal, Scan flow.
- [ ] App Preview video (15–30 s) — volitelné, ale doporučené pro Finance-proximity category.
- [ ] App name, subtitle (max 30 znaků), promotional text (170), description (4000), keywords (100).
- [ ] **What's New** text (release notes) — 1. submit = „První veřejná verze".

**I.A.4 Privacy Nutrition Labels** → viz sekce III níže (blocker).

**I.A.5 App Review Information**
- [ ] Sign-in required: **Yes**.
- [ ] Demo advisor creds + klient creds (viz II).
- [ ] Contact info: Marek jméno + telefon + email `support@aidvisora.cz`.
- [ ] **Notes text:** paste z [docs/ios/REVIEW-NOTES.md](../ios/REVIEW-NOTES.md) §2 beze změn.
- [ ] Attachment (volitelné): 30 s screencast happy-path (scan → AI review → apply).

**I.A.6 Build & submit**
- [ ] `pnpm --filter web cap:sync:ios` bez warningů.
- [ ] Info.plist: `CFBundleShortVersionString` (1.0.0) + `CFBundleVersion` bumped (build number ≥ 1).
- [ ] Xcode → Any iOS Device → Product → Archive → Validate → Distribute → App Store Connect.
- [ ] **TestFlight beta review** schválena (první upload = až 24 h; následné běžně < 1 h).
- [ ] Internal TestFlight group: scan smoke test projde na 2 zařízeních (iPhone SE, iPhone Pro Max).
- [ ] Version → **Add for Review** → **Manual release** (ne „automatic after approval" — kontrolované okno).
- [ ] Submit.

---

### I.B Google — tvrdý checklist

**Rozhodnutí:** Android day-1 vs deferred — **nutno rozhodnout T-7 dní** (viz [docs/launch/android-day1-vs-deferred.md](android-day1-vs-deferred.md)). Dokud není zapsáno v decision logu, následující je podmíněné (SL-038).

**I.B.1 Play Console account + identity** (MANUAL — play.google.com/console)
- [ ] Publisher účet: **Organization** (Aidvisora s.r.o., nikoliv personal — Personal account má 14-dní × 12-tester closed testing gate před Production).
- [ ] $25 poplatek zaplacen.
- [ ] Developer identity verification (D-U-N-S nebo obchodní rejstřík).

**I.B.2 App record + content** (MANUAL)
- [ ] Create app: Aidvisora, cs-CZ, App, Free.
- [ ] **Privacy Policy URL:** `https://www.aidvisora.cz/privacy`.
- [ ] **Ads:** No.
- [ ] **App access:** All or some restricted → test creds (II.B).
- [ ] **Content rating** (IARC): všechno No kromě UGC=Yes + PII=Yes + 3rd-party share=Yes → Everyone.
- [ ] **Target audience:** 18+.
- [ ] **News app:** No. **COVID:** No. **Government:** No.
- [ ] **Financial features:** Informational only / Business tool. NE brokerage/trading/lending.
- [ ] **Data Safety:** viz sekce III (blocker).

**I.B.3 Store listing** (MANUAL)
- [ ] App name: Aidvisora.
- [ ] Short description (80 znaků) + Full description CS (z [apps/web/android/PLAY_STORE.md](../../apps/web/android/PLAY_STORE.md) §3.2 beze změn).
- [ ] **App icon** 512×512 PNG 32-bit.
- [ ] **Feature graphic** 1024×500 PNG/JPG 24-bit bez alpha — **MANUAL: vyrobit v Figmě, dosud chybí**.
- [ ] Phone screenshots min. 2, doporučeno 6 — **MANUAL: pořídit na reálném Androidu po internal build**.
- [ ] Tags: Business, Productivity, Finance.
- [ ] Category: Applications → Business.
- [ ] Contact: support@aidvisora.cz + website.

**I.B.4 Signing + build** (MANUAL)
- [ ] Upload keystore `apps/web/android/app/aidvisora-upload.jks` vygenerován (keytool).
- [ ] `key.properties` mimo git, hesla v 1Password.
- [ ] **Keystore záloha** mimo git + mimo 1Password (2. kopie — šifrovaný USB / bezpečnostní schránka). Ztráta = trvalá ztráta možnosti publikovat updaty.
- [ ] **Play App Signing** akceptován (Google drží release key, my upload key).
- [ ] Version: `versionCode=1`, `versionName=1.0.0`.
- [ ] `./gradlew bundleRelease` → `app-release.aab`.
- [ ] SHA-256 upload certifikátu i Play App Signing certifikátu poznamenány (pro případné App Links v1.1).

**I.B.5 Testing tracks + submit**
- [ ] Internal testing release → Add for Review → schválen.
- [ ] Opt-in URL distribuován Markovi + ≥1 beta poradci.
- [ ] **Scan smoke test** (PLAY_STORE.md §6) projde na Pixel + Samsung.
- [ ] Promote Internal → Production (Organization account povoluje přímo).
- [ ] Release rollout: **staged 20 %** první 72 h, pak 100 %.

---

## II. REVIEWER ACCOUNT / DEMO TENANT PACK

### II.A Pre-flight (T-3 dny)

- [ ] **Supabase prod:** spustit `pnpm tsx scripts/seed/review-tenant-seed.ts --reset` se `SUPABASE_SERVICE_ROLE_KEY` (viz [docs/launch/review-tenant-seed.md](review-tenant-seed.md)).
- [ ] Ověř `tenant.metadata.is_review_tenant = true` v DB.
- [ ] **Re-roll hesel** `pnpm tsx scripts/seed/rotate-review-credentials.ts` → uloží do `docs/launch/review-tenant-credentials.gpg` (gpg-encrypted, mimo git tracking).
- [ ] **MFA:** pro `review@aidvisora.cz` vypnuto (dedicated tenant bez `MFA_ENFORCE_ADVISORS` enforce, nebo override per-user).

### II.B Credentials pro stores (copy-paste)

**iOS App Store Connect → Review Information → Demo Account:**
```
Username: review@aidvisora.cz
Password: <z docs/launch/review-tenant-credentials.gpg — aktuální>
```
Plus do **Notes** pole přidej klient credentials:
```
Klient (pro testování klientského portálu):
Username: review-klient@aidvisora.cz
Password: <stejné jako advisor>
```

**Play Console → App content → App access → Credentials required:**
- Add instruction: `Pro poradcovské prostředí: review@aidvisora.cz / <heslo>. Pro klientskou zónu: review-klient@aidvisora.cz / <stejné heslo>.`

**V 1Password trezor „Aidvisora / App Store Review" (MANUAL):**
- Heslo advisor + klient (aktuální rotace).
- Deep link test URL: `aidvisora://auth/callback?code=test` (pro reviewera).
- Support link: `mailto:support@aidvisora.cz` + telefon.

### II.C Review tenant sanity check (T-2 dny)

Přihlaš se **z fyzického TestFlight buildu** jako oba účty a ověř:
- [ ] Advisor: 15 kontaktů, 12 smluv (včetně 2 termination-in-progress), 1 approved AI review, 2 aktivní konverzace, 5 tasků, 3 kalendářní eventy, 2 notifikace.
- [ ] Klient: vidí 2–3 své smlouvy, 1 pending request, 1 faktura ke stažení.
- [ ] Apple Sign-In funguje (nejen email/heslo) — reviewer ho typicky vyzkouší.
- [ ] Scan flow: camera permission → VisionKit → uložit → AI review stránka.
- [ ] Messaging: odeslat zprávu advisor → klient → zpět (end-to-end na jednom zařízení ok).
- [ ] Account deletion: advisor najde cestu `/portal/nastaveni` → nebezpečná zóna → tlačítko existuje (ne skryté za feature flagem).

### II.D Post-review flow

- [ ] Po schválení / po rejectu **NEmazat** tenant; jen reset + nová rotace hesla → update v ASC/Play.
- [ ] Každé demo mimo review = nové re-roll hesla (D4 rozhodnutí = A, manual).
- [ ] Log do `docs/launch/review-tenant-log.md`: datum, důvod, next-review.

---

## III. PRIVACY / DATA SAFETY GAPS

### III.A Apple Privacy Nutrition Labels (App Store Connect → App Privacy)

**Tvrdý blocker — nesoulad = reject 5.1.2.** Source of truth: [docs/legal/app-store-privacy-labels.md](../legal/app-store-privacy-labels.md).

Postup v ASC (copy-paste):
- **Does this app collect data?** → **Yes**.
- **Does this app use data for tracking?** → **No** (nejsou žádné ad SDK, žádná ATT dialogem).
- **Data types** (všechno Linked to User, NOT used for Tracking, Use = App Functionality):
  - Contact Info → Email, Name, Phone.
  - Identifiers → User ID, Device ID.
  - User Content → Photos or Videos.
  - Diagnostics → Crash Data, Performance Data, Other Diagnostic Data (Use += Analytics — Sentry).
- **Nezaškrtávat:** Financial Info, Sensitive Info, Health, Location, Browsing, Search, Purchases, Audio, Contacts (OS contacts), Customer Support.

**Poznámka k OP/rodnému číslu:** Apple kategorizuje pod User Content (uploaded v dokumentu), NE pod Sensitive Info. Pokud review položí otázku, odpovědět „součástí uploaded dokumentu, šifrováno AES-256-GCM v DB".

### III.B Google Play Data Safety (Play Console → App content → Data Safety)

**Tvrdý blocker.** Source of truth: [docs/runbook-play-console.md](../runbook-play-console.md) §2.8. Klíčové:
- Encrypted in transit: **Yes**. Data deletion: **Yes**.
- Personal info: Name (R), Email (R), User IDs (R), Address (O), Phone (O). Žádné Race/Religion/Sexual.
- Financial info: **User payment info = No** (Stripe web-only). `Other financial info` = Yes (produktová metadata klientů).
- Messages: jen `Other in-app messages = Yes` (ne Emails, ne SMS).
- Photos: Yes. Videos: No.
- Files and docs: Yes.
- App interactions (PostHog): Yes Optional.
- Crash logs + Diagnostics (Sentry): Yes Required.
- Device or other IDs: Yes Required (push token).
- **Shared with third parties:** všude No (Supabase/Sentry/AI = service providers, ne sharing).

### III.C Repo-side privacy gaps (FIX PŘED SUBMIT)

- [ ] **`/privacy` sekce „Mobilní aplikace Aidvisora"** musí aktuálně obsahovat: FCM push registration token (iOS i Android), device identifiers, Sentry crash reporting, Supabase backend, Anthropic + OpenAI jako subprocessory, Google LLC (Firebase FCM) jako subprocesor pro push routing (iOS i Android — APNs běží jako bezstavový transport mezi Applem a Firebase) — ověřit před submitem (SL-041). Stará formulace „APNs token + FCM Optional pro v1.1" je zastaralá.
- [ ] **Cookie banner + CMP:** Sentry Replay v prod = off (D7=A), cookie banner to musí reflektovat — spot-check na homepage (SL-065, SL-014 z pre-launch checklist §14).
- [ ] **DPA register** (SL-039): Resend, Sentry (EU + DPA signed), OpenAI, Anthropic zapsat **před** prvním placeným zákazníkem.
- [ ] Landing: **žádný nezakrytý** „AES-256-GCM" claim bez kontextu „pro citlivé sloupce, nová data cipher; backfill historických dat probíhá" (pokud D2 PII backfill ještě neběžel — jinak lze claim zesílit).
- [ ] Sitemap/robots: `/rezervace` NENÍ v sitemap, `/portal`, `/client`, `/api` disallow (SL-065).

### III.D Account deletion in-app (iOS 6.3 guideline)

- [ ] Reviewer najde cestu z Tab bar → Settings → Delete account do **max 3 kroků**. Ověřit na TF buildu.
- [ ] „Soft delete vs hard delete" text transparentní: retence, co zůstává (audit log 5 let), co se maže okamžitě.
- [ ] Google Play má **povinný** odkaz na deletion flow i z webu (`https://www.aidvisora.cz/smazani-uctu` nebo ekvivalent) — doplnit do App content → Data Safety → „Account deletion URL".

---

## IV. DEEP LINKS / PUSH / OAUTH — MANUAL STEPS

### IV.A Custom URL scheme (v1.0 rozhodnutí = NE Universal Links / App Links)

**Potvrzení scope ([docs/release-v1-decisions.md](../release-v1-decisions.md)):** Apple AASA NE, Android assetlinks.json NE — `aidvisora://auth/callback` postačí pro v1.0.

MANUAL ověření:
- [ ] iOS: Info.plist `CFBundleURLSchemes = ["aidvisora","aidvisor"]` (legacy).
- [ ] Android: AndroidManifest intent-filter `scheme="aidvisora"`.
- [ ] **Post-install test:** v emailu z `auth.supabase.co` klik na magic-link → otevře nativní app (ne Safari/Chrome) → session vznikne.
- [ ] Pokud `NativeOAuthDeepLinkBridge` whitelist host nematchne → bridge redirectne na `/portal/today` (ověřit, že `aidvisora://admin/...` z externí appky neotevírá admin).

### IV.B Supabase Auth — Redirect URLs (MANUAL — Supabase Dashboard)

Dashboard → Authentication → URL Configuration → Redirect URLs (prefix match):
```
https://aidvisora.cz/**
https://www.aidvisora.cz/**
https://aidvisora.vercel.app/**
aidvisora://auth/callback
aidvisora://auth/done
aidvisora://auth/error
```
Site URL: `https://aidvisora.cz`.

Ověř curl:
```bash
curl -I "https://<project-ref>.supabase.co/auth/v1/authorize?provider=google&redirect_to=aidvisora://auth/callback"
# expected: 302
```

### IV.C Sign in with Apple (povinné pro Apple Review 4.8)

MANUAL kroky ([docs/runbook-apple-signin.md](../runbook-apple-signin.md)):
- [ ] Apple Developer → App ID `cz.aidvisora.app`: SIWA capability ON.
- [ ] Services ID `cz.aidvisora.app.signinwithapple` + Return URL = `https://<ref>.supabase.co/auth/v1/callback`.
- [ ] SIWA P8 key → v Supabase Dashboard → Authentication → Providers → Apple → Enable:
  - Services ID (Client ID) = `cz.aidvisora.app.signinwithapple`
  - Team ID
  - Key ID
  - Private Key (celý obsah P8 včetně BEGIN/END)
- [ ] Smoke test: fyzický iPhone v TestFlight → klik Apple button → Safari Custom Tab → Apple login → landing `/portal/today` → `supabase.auth.getUser()` OK.
- [ ] **Fallback (pokud by Apple i přesto rejectl 4.8):** skrýt Google OAuth v native iOS (guard `isIosPlatform()` v `MobileLoginView`) → vypadne povinnost SIWA. Poslední možnost.

### IV.D Google Sign-In

MANUAL:
- [ ] Google Cloud Console → OAuth client ID (iOS/Android/Web) — konzistentní s Supabase provider.
- [ ] Redirect URI = Supabase callback (`https://<ref>.supabase.co/auth/v1/callback`).
- [ ] Ověřit na Androidu (Internal build) — consent screen česky, redirect funguje.

### IV.E Push (iOS v1.0 ANO, Android v1.1) — unified FCM

**Truth of record:** iOS i Android jdou přes Firebase Cloud Messaging HTTP v1. APNs P8 se nahrává **do Firebase console**, NE do Vercel env. Plná dokumentace: [docs/runbook-push.md](../runbook-push.md).

MANUAL kroky:
- [ ] Firebase project `Aidvisora Mobile` existuje; iOS app s Bundle ID `cz.aidvisora.app` přidaná.
- [ ] APNs P8 Auth Key vygenerován (jiný klíč než SIWA!), Key ID + Team ID v 1Password.
- [ ] P8 **nahrán do Firebase console** → Project Settings → Cloud Messaging → Apple app configuration → APNs Authentication Key.
- [ ] `GoogleService-Info.plist` stažen z Firebase → `apps/web/ios/App/App/GoogleService-Info.plist` (mimo git, CI secret `GOOGLE_SERVICE_INFO_PLIST_B64`).
- [ ] Firebase service account JSON vygenerován (Project Settings → Service accounts → Generate new private key).
- [ ] Vercel production env:
  ```
  FCM_SERVICE_ACCOUNT_JSON=<celý JSON service accountu>
  # Volitelně ops kill-switch:
  # PUSH_KILL_SWITCH=0
  ```
- [ ] **Ověř, že v produkci NEJSOU** staré proměnné `APNS_AUTH_KEY`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID`, `APNS_ENVIRONMENT` — backend je nečte. Pokud jsou, smaž: `vercel env rm APNS_AUTH_KEY production` atd.
- [ ] Redeploy production.
- [ ] `node apps/web/scripts/assert-fcm-config.mjs --require-release --platform=ios` projde.
- [ ] **Runtime smoke:** [docs/ios/push-smoke-checklist.md](../ios/push-smoke-checklist.md) — A + B + C + D zelené na fyzickém iPhonu s TestFlight buildem.
- [ ] **Častá chyba:** klient ukládá APNs hex token místo FCM registration tokenu → FCM vrací `INVALID_ARGUMENT` (config). Toto byl bug opravený v Batch 1+2; regression check přes [docs/ios/push-smoke-checklist.md](../ios/push-smoke-checklist.md) A.3.

### IV.F Android push (v1.0 NE, v1.1 ANO)

**Rozhodnutí:** Odloženo na v1.1 (SL-118). Dokud není `google-services.json`, `usePushNotifications.ts` Android gate (`isSupportedPlatform = platform === "ios"`) držet, jinak FirebaseMessaging vyhodí při register.

Pro v1.1:
- [ ] Firebase console → přidat Android app `cz.aidvisora.app` do **stejného** projektu.
- [ ] `google-services.json` do `apps/web/android/app/` (mimo git, CI secret `GOOGLE_SERVICES_JSON_B64`).
- [ ] Backend env **beze změn** — tentýž `FCM_SERVICE_ACCOUNT_JSON` obsluhuje obě platformy.
- [ ] V `usePushNotifications.ts` změnit gate na `platform === "ios" || platform === "android"`.
- [ ] Re-build AAB → Internal → smoke checklist varianta Android → Production.

### IV.G Universal Links / App Links (v1.0 NE, v1.1+)

Pokud by se scope překlopil (SL-117):
- AASA JSON na `https://www.aidvisora.cz/.well-known/apple-app-site-association` (Content-Type: application/json, no redirect, no auth).
- `APPLE_TEAM_ID` env + Associated Domains `applinks:aidvisora.cz` v Xcode.
- Android: `https://www.aidvisora.cz/.well-known/assetlinks.json` se SHA-256 Play App Signing cert.
- Validátor: `https://search.developer.apple.com/appsearch-validation-tool/` a `https://digitalassetlinks.googleapis.com/v1/statements:list?...`.

---

## V. LAUNCH-DAY OPS PACK

### V.A T-7 až T-1 (pre-launch týden)

- [ ] **T-7:** Rozhodnutí Android day-1 vs deferred zapsáno do decision logu.
- [ ] **T-5:** D2 PII backfill spuštěn v maintenance okně (30–90 min), sign-off po SQL verify (SL-086).
- [ ] **T-5:** D3 pricing net vs gross rozhodnutí + code change merged (SL-087).
- [ ] **T-4:** PITR drill proveden max. 90 dní nazpět (SL-024) — pokud starší, znovu.
- [ ] **T-3:** Review tenant seed + re-roll hesel, credentials do ASC + Play (II.A, II.B).
- [ ] **T-3:** Sentry alerty A1–A12 aktivní v production env, test-trigger faux 500 ze stagingu (SL-021, SL-022).
- [ ] **T-3:** Externí uptime monitor na `/api/health` aktivní (SL-057).
- [ ] **T-2:** Stripe Tax CZ potvrzen, webhook `enabled`, Customer Portal branding OK (SL-014, SL-015, SL-016).
- [ ] **T-2:** Resend doména zelená (SPF/DKIM/DMARC), Mail-Tester ≥ 9/10 (SL-018, SL-020).
- [ ] **T-2:** Edge Config `aidvisora-ops` store propojen, initial kill-switches safe default, admin UI funguje (SL-012).
- [ ] **T-2:** Maintenance mode smoke (Edge Config `MAINTENANCE_MODE=true` → web 503 + `/api/healthcheck` 200).
- [ ] **T-1:** Device smoke: iPhone SE, iPhone Pro Max, Pixel, Samsung — invite → login → scan → AI review → apply (SL-063, SL-064).
- [ ] **T-1:** `pnpm test:f9-release-gate` green (SL-066).
- [ ] **T-1:** `STRIPE_CHECKOUT_DISABLED` env guard ověřen (SL-045): buď v kódu nebo incident runbook upraven.
- [ ] **T-1:** 1Password trezor aktualizován (review creds, APNs P8, SIWA P8, keystore hesla, Vercel env snapshot export).
- [ ] **T-1:** Slack/Discord `#incidents` a on-call kontakt potvrzen.

### V.B Launch day (T-0) — pořadí

**Předpoklad:** iOS schválený + Android schválený (pokud day-1) + cutover okno domluveno.

1. **T-0 -90 min:** status banner „Probíhá nasazení" (Edge Config) — jen pokud cutover DB URL v okně.
2. **T-0 -60 min:** Sentry baseline snapshot, poslední smoke happy path.
3. **T-0 -30 min:** Vercel env final review; redeploy production pokud potřeba.
4. **T-0 -15 min:** DB URL swap pokud plán (SL-094) — pouze po rls-m8/m9/m10 a 14-dní stagingovém burn-in (pokud ne → odložit na post-launch B4.1).
5. **T-0:** App Store → Manual release klik (slot dle domluvy, NE 3 v noci).
6. **T-0:** Play Console → Production staged rollout 20 % (pokud day-1).
7. **T-0 +15 min:** live smoke: login, scan, AI review, payment setup view, client portal, push do TF i production install.
8. **T-0 +30 min:** email komunikace: „Aidvisora je live" beta poradcům (prepared template).
9. **T-0 +60 min:** status banner off.

### V.C Rollback levers (pořadí od nejrychlejšího — [incident-runbook.md §4.3](../incident-runbook.md))

| Páka | Kdy | Jak | RTO |
|---|---|---|---|
| **Vercel promote previous** | regrese po deployi | Dashboard → Deployments → Promote | < 2 min |
| **Edge Config kill-switch** | feature regrese | `/portal/admin/kill-switches` | < 30 s |
| **Edge Config `MAINTENANCE_MODE=true`** | celkový výpadek | dashboard | < 1 min |
| **Rate-limit endpoint** | spike / DoS | Vercel Firewall | 2–5 min |
| **DB URL swap rollback** | RLS cutover fail | `DATABASE_URL` ← `DATABASE_URL_ROLLBACK`, redeploy | 5–10 min |
| **Stripe webhook disable** | duplicitní charges | Stripe Dashboard → Webhooks → Disable | < 1 min |
| **Supabase read-only** | risk korupce dat | Dashboard → Database → pause writes | 2 min |
| **Pull from App Store** | kritický iOS bug | ASC → Version → Remove from sale | 15 min (propaguje se do 2 h) |
| **Halt Play rollout** | kritický Android bug | Play Console → Production → Halt rollout | < 5 min |

### V.D Incident komunikace (P0 template)

Paste z [incident-runbook.md §4.4](../incident-runbook.md) — email adminům + statuspage:
```
Předmět: [Aidvisora · probíhající incident] ⚠︎ <popis>
Momentálně řešíme problém s <funkcí>. Dopad od <HH:MM CET> na <rozsah>.
Co teď nejde: <…>. Co funguje: <…>. Náhrada: <…>.
```

### V.E Store review incident (když reviewer shodí během launch týdne)

- [ ] Zachovat klid — běžné, nečte se to jako blocker pokud odpověď < 24 h.
- [ ] **Nikdy neargumentovat** se reviewerem přes Reply; vždy fix + resubmit.
- [ ] Založ entry v `docs/ios/SUBMISSION-HISTORY.md` (datum, verze, guideline, důvod, fix).
- [ ] Nejčastější iOS rejecty + odpovědi:
  - **5.1.1(v) Data Collection** / Privacy Label mismatch → sladit PrivacyInfo.xcprivacy + ASC labels (sekce III.A).
  - **3.1.1 IAP** → Reply s odkazem na review notes o reader-style B2B (text v `REVIEW-NOTES.md` §2).
  - **4.8 Sign in with Apple missing** → ověř SIWA button viditelný, nebo fallback = skrýt Google v iOS.
  - **2.1 Information Needed / demo creds nefungují** → okamžitě re-roll + update v ASC, Reply.
  - **5.1.1(vi) Account Deletion** → ukázat cestu v screenshotech + napsat do Reply přesné kliky.

---

## VI. FIRST 48H WATCH PLAN

### VI.A Monitoring dashboard (otevřené okno po celou dobu)

- [ ] Sentry → Issues filtered `environment:production` + `age: < 48h`, sort: „Users affected".
- [ ] Vercel → Project → Analytics (Speed Insights) + Logs (filter Error).
- [ ] Supabase → Database → Logs + Stats (connection pool, long queries).
- [ ] Stripe → Dashboard → Events (webhook delivery) + Disputes.
- [ ] Play Console → Vitals (crash rate, ANR rate — **target < 0.5 %**).
- [ ] ASC → TestFlight + Analytics (crashes, sessions).
- [ ] PostHog → funnel landing → register → first login (drop-off).
- [ ] Externí uptime monitor — `/api/health` every 1 min.

### VI.B Check-in kadence

| Čas | Akce |
|---|---|
| **T+0 to T+4h** | Kontrola každých 15 min: Sentry new issues, Stripe webhook fail, Vercel 5xx, Play crash rate |
| **T+4h to T+24h** | Každých 60 min |
| **T+24h to T+48h** | Každé 4 h |
| **T+48h** | Go/no-go rozhodnutí: scale up nebo hold |

### VI.C Red flags (okamžitá reakce)

- Sentry: nový `error.level:error` s > 10 users affected v 1 h → triage, contain.
- `/api/health` non-200 > 2 min → zapnout status banner, preparovat rollback.
- Stripe webhook fail rate > 5 % → disable webhook dočasně, investigate; pak resend events.
- Play crash rate > 1 % nebo ANR > 0.5 % → halt Production rollout, patch release.
- ASC: více než 2 "one-star crash" reviews v 24 h → TF replay, patch submit.
- Email deliverability: Resend bounces > 5 % → pause campaigns, check DMARC.
- Supabase connection pool > 80 % → zkontrolovat cron greedy query, případně Supabase Pro upgrade.

### VI.D Go/no-go criteria pro full rollout (po 48 h)

- [ ] Sentry error rate < 0.5 % sessions, P0/P1 incidents = 0 unresolved.
- [ ] Stripe: ≥ 1 úspěšná live platba proběhla E2E; žádné duplicitní charges.
- [ ] Push delivery rate > 95 % (iOS APNs).
- [ ] Android crash rate < 0.5 %, ANR < 0.5 % (pokud day-1).
- [ ] Login success rate > 98 % (Supabase auth logs).
- [ ] `/api/health` uptime 100 % v 48 h okně.

Pokud všechno zelené → Play Production rollout 20 % → 50 % → 100 % v dalších 72 h. Marketing push.

Pokud cokoliv červené → hold, patch release, re-test.

### VI.E Support load

- [ ] Připravená FAQ + canned odpovědi (login problems, missing data, Android „kdy přijde app", scan permission).
- [ ] `support@aidvisora.cz` inbox target SLA: P0 < 2h, P1 < 8h, ostatní < 24 h.
- [ ] Auto-reply mimo prac. dobu ("Ozveme se do 24 h, urgentní `bezpecnost@...`").

---

## VII. HARD BLOCKERS vs NICE-TO-HAVE

### VII.A HARD BLOCKERS (bez toho NEODESÍLAT)

#### iOS App Store
1. Apple Developer Team + App ID + Services ID + distribuční profil aktivní.
2. **Sign in with Apple** funkčně nakonfigurován v Supabase + Apple Developer (IV.C). Bez toho auto-reject 4.8.
3. **APNs P8** uploadnutý do Firebase console + `FCM_SERVICE_ACCOUNT_JSON` ve Vercel prod env + `GoogleService-Info.plist` v iOS bundle + production `aps-environment` entitlement. Staré `APNS_*` env v produkci neexistují.
4. **Privacy Nutrition Labels** vyplněné, matchují `PrivacyInfo.xcprivacy` (III.A).
5. **Review demo accounts** funkční, naplněné daty, credentials v ASC (II).
6. **Review Notes** text o reader-style / no IAP vložen.
7. **Account deletion** dostupné v ≤ 3 kroky (iOS 6.3).
8. Production build TF-smoke pass (scan flow, Apple login).
9. Privacy/Support/Marketing URLs veřejné bez auth.
10. Min. 3 screenshoty 6.7".

#### Google Play (pokud day-1)
1. Organization developer account verified.
2. Upload keystore zálohovaný mimo repo i mimo 1Password (2× kopie).
3. **Data Safety form** kompletní a souhlasí s reality (III.B).
4. Content rating IARC → 18+.
5. Privacy Policy URL aktivní.
6. App icon 512×512 + feature graphic 1024×500 + min 2 phone screenshots.
7. **App access** credentials v App content.
8. Play App Signing akceptován.
9. Scan smoke test na ≥ 1 fyzickém Androidu projde.

#### Production launch (platform-independent)
1. SQL migrace SL-001–SL-006 aplikované a verify query = 0.
2. Vercel production env minimum (SL-010) + `CRON_SECRET` (SL-011).
3. Stripe Tax CZ aktivní + webhook ověřen (SL-014, SL-015).
4. Resend doména zelená (SPF/DKIM/DMARC) + Mail-Tester ≥ 9 (SL-018, SL-020).
5. Sentry alerty A1–A12 aktivní + test-trigger OK (SL-021–SL-023).
6. PITR zapnuto + drill < 90 dní (SL-024).
7. Edge Config store + kill-switches (SL-012).
8. Incident runbook + breach playbook přečten, on-call kontakt aktuální.
9. D2 PII backfill dokončen **nebo** D2=B a landing copy sladěna s realitou.
10. `STRIPE_CHECKOUT_DISABLED` buď v kódu (SL-045) nebo z incident runbooku odstraněn.
11. DPA register doplněn (Resend, Sentry, OpenAI, Anthropic) — SL-039.
12. `/privacy`, `/terms`, `/dpa`, `/bezpecnost` veřejně přístupné, obsahují sekci „Mobilní aplikace Aidvisora".

### VII.B NICE-TO-HAVE (launch bez nich OK, ale ideálně do 48 h)

- App Preview video (iOS) + promo video (Play).
- iPad screenshots (pokud by se v budoucnu překlopil scope; v1.0 iPad-native=NE).
- Android day-1 (lze deferred +3 týdny).
- Closed Testing track na Play (Organization account to neblokuje).
- Native Sentry pro Capacitor (`@sentry/capacitor`) — v1.1.
- Universal Links / App Links — v1.1.
- Automatizovaný password rotation pro review tenant (D4=B) — post-launch.
- D5 servicing vs creator advisor — Batch 4.
- PostHog session replays Android — později.

### VII.C OUT OF SCOPE v1.0 (nespouštět, nedoplňovat)

Dle [release-v1-decisions.md](../release-v1-decisions.md):
- Android push (FCM + `google-services.json`).
- Stripe Checkout / Customer Portal v native shellu (web-only).
- Native Sentry, Firebase Analytics, native analytics SDK.
- Native Swift/Kotlin screens.
- iPad-native layout.
- Universal Links / App Links.

---

## Appendix — Operátorský „go" gate

**Před kliknutím Submit pro iOS / Promote Production pro Play / Release schválené verze:**

Zaškrtni VIII (všechny hard blockery z VII.A) + fyzické ověření:

- [ ] Všech 10 iOS hard blockers = YES.
- [ ] Pokud day-1: všech 9 Android hard blockers = YES.
- [ ] Všech 12 production launch hard blockers = YES.
- [ ] Review tenant = živý, hesla < 7 dní stará.
- [ ] 1Password backup stažen + uložen offline (1× ročně, aktualizovat).
- [ ] On-call (Marek) dostupný v launch den +24 h.
- [ ] Rollback postupy nacvičené — Marek umí z hlavy promote previous Vercel deploy + enable kill-switch.

**Teprve pak:** Submit / Release / Promote.

---

*Konec packu. Všechny broader detaily v [SUPERLAUNCH_MANUAL_CHECKLIST.md](../SUPERLAUNCH_MANUAL_CHECKLIST.md) pod odpovídajícími SL-IDs.*
