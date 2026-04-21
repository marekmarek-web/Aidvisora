# iOS Universal Links vs. Custom URL Scheme — rozhodnutí

> **TL;DR:** Aidvisora používá **custom URL scheme** (`aidvisora://`) jako
> primární deep-link mechanismus a **Universal Links** jako sekundární vrstvu,
> která se zapne okamžitě po prvním App Store buildu s podepsaným Team ID. Tím
> pokrýváme a) OAuth/invite callbacky (stačí custom scheme) a b) hezký UX při
> klikání na `https://www.aidvisora.cz/portal/...` linky v mailech/Slacku (to
> řeší Universal Links).

---

## 1. Stav dnes

- `Info.plist` má `CFBundleURLSchemes = ["aidvisor", "aidvisora"]` — oba
  custom schemes fungují pro OAuth/invite returns a basic app-to-app linky.
- **Žádné** `apple-app-site-association` (AASA) ještě nebylo nasazené na
  produkci, dokud neměla Aidvisora zapsaný Apple Developer Team ID.
- `capacitor.config.ts` posílá WebView na produkční URL, takže „hluboký link"
  typicky stačí otevřít WebView přes custom scheme a web si poradí.

## 2. Proč oba mechanismy zapneme

| Use case | Custom scheme stačí? | Universal Links stojí za to? |
|---|---|---|
| OAuth callback (Google/Apple) | Ano (Supabase vrací přes schema) | Ne — zbytečná komplikace. |
| Invite mailem s odkazem `https://www.aidvisora.cz/invite/…` | Ne (Safari otevře web) | **Ano** — chceme, aby iOS kliklo rovnou do appky. |
| Sdílení detailu klienta kolegovi z týmu | — | Ano — produktivní UX. |
| QR code pro klienta (`/client/…`) | — | Ano. |
| Push notifikace s `deep_link` polem | Ano | Ano — rozdíl negligible, pokud appka v background. |

Závěr: custom scheme = fallback a OAuth, Universal Links = primární mailový a
sdílecí kanál.

## 3. Technická implementace

### 3.1 AASA endpoint

Apple fetchuje `https://www.aidvisora.cz/.well-known/apple-app-site-association`
a vyžaduje:

- Content-Type `application/json` (ne `application/json; charset=utf-8`, ne
  `text/plain`).
- **Bez přípony `.json`** v URL.
- **Bez redirectů** — Apple nekoná HEAD/GET follow.
- Validní JSON bez komentářů.

V Aidvisoře:

- Next.js route handler: `apps/web/src/app/api/apple-app-site-association/route.ts`.
- Rewrite v `apps/web/next.config.js`:
  `/.well-known/apple-app-site-association` → `/api/apple-app-site-association`.
- Team ID se plní z env `APPLE_TEAM_ID` (Vercel → Production).

### 3.2 Entitlements (Xcode)

Až přepneme na Universal Links, v Xcode projektu přidáme:

1. Signing & Capabilities → **+ Capability → Associated Domains**.
2. Do pole `applinks:` přidat:
   - `applinks:www.aidvisora.cz`
   - `applinks:aidvisora.cz` *(bez `www` — pro redirect entry point)*
   - `webcredentials:www.aidvisora.cz` *(pokud budeme chtít Autofill hesel)*.
3. Zkontrolovat, že `App.entitlements` má nově blok:
   ```xml
   <key>com.apple.developer.associated-domains</key>
   <array>
     <string>applinks:www.aidvisora.cz</string>
     <string>webcredentials:www.aidvisora.cz</string>
   </array>
   ```
4. Build + install na reálné zařízení. Simulator UL často neotestuje správně —
   Apple je aggresivní v cachování AASA.

### 3.3 Ověření

```bash
# 1) Apple fetch simulace — musí vrátit JSON, 200, `application/json`.
curl -sI https://www.aidvisora.cz/.well-known/apple-app-site-association
# Expect:
#   HTTP/2 200
#   content-type: application/json

# 2) Validátor od Apple (browser).
open "https://branch.io/resources/aasa-validator/?domain=www.aidvisora.cz"

# 3) Ověření na zařízení — po install sendbuildu:
#    Otevři `Safari → https://www.aidvisora.cz/portal/today`.
#    iOS by měl nabídnout banner „Open in Aidvisora" nebo rovnou přepnout.
```

Pokud UL nefungují, nejčastější důvody:

- Team ID v `APPLE_TEAM_ID` nesedí na ten, pod kterým je signed build.
- CDN cachuje AASA se špatným Content-Typem — vyčisti cache rewrite routy.
- User otevřel link z aplikace, která má in-app browser bypass (WhatsApp na
  iOS např. UL ignoruje, pokud nemá povolené „Open in default browser").

## 4. Rollout plán

| Milestone | Co se stane |
|---|---|
| **Dnes (FL-4)** | AASA endpoint existuje, vrací prázdné `details`. Build bez Associated Domains. Custom scheme funguje. |
| **Before App Store submit** | Vyplnit `APPLE_TEAM_ID` ve Vercel env. AASA začne vracet reálné `details`. V Xcode přidat Associated Domains. Nový build → TestFlight. |
| **App Store review** | Reviewer uvidí, že appka reaguje na `https://www.aidvisora.cz/...` linky. Nic explicitně netestuje, ale UL = dobrý signál UX kvality. |
| **Po release** | Zapnout UL i pro `aidvisora.cz` (bez `www`), jakmile bude dokončený `www.` redirect na produkci. |

## 5. Ponechané custom schemes

Custom schemes `aidvisor://` a `aidvisora://` **nemažeme**. Důvody:

1. Supabase Auth má nastavený `aidvisora://auth/callback` jako return URL pro
   Apple Sign-In / Google OAuth. Přepsání na UL by znamenalo měnit i
   Supabase dashboard + Apple Services ID.
2. Offline fallback — když appka dostane link ze zdroje, kde UL nefunguje,
   custom scheme zůstává záchranná síť.
3. Share Extension (`AidvisorShareExtension`) používá custom scheme pro předání
   obsahu do hlavní appky.

## 6. Neřešíme (v1.0)

- **Android App Links** (`/.well-known/assetlinks.json`) — Capacitor Android
  build není v iOS prvním release okně. Přidáme, až se bude dělat Android v1.
- **Dynamic Links** (Firebase) — zbytečná 3rd-party závislost, UL pokrývají
  všechny use cases, které máme.
- **Deferred Deep Links** (open link před instalací) — mimo scope v1.
