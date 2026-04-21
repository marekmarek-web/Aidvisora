# Universal Links (iOS) + App Links (Android) — Runbook

**Delta A12+A13 — Deep-linking setup před TestFlight / Play Internal Testing submission.**

---

## iOS — Universal Links

### Serverová strana (done)

1. **AASA endpoint**: `apps/web/src/app/api/apple-app-site-association/route.ts`
2. **Rewrite**: `next.config.js` rewritne `/.well-known/apple-app-site-association` → `/api/apple-app-site-association`.
3. **Content-Type**: `application/json`, **nikdy** `application/json; charset=utf-8` (Apple striktně!).
4. **Bez redirectu**: MUSÍ odpovídat 200 na první HEAD/GET (bez 301 na www / bez HTTPS redirect).

### iOS app strana (done)

1. **Entitlements**: `apps/web/ios/App/App/App.release.entitlements` + `App.debug.entitlements` — přidán `com.apple.developer.associated-domains`:
   - `applinks:aidvisora.cz`
   - `applinks:www.aidvisora.cz`
   - `webcredentials:aidvisora.cz` *(pro Shared Web Credentials → iCloud Keychain auto-fill)*
2. **Info.plist** obsahuje:
   - `CFBundleURLSchemes`: `aidvisor`, `aidvisora` *(pro custom-scheme fallback + OAuth return URL)*
   - `NSFaceIDUsageDescription` *(už existuje)*

### MANUAL EXT — nutné dokončit v Apple Developer portalu

- [ ] **Provisioning profile** musí obsahovat capability **Associated Domains** (jinak buildu selže code-sign).
- [ ] **APPLE_TEAM_ID** env v Vercelu (bez této hodnoty vrací AASA `details: []` — handshake projde, ale linky nemůžou fungovat).
- [ ] Po prvním buildu ověřit validátor: <https://branch.io/resources/aasa-validator/> nebo
  `curl -I https://aidvisora.cz/.well-known/apple-app-site-association` → musí být HTTP/2 200 + Content-Type application/json.

### Ověření na zařízení

```bash
# Před instalací:
xcrun simctl openurl booted "https://aidvisora.cz/portal/today"
# Po instalaci app z TestFlightu:
# 1) Nainstaluj a SPUSŤ app alespoň jednou (Apple začne AASA stahovat až po prvním spuštění).
# 2) V Safari klikni na aidvisora.cz link → měl by se rovnou otevřít v app.
# 3) Pokud ne, smaž app + reboot + reinstaluj (AASA cache může být zaseknutá 24-48 h).
```

### Known issue: OAuth callback

Supabase OAuth (Google Sign-In) používá custom scheme `aidvisora://auth/callback`. Univerzální
link `https://aidvisora.cz/auth/callback` je v AASA pokrytý (scope `/auth/*`), takže OAuth
flow funguje **i** přes UL **i** přes custom scheme. Důvod pro custom scheme jako fallback:
App Review může přezkoušet app v režimu, kdy AASA není dostupná (ihned po install, offline).

---

## Android — App Links

### Serverová strana (done)

1. **assetlinks endpoint**: `apps/web/src/app/api/assetlinks/route.ts`
2. **Rewrite**: `next.config.js` rewritne `/.well-known/assetlinks.json` → `/api/assetlinks`.
3. **ENV vars**:
   - `ANDROID_PACKAGE_NAME` (default `cz.aidvisora.app`)
   - `ANDROID_SHA256_FINGERPRINTS` (čárkou oddělené uppercase SHA-256 otisky release keystore — **SUBSTITUJE** prázdný array jinak!)

### Android app strana (done)

1. **AndroidManifest.xml** obsahuje `<intent-filter android:autoVerify="true">` s https://aidvisora.cz a www.aidvisora.cz pro `/portal`, `/client`, `/auth`.
2. Zachováváme starý `<intent-filter>` pro `aidvisora://auth/callback` a `aidvisor://` (legacy).

### MANUAL EXT — nutné dokončit v Play Console

- [ ] **App Signing by Google Play**: po uploadu prvního release AAB získejte SHA-256 otisk
  z Play Console → Release → Setup → App signing → "App signing key certificate".
- [ ] Hodnotu vložte do Vercel env **`ANDROID_SHA256_FINGERPRINTS`** (v produkci). Jinak
  Play Protect selže verify a intent-filter spadne na disambiguation dialog.
- [ ] Pokud máte i **Upload keystore** fingerprint, přidejte ho taky (čárkou oddělené).
- [ ] Po produkčním releasu spusť verifikaci:
  ```bash
  adb shell pm get-app-links cz.aidvisora.app
  # → musí obsahovat "Verification: verified"
  ```

### Ověření v emulátoru

```bash
adb shell am start -W -a android.intent.action.VIEW -d "https://aidvisora.cz/portal/today" cz.aidvisora.app
# Pokud se otevře app (a ne Chrome), App Links fungují.
# Pokud Chrome → assetlinks.json nevrací správný fingerprint, nebo
# <intent-filter> nemá autoVerify=true, nebo cache je zaseknutá.
```

---

## Checklist před submission

- [ ] `APPLE_TEAM_ID` v Vercel env je vyplněný produkční hodnotou.
- [ ] `ANDROID_PACKAGE_NAME` a `ANDROID_SHA256_FINGERPRINTS` v Vercel env jsou vyplněné.
- [ ] `curl https://aidvisora.cz/.well-known/apple-app-site-association` vrací validní JSON s `applinks.details[0].appIDs[0] = "<TEAM>.cz.aidvisora.app"`.
- [ ] `curl https://aidvisora.cz/.well-known/assetlinks.json` vrací validní JSON s `[0].target.sha256_cert_fingerprints` obsahujícím release fingerprint.
- [ ] iOS build má v Entitlements ≥ `applinks:aidvisora.cz`.
- [ ] Android Manifest má `autoVerify="true"` intent-filter pro https://aidvisora.cz.
- [ ] Test: klik na `https://aidvisora.cz/portal/today` v Safari/Chrome → otevře app.

---

## Deep-link hierarchie (pro App Review poznámku)

| URL | Chování |
| --- | --- |
| `https://aidvisora.cz/portal/*` | Advisor area — Universal Link do app |
| `https://aidvisora.cz/client/*` | Client portal — Universal Link do app |
| `https://aidvisora.cz/auth/callback`, `/auth/done` | OAuth callback |
| `https://aidvisora.cz/pricing`, `/terms`, `/privacy` | Marketing/legal — **exclude** z UL (zůstává v Safari, otevře se in-browser) |
| `aidvisora://auth/callback` | Custom scheme fallback pro OAuth, když UL není funkční |
| `aidvisora://auth/done` | Capacitor deep-link po successful OAuth exchange |

---

## Sign-off

- [ ] iOS release owner: AASA validator prošel, entitlements přidané, UL otestován na TestFlight.
- [ ] Android release owner: assetlinks.json validní s release fingerprint, App Links verified v Play Console.
- [ ] Ops owner: oba ENV (`APPLE_TEAM_ID`, `ANDROID_SHA256_FINGERPRINTS`) jsou v produkčním Vercelu.
