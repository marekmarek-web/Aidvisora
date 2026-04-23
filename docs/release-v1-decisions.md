# Release v1.0 — rozhodnutí a scope

Tento dokument fixuje rozhodnutí, která určují co jde s **release v1.0** do App Store a Google Play a co je odložené na v1.1+.

Odpovídá auditnímu plánu `release_readiness_audit_aidvisora_974071d1.plan.md`.

## Shrnutí (TL;DR)

| Oblast | v1.0 | Důvod |
|--------|------|-------|
| Platforma — iOS | **ANO** | TestFlight + App Review |
| Platforma — Android | **ANO** | Internal → Closed → Production |
| Push iOS | **ANO** | Unified FCM (2026-04-23). APNs entitlement v repu (`App.release.entitlements`), APNs P8 se uploaduje do Firebase console, backend posílá přes FCM HTTP v1. |
| Push Android | **NE (odloženo na v1.1)** | Vyhnout se dodání `google-services.json` pro Android; backend FCM cesta je již připravená a Android se zapne jen shozením gate v `usePushNotifications.ts`. |
| Stripe Checkout / Upgrade v native | **SKRYTO** | App Store 3.1.1 + Play Payments policy |
| Stripe Customer Portal v native | **SKRYTO** | Safe side — reviewer často blokuje i portal; management přes web |
| Apple Sign-in | **ANO** | Guideline 4.8 (Google login je nabízen → Apple vyžaduje) |
| Google Sign-in | **ANO** | Už funguje |
| Universal Links / App Links | **NE** | Custom scheme `aidvisora://auth` funguje, reviewer to přijme |
| Native Sentry (`@sentry/capacitor`) | **NE** | Web Sentry uvnitř WebView stačí pro v1.0 |
| Native analytics SDK | **NE** | PostHog ve web vrstvě stačí |
| iPad-specifický layout | **NE** | `LSRequiresIPhoneOS=true` — iPad běží jako iPhone-only app |
| Share extension (iOS) | **ANO** | Už funguje |
| Send Intent (Android) | **ANO** | Už funguje |
| Kamera + Document Scanner | **ANO** | Už funguje |
| Deep link OAuth bridge | **ANO** | Už funguje |

## 1. Push notifications

### iOS: zapnuto (unified FCM)
- Entitlement `aps-environment = production` je v [`apps/web/ios/App/App/App.release.entitlements`](../apps/web/ios/App/App/App.release.entitlements).
- `UIBackgroundModes` obsahuje `remote-notification` v [`Info.plist`](../apps/web/ios/App/App/Info.plist).
- `AppDelegate.swift` volá `FirebaseApp.configure()`.
- JS vrstva ([`usePushNotifications.ts`](../apps/web/src/lib/push/usePushNotifications.ts)) používá `@capacitor-firebase/messaging` a ukládá **FCM registration token** (ne APNs device token) do `/api/push/devices`.
- Backend ([`apps/web/src/lib/push/send.ts`](../apps/web/src/lib/push/send.ts)) posílá přes FCM HTTP v1.
- **Manuální kroky před release:** (1) nahrát APNs P8 do Firebase console (Project Settings → Cloud Messaging → Apple app config), (2) umístit `GoogleService-Info.plist` do iOS bundle, (3) nastavit `FCM_SERVICE_ACCOUNT_JSON` ve Vercel prod env. Viz [`runbook-push.md`](runbook-push.md).

### Android: vypnuto pro v1.0
- `apps/web/android/app/google-services.json` **neexistuje** a nebude pro v1.0 dodán.
- Bez něj by `PushNotifications.register()` natívně spadl (`IllegalStateException: Default FirebaseApp is not initialized`).
- Hook [`usePushNotifications.ts`](../apps/web/src/lib/push/usePushNotifications.ts) je upraven tak, aby na Androidu nic neregistroval (gate přes `isAndroidPlatform()`).
- V UI klientské / poradcovské aplikace se na Androidu v1.0 nebude vůbec zobrazovat soft-prompt pro push.
- **v1.1:** zapnout push na Androidu — vytvořit Firebase Android app `cz.aidvisora.app`, stáhnout `google-services.json`, commitnout **mimo git** (je v `.gitignore` přes šablonu `.example`), znovu povolit hook.

## 2. Platby (Stripe)

- Všechny nákupní CTA ([`WorkspaceStripeBilling.tsx`](../apps/web/src/app/components/billing/WorkspaceStripeBilling.tsx)) jsou v native skryté.
- Uživatel v native vidí jen **stav předplatného** (read-only): tier, status, konec období.
- K akci "změnit tarif / zahájit předplatné / faktury" se dostane jen přes web `https://www.aidvisora.cz/portal/setup`.
- Důvod: App Store Review Guideline 3.1.1 (in-app purchases for digital content must use IAP) a Google Play Payments Policy. B2B SaaS obrana je šedá zóna a lokálním argumentem by zdržela review.

## 3. Legal texty

- `/privacy` a `/terms` obsahují sekci "Mobilní aplikace Aidvisora" se:
  - push tokeny (FCM registration token, iOS i Android — APNs funguje jen jako bezstavový transport mezi Applem a Firebase),
  - device identifiers (platform, model, OS verze — pro push routing),
  - crash reporting přes Sentry,
  - Supabase jako primární backend,
  - AI providery (Anthropic, OpenAI) jako subprocesory obsahu dokumentů,
  - Google LLC / Firebase Cloud Messaging jako subprocesor push notifikací (iOS už teď, Android v1.1).

## 4. Metadata a review

- Apple review notes poznamenávají, že appka je **Capacitor hybrid** (WebView nad `https://www.aidvisora.cz`), custom scheme `aidvisora://auth`, Apple / Google login, bez in-app purchase.
- Test account: viz [`runbook-release.md`](runbook-release.md) sekce review.

## 5. Co se NE-dělá pro v1.0

1. Univerzální odkazy (`apple-app-site-association`, `assetlinks.json`).
2. `@sentry/capacitor` (native crash).
3. Firebase Analytics (jen FCM — a to až v1.1).
4. iPad-native layout.
5. Apple Sign-in fallback (pokud by Apple rejectnul 4.8 — pak v patch releasu).
6. Přepis jakékoli obrazovky do nativního Swiftu / Kotlinu.
