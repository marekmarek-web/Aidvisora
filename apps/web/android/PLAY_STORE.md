# Aidvisora Android – Google Play Console a Internal Testing

Kanónická kopie Android projektu je v **git repozitáři** pod
`apps/web/android/`. Nepracujte proti duplicitní kopii mimo repo.

Tento dokument popisuje **release do Internal Testing** a dál do produkce.
Pro lokální dev běh (`pnpm cap:dev`, `pnpm cap:sync`, Android Studio run) viz kořenový
README + `apps/web/capacitor.config.ts`.

## 1. Aplikační identifikátory

| Položka | Hodnota |
|---------|---------|
| Application ID | `cz.aidvisora.app` |
| Min SDK | 23 (Android 6.0) |
| Target SDK | 34 (Android 14) |
| App Bundle | AAB (ne APK) |

V **Google Play Console** (https://play.google.com/console) vytvoř novou aplikaci
se stejným Application ID `cz.aidvisora.app`.

## 2. Upload keystore (signing)

> **Kritické**: Upload keystore **NIKDY nesmí skončit v gitu ani cloudu bez šifrování**.
> Jeho ztráta = trvalé zablokování možnosti publikovat updaty.

1. Vygenerovat upload keystore:

   ```bash
   keytool -genkey -v \
     -keystore apps/web/android/app/aidvisora-upload.jks \
     -keyalg RSA -keysize 2048 -validity 10000 \
     -alias aidvisora-upload
   ```

2. Zkopírovat `key.properties.example` → `key.properties` a vyplnit hesla.
3. Zálohovat `aidvisora-upload.jks` **mimo repo** (1Password / šifrovaný USB).
4. V Play Console povolit **Play App Signing** (doporučeno) – Google drží release key,
   my držíme jen upload key.

## 3. Permissions v AndroidManifest.xml

Ověř, že jsou deklarované:

- `android.permission.INTERNET`
- `android.permission.CAMERA` (pro native Document Scanner + fotky dokumentů)
- `android.permission.READ_EXTERNAL_STORAGE` (gallery pick na SDK < 33)
- `android.permission.READ_MEDIA_IMAGES` (SDK 33+)
- `<meta-data android:name="com.google.mlkit.vision.DEPENDENCIES" android:value="docscanner" />`
  — hint pro Play Services, aby ML Kit Document Scanner modul předstáhl offline.

## 4. Build podepsaného AAB

Z `apps/web`:

```bash
pnpm cap:sync                                  # zkopíruje web build do android/
cd android
./gradlew bundleRelease                        # vytvoří app/build/outputs/bundle/release/app-release.aab
```

V Android Studiu (alternativa):

1. **Build → Generate Signed Bundle / APK** → `Android App Bundle` → vybrat upload keystore →
   `release` variant.
2. Výstup: `apps/web/android/app/build/outputs/bundle/release/app-release.aab`.

## 5. Upload do Play Console → Internal Testing

1. Play Console → **Testing → Internal testing** → **Create new release**.
2. Upload `app-release.aab`.
3. Vyplnit **Release notes** (typicky: "Native document scanner, AI Review, bug fixes").
4. **Review release** → **Start rollout to Internal testing**.
5. Přidat testery: **Internal testing → Testers → Create email list** → přidat sebe + poradce.
6. Zkopírovat **Opt-in URL** a poslat testerům.

Internal testing je většinou dostupný **do 1–2 hodin** od uploadu (rychlejší než TestFlight External).

## 6. Scan smoke test (před posunutím z Internal → Production)

Po nainstalování přes opt-in URL na Android telefonu:

1. Login funguje.
2. `/portal/scan` → tlačítko **"Skenovat dokument (systémový skener)"** je viditelné.
3. Ťuknout → systém požádá o přístup ke kameře → potvrdit.
4. ML Kit Document Scanner se otevře → naskenovat 1 stránku → **Uložit**.
5. Naskenovat 2–3 stránky → ověřit pořadí, rotaci, smazání.
6. **Cancel** (zpět) → UI zůstane na `/portal/scan` bez red error banneru.
7. Vypnout kamera permission v Nastavení → zkusit skener → žlutá hláška
   "Aplikace nemá povolený přístup ke kameře…", ne generic error.
8. Dokončit → **Pokračovat na upload** → PDF → AI Review otevře se + extrakce + Confidence pill.
9. Žádný crash, žádný ANR (Application Not Responding) dialog.

Co zkontrolovat v **Android Studio → Logcat**:

- Žádné `FATAL EXCEPTION` v `DocumentScanner` / `MLKit`.
- Žádné `java.lang.SecurityException: camera permission`.
- ML Kit download se spustí max. jednou při prvním použití (díky `docscanner` meta-data
  hintu v manifestu) a pak už je skener instantní.

## 7. Release checklist (každý Internal / Production release)

Před `./gradlew bundleRelease`:

- [ ] `git status` čistý.
- [ ] `pnpm -w lint` + `pnpm -w typecheck` projdou.
- [ ] Version bump v `apps/web/android/app/build.gradle` (`versionCode` +1, `versionName` podle SemVer).
- [ ] `pnpm cap:sync` proběhl.
- [ ] `key.properties` obsahuje správná hesla (pokud buildíš z CLI bez Android Studia).

Po uploadu AAB:

- [ ] Play Console → Release → **App content** oddíl: Data safety, Ads, App access, atd. jsou vyplněné.
- [ ] **Internal testing** rollout spuštěn.
- [ ] Scan smoke test (§ 6) projde na aspoň 1 reálném telefonu.
- [ ] Poté posouváme do **Closed testing** → **Open testing** → **Production**.

## 8. Data Safety form (Play Console → App content)

V Data Safety formuláři deklarovat:

- **Personal info** (emails, jména) → kolektované → posíláme na Supabase backend → uživatel
  může smazat účet.
- **Photos and videos** (foto dokumentů, scany) → kolektované → posíláme na Supabase Storage →
  uživatel může smazat.
- **Location**: NE (nesbíráme).
- **Device or other IDs**: NE (Capacitor + Next.js webview, žádný tracking SDK).
- Data je **v pohybu šifrováno** (HTTPS) a **v klidu šifrováno** (Supabase Storage AES).

## 9. Hlášení ve Sentry / PostHog

Po releasei sledovat:

- Sentry → Android project → nové crashes.
- PostHog → Android session replays (pokud jsou enabled) → scan journey.
- Play Console → Vitals → ANR rate, crash rate, must být < 0.5 %.
