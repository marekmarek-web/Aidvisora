# Aidvisora iOS – App Store Connect a revize

Kanónická kopie Xcode projektu je v **git repozitáři** pod  
`apps/web/ios/` (např. `~/Developer/Aidvisora`). Nepracujte proti duplicitní kopii v `Documents/…`, aby signing a CI nešly mimo sebe.

Pro **lokální běh a debug v Xcode** použij nejdřív `XCODE_SETUP.md`. Tento soubor řeší hlavně App Store / TestFlight / release proces.

## 1. Identifikátory (Developer Portal + App Store Connect)

Vytvořte / ověřte v [Apple Developer → Identifiers](https://developer.apple.com/account/resources/identifiers/list):

| Položka | Hodnota |
|--------|---------|
| Hlavní aplikace | `cz.aidvisora.app` |
| Share extension | `cz.aidvisora.app.share` |
| App Group | `group.cz.aidvisora.app` (zapněte u **obou** App ID) |

Capabilities u hlavní aplikace: **Push Notifications**, **App Groups** (stejná skupina jako u extension).

V **App Store Connect** vytvořte aplikaci se stejným Bundle ID `cz.aidvisora.app`, doplňte SKU, název a primární jazyk.

## 2. Signing v Xcode

- Otevřete `apps/web/ios/App/App.xcodeproj`.
- U targetů **App** a **AidvisorShareExtension**: **Signing & Capabilities** → vyberte tým, nechte **Automatically manage signing**.
- Ověřte, že archiv (Release) použije distribuční profil (Organizer po Archive).

## 3. Push (APNs)

- **Release** build používá `App.release.entitlements` s `aps-environment` = **production**.
- V Supabase (nebo jiném backendu) nahrajte **Production** APNs klíč / certifikát a otestujte push z TestFlight buildu, ne z debug zařízení.

## 4. App Privacy (Nutrition Labels) v App Store Connect

Sladěte s chováním aplikace: web v WKWebView (přihlášení, CRM), nativně kamera, galerie, dokumentový scanner, share extension, push.

V repu je `App/PrivacyInfo.xcprivacy` s deklarací API (UserDefaults, file timestamps) dle požadavků Apple. Pokud validace archivu nahlásí další **Required Reason APIs**, doplňte je do manifestu.

Ujistěte se o veřejných URL: **zásady ochrany osobních údajů** a **podpora**.

## 5. Build před archivem

Z `apps/web` (bez `CAPACITOR_SERVER_URL` pro výchozí produkční URL z `capacitor.config.ts`):

```bash
pnpm cap:sync
```

Poté v Xcode: schéma **App**, **Any iOS Device (arm64)** → **Product → Archive** → Validate → Distribute.

Pro běžný lokální debug nepřepínej na archive workflow zbytečně brzy:

- rychlý běh proti produkčnímu webu: `pnpm cap:sync`
- lokální frontend v appce: `pnpm dev` a pak `pnpm cap:dev`
- před `Run`: `Reset Package Caches` → `Resolve Package Versions` → `Clean Build Folder`

Export z příkazové řádky (volitelně, po archivu):

```bash
xcodebuild -exportArchive -archivePath …/App.xcarchive -exportPath …/export -exportOptionsPlist ios/exportOptions-appstore.plist
```

## 6. Poznámky pro App Review (šablona)

Upravte podle reálného testovacího účtu a funkcí.

```
Aidvisora je hybridní aplikace (Capacitor): hlavní obsah je Next.js na https://www.aidvisora.cz v embedded webview po přihlášení.

Nativní funkce:
- Share extension „Aidvisora Share“: sdílení souborů/obrázků do aplikace.
- Kamera a výběr z galerie pro dokumenty.
- Push notifikace (pokud jsou zapnuté).

Testovací účet:
- E-mail: …
- Heslo: …

Deep link / custom URL scheme: aidvisor:// (pokud testujete OAuth nebo návrat z externího prohlížeče).
```

## 7. Export compliance

V `Info.plist` je `ITSAppUsesNonExemptEncryption` = `false` (běžné HTTPS). V App Store Connect při submitu obvykle zvolte odpovídající odpověď k šifrování dle vašeho právního posouzení.

## 8. Xcode: „Missing package product CapApp-SPM“

Obvykle jde o nevyřešené Swift Package závislosti (lokální balíček `CapApp-SPM` táhne Capacitor pluginy z `node_modules`). V repu je **pnpm patch** na `@supernotes/capacitor-send-intent@7.0.0`: (1) `capacitor-swift-pm` **8.x** (kvůli kolizi s document scannerem), (2) SPM **produkt** `SupernotesCapacitorSendIntent` (kvůli CapApp-SPM), ale ve Swift kódu importujte modul targetu: **`import SendIntentPlugin`** (ne název produktu).

Postup po `git pull`:

1. Z kořene monorepa: `pnpm install` (aplikuje patch).
2. Z `apps/web`: `pnpm cap:sync`.
3. Při chybě kolem **grpc.zip** / extrakce `grpc`: `pnpm --filter web run ios:reset-spm` (vyčistí Swift PM artifact cache), potom znovu kroky 4–5.
4. V Xcode: **File → Packages → Reset Package Caches**, pak **File → Packages → Resolve Package Versions**.
5. Znovu **Product → Clean Build Folder** (`Shift + Cmd + K`) a build (`Cmd + B`).

## 9. Scan smoke test (před každým TestFlight buildem)

Po nainstalování nového buildu na iPhone (TestFlight Internal Testing) musí PROJÍT
tenhle checklist, jinak build neposouváme do External / produkce:

1. Přihlášení funguje (Face ID / heslo).
2. Otevřít `/portal/scan` → tlačítko **„Skenovat dokument (systémový skener)"** je viditelné
   (jen v nativním shellu, ne v Safari/PWA).
3. Ťuknout na tlačítko → iOS požádá o přístup ke kameře → potvrdit.
4. VisionKit scanner se otevře → naskenovat 1 stránku → **Uložit** → stránka se objeví jako scan.
5. Naskenovat víc stran (2–3), ověřit pořadí + možnost rotace + smazání.
6. **Zrušit** scan ("Storno" v horní liště VisionKit) → aplikace zůstane na `/portal/scan`, NEukazuje red error banner.
7. V Nastavení iPhone → Aidvisora → Vypnout přístup ke kameře → vrátit se do appky, ťuknout na
   skener → ukáže se žlutá hláška **"Aplikace nemá povolený přístup ke kameře…"**, ne obecný error.
8. Dokončit sken (znovu povolit kameru) → **Pokračovat na upload** → PDF se vygeneruje → uploadne
   do `/portal/scan/upload` → AI Review stránka se otevře s klasifikací + extrakcí.
9. V AI Review panelu má aspoň část polí **ConfidencePill** (Vysoká / Střední / Nízká).
10. Žádný crash, žádný hardstuck loading spinner déle než 30 s.

Co zkontrolovat v **Console.app** (Mac připojený přes kabel) během smoke testu:

- Žádné `Termination reason: VISIONKIT / ML-KIT`.
- Žádné `PAC / provisioning profile mismatch` při spouštění skeneru.
- `[page-image-fallback]` varování se objevuje POUZE pokud má env `AI_REVIEW_PAGE_IMAGE_FALLBACK=true`
  a jen při reálně chybějících polích (default off → warning nikdy neuvidíš).

## 10. TestFlight release checklist

Před `Product → Archive`:

- [ ] `git status` je čistý (commitnuto / pushnuto do main).
- [ ] `pnpm -w lint` + `pnpm -w typecheck` projdou.
- [ ] Bumpnutá verze v Xcode (**App** target → **General** → Version + Build).
- [ ] `pnpm cap:sync` proběhl po posledních TS/TSX změnách.
- [ ] `NSCameraUsageDescription` + `NSPhotoLibraryUsageDescription` v `Info.plist` mají aktuální český text.
- [ ] `ITSAppUsesNonExemptEncryption=false` je v `Info.plist`.

Po `Archive`:

- [ ] Organizer → Validate App → bez warningu o missing usage descriptions.
- [ ] Distribute App → App Store Connect → Upload.
- [ ] App Store Connect → TestFlight → přidat build do **Internal Testing Group**.
- [ ] Nainstalovat na iPhone → **Scan smoke test (§ 9)** musí projít.
- [ ] Přidat **What to Test** poznámku (seznam opravených + nových tras, typicky scan + AI Review).

## 11. Simulátor: „Application failed preflight checks“ (FBSOpenApplication)

Xcode občas nespustí appku a v logu je `FBSOpenApplicationErrorDomain` / `SBMainWorkspace` / důvod **Busy** a **Application failed preflight checks**. Často jde o stav simulátoru nebo start před hotovou plochou, ne o chybu v TypeScriptu.

1. **Počkat na home screen** simulátoru, pak znovu **Run** (SpringBoard občas odmítne spuštění během bootu).
2. **Jiné zařízení** v seznamu destinací (např. jiný iPhone než úplně nový model / beta OS), případně vytvořit nový simulátor ve **Window → Devices and Simulators**.
3. V simulátoru: **Device → Erase All Content and Settings…**, nebo appku smazat z plochy a znovu **Product → Run**.
4. **Xcode** → schéma **App** → **Edit Scheme…** → **Run** → **Arguments** → odškrtnout případné **prázdné** proměnné v Environment Variables (prázdná položka umí shodit launch i na betách).
5. **Product → Clean Build Folder**, případně v terminálu zkusit:  
   `xcrun simctl shutdown all`  
   pak znovu spustit simulátor a Run.
6. V repozitáři má **App** explicitní build závislost na **AidvisorShareExtension** (aby se extension vždy sestavil před embednutím do `App.app`).

Když nic z toho nepomůže, ověř **Signing** (vybraný tým) a soubor `GoogleService-Info.plist` v `App/` podle `ios` dokumentace; bez něj může build selžou dřív, ale při chybějícím nebo neplatném profilu se někdy projeví až spuštění.
