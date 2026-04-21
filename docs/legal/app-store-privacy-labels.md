# App Store Privacy Nutrition Labels — Aidvisora

**Delta A14 — Manuální kroky v App Store Connect před submission.**

Apple vyžaduje, aby Privacy Nutrition Labels v App Store Connect **přesně odpovídaly**
skutečnému sběru dat app + všech jejích SDK. Zdroj pravdy pro app obal je
`apps/web/ios/App/App/PrivacyInfo.xcprivacy`. Capacitor a Supabase SDK přidávají vlastní
kategorie, které musí být zahrnuty.

---

## Data Types sekce v App Store Connect

Pro každou kategorii níže zaškrtněte uvedené podpoložky a pro každou uveďte, že je
**Linked to User** a **NOT used for Tracking**.

### 1. Contact Info → **Email Address**, **Name**, **Phone Number**

- **Use:** App Functionality, Authentication *(pro e-mail)*
- **Linked:** ✅ Yes
- **Tracking:** ❌ No
- **Zdroj:** Supabase Auth, user profiles

### 2. Identifiers → **User ID**, **Device ID**

- **Use:** App Functionality, Authentication *(pro User ID)*
- **Linked:** ✅ Yes
- **Tracking:** ❌ No
- **Zdroj:** Supabase `auth.uid()` + FCM device token

### 3. User Content → **Photos or Videos**

- **Use:** App Functionality
- **Linked:** ✅ Yes
- **Tracking:** ❌ No
- **Zdroj:** Skenování dokumentů (kamera), upload PDF obrázků

### 4. Diagnostics → **Crash Data**, **Performance Data**, **Other Diagnostic Data**

- **Use:** App Functionality, Analytics
- **Linked:** ✅ Yes
- **Tracking:** ❌ No
- **Zdroj:** Sentry SDK (crash reports, performance tracing), application logs

### 5. Financial Info → *(NEZAŠKRTÁVAT — neukládáme čísla karet)*

- Platby zpracovává **Stripe** přes Stripe Customer Portal (web-only). V iOS appce se
  objednávky neinicuují → financial info nesbíráme.

### 6. Sensitive Info → *(NEZAŠKRTÁVAT)*

- OP/rodná čísla ukládáme, ale Apple kategorizuje jako "Other Identifiers" / custom.
  ASSUMPTION: deklarujeme pod **Identifiers → Other Identifiers** pokud App Review chce
  striktnější rozpad. Default = nesbíráme pro Apple nutrition labels účely (data jsou
  součástí User Content uploadem dokumentu).

### 7. Health & Fitness, Location, Browsing History, Search History, Sensor Data,
   Purchases, Audio Data, Contacts, Gameplay Content, Customer Support → ❌ **No**

---

## Use of Data — per kategorie

Apple vyžaduje, aby u každé zaškrtnuté položky bylo uvedeno **přesně jedno ano/ne** na:

| Účel | Co vybrat | Proč |
| --- | --- | --- |
| **Third-Party Advertising** | ❌ | Neděláme žádný ad tracking |
| **Developer's Advertising or Marketing** | ❌ | Žádné email marketing kampaně z appky (pouze transakční) |
| **Analytics** | ✅ — jen Diagnostics kategorie | Sentry performance / crash |
| **Product Personalization** | ❌ | Žádná personalizace obsahu |
| **App Functionality** | ✅ — všechny kategorie | Primární účel |
| **Other Purposes** | ❌ | — |

---

## Tracking — celkově

- **Does this app use data for tracking?** → **NO**
- Podmínka: neprovozujeme žádnou reklamu, nesdílíme data s data brokery, nepoužíváme SDK
  typu Facebook SDK, TikTok pixel, AppsFlyer, Branch apod.
- ATT (App Tracking Transparency) dialog **NESPOUŠTÍME** — žádný `NSUserTrackingUsageDescription`
  ani `AppTrackingTransparency` request v AppDelegate.

---

## Data Collection — Per SDK accounting (interní audit)

Tento blok **nepatří** do App Store Connect (Apple se neptá per-SDK), ale je to interní
důkaz pro DPA due diligence a pro ověření, že PrivacyInfo.xcprivacy pokrývá vše:

| SDK / Endpoint | Data | Účel | Kategorie pro Nutrition Labels |
| --- | --- | --- | --- |
| `@supabase/supabase-js` | E-mail, UserID, JWT | Auth, data read/write | Contact Info, Identifiers |
| `@supabase/storage-js` | Soubory (PDF, obrázky) | Ukládání dokumentů | User Content |
| `@sentry/browser`, `@sentry/capacitor` | Stack traces, breadcrumbs, perf spans, device info | Crash + performance monitoring | Diagnostics |
| `@capacitor/push-notifications` + FCM | APNs/FCM token | Push delivery | Identifiers (Device ID) |
| `@capacitor/camera` | Photos (dočasně v paměti před uploadem) | Sken dokumentů | User Content |
| **Anthropic API** *(server-side)* | Obsah PDF / zpráva | AI review dokumentů | — *(Server-side, ne SDK v appce)* |
| **OpenAI API** *(server-side)* | Obsah dokumentu při fallback AI run | AI review | — |
| **Resend** *(server-side)* | Recipient e-mail, body | Transakční maily | — |
| **Stripe** *(server-side, Customer Portal)* | Platby | Billing | — |

Server-side dodavatelé nejsou uvedeni jako "SDK" v Nutrition Labels, ale musí být uvedeni
v `/privacy` + `/bezpecnost` subprocessor listu a v DPA registru
(`docs/legal/dpa-register.md`).

---

## Manuální kroky před každou submission

1. **Otevři App Store Connect → My Apps → Aidvisora → App Privacy**.
2. Zkontroluj, že:
   - [ ] Data Types sekce obsahuje přesně to, co je výše.
   - [ ] Tracking = **No**.
   - [ ] Privacy Policy URL = `https://aidvisora.cz/privacy`.
3. Pokud jste v posledním release přidali nový SDK nebo integraci:
   - [ ] Aktualizuj `apps/web/ios/App/App/PrivacyInfo.xcprivacy`.
   - [ ] Aktualizuj tento dokument.
   - [ ] Aktualizuj App Store Connect labely.
   - [ ] Aktualizuj `/privacy` text.
4. Pokud Apple App Review zamítne pro nesoulad (Guideline 5.1.2):
   - [ ] Porovnej screenshots z rejection s naším `PrivacyInfo.xcprivacy`.
   - [ ] Nejčastější chyba: **Tracking = Yes** (my máme No).
   - [ ] Druhá nejčastější: chybějící User ID v Identifiers.

---

## Validace pre-submission

V Xcode před archivací spusť **Product → Build** a zkontroluj, že warning
`NSPrivacyAccessedAPITypeReasons` na žádném SDK. Apple validator běží automaticky při
upload do App Store Connect. Pokud spadne, log obsahuje přesný missing reason kód.

Reason codes reference: <https://developer.apple.com/documentation/bundleresources/privacy_manifest_files/describing_use_of_required_reason_api>

---

## Sign-off

- [ ] iOS release owner (Marek): validoval proti aktuálnímu `PrivacyInfo.xcprivacy`.
- [ ] Legal owner: odsouhlasil text per-kategorie.
- [ ] Před submission check: znovu projet výše uvedenou tabulku.
