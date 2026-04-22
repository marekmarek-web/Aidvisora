# Client Portal — Launch Runbook

> Zdroj: `client_portal_launch_audit_5e604c25.plan.md` (Appendix A/B/C).
> Kódové tasky Batch 1–3 jsou hotové. Zbývají **tři manuální ověření**,
> která nemohl vykonat agent — vyžadují reálný browser, telefon a přístup
> do Supabase/Sentry. Proklikej je přesně v tomhle pořadí a u každého
> kroku zaškrtni [x] v PR / Linear tiketu.

---

## Appendix A — Desktop (dnes večer, ~45 min)

Použij reálný testovací klientský účet (NE admin impersonate — jinak se
neodchytí session / cookie issue). Doporučený browser: Chrome inkognito
+ Safari inkognito + Firefox inkognito současně.

- [ ] **1. Invite flow**: vlož do URL `?token=expired` → kontroluj, že
      `/prihlaseni` ukazuje lidskou chybu (nikoli stack trace / 500).
- [ ] **2. První vstup bez smluv**: klient bez contractů → welcome view
      zobrazuje „Napsat poradci“ CTA (B3.12), ne prázdný dashboard.
- [ ] **3. Dashboard parity s /client/payments**: počet platebních
      instrukcí na dashboardu = počet na `/client/payments`. Ověř B1.1:
      DevTools → Network → zablokuj `getPaymentInstructionsForContact`
      (Right click → Block request URL) → F5 → dashboard musí ukázat
      **varování / "—"**, NIKDY "0 instrukcí" jako validní stav.
- [ ] **4. Legacy redirecty**: `/client/contracts` i `/client/investments`
      přesměrují na `/client/portfolio` (HTTP 307 v Network tab).
- [ ] **5. Dokumenty**: PDF náhled (iframe) otevřít v Chrome, Safari,
      Firefox. Fullscreen + close. Download. Upload (DnD + file picker).
- [ ] **6. Platby**:
      - Kliknout „Kopírovat číslo účtu“ → očekáváno: toast „Hotovo“.
        V Safari private mode → fallback na `Nelze` (B2.6) funguje.
      - Platba bez částky → QR tlačítko disabled s tooltipem (B3.10).
      - Platba s `quarterly` frekvencí → UI ukáže českou variantu (B3.2).
- [ ] **7. Portfolio**: rozklik produktu → FV blok + SHARED_FV_DISCLAIMER.
      Deep link `/client/portfolio/<contractId>` (B3.3) otevře detail.
      Sensitive dokumenty NESMÍ leaknout (otevři DevTools → Response
      pro `getDocumentsForClient` a ověř že všechny řádky mají
      `visibleToClient=true`).
- [ ] **8. Requests**:
      - `/client/requests/new` → formulář se vykreslí (B1.10), ne redirect.
      - Deep link `/client/requests/new?caseType=investment` → předvyplní
        typ.
      - Feature flag `client_portal.allow_service_requests=false` →
        dashboard skrývá CTA „Nový požadavek“ (B2.4).
- [ ] **9. Pozadavky-poradce**: otevři řádek, nahraj 3 přílohy, jednu
      označ jako „failing“ (např. soubor > 25 MB). Ověř B1.6:
      status v UI je `partial`, nikoli falešně `answered`.
- [ ] **10. Zprávy**: odešli zprávu, zavři tab, otevři znovu → zpráva je
      tam. DevTools → Network throttling „Offline“ na 30 s → po 10 s se
      objeví stale banner „Nelze obnovit“ s tlačítkem „Zkusit znovu“
      (B1.5).
- [ ] **11. Profil**: edit, uložit, znovu otevřít — změny přežijí.
      2FA text NESMÍ obsahovat „Supabase“ (B3.2 glossary).
      Vypni síť → stránka musí ukázat error card (B1.9), nikdy bílou
      obrazovku.
- [ ] **12. Notifikace**: pro každý typ v `portal-notification-routing.ts`
      klikni a ověř redirect. Pak přes Supabase SQL insertni notifikaci
      s `type='foo_unknown'` → klik vrátí toast „Tato akce již není
      dostupná“ (B1.7), NIKOLI tichý dead click.
- [ ] **13. GDPR export**: klik na „Export mých dat (GDPR)" → stáhne se
      JSON soubor `export-dat-YYYY-MM-DD.json`. Zhoď server a klikni
      znovu → error card pod tlačítkem (B2.7). (TXT export je post-launch
      follow-up — pre-launch stačí JSON; rozhodnutí viz
      Product owner decision #B2.14.)
- [ ] **14. AI Support**: otevřít, dotaz „Jaký mám zůstatek?“ — musí
      odpovídat lidsky, ne technicky.
- [ ] **15. Odhlášení**: logout → redirect na `/prihlaseni`.

Výsledek: **všech 15 [x]** = desktop ready. Pokud cokoli FAIL →
zapsat do Linear s PRIORITY blocker a NEPUSHOVAT do production.

---

## Appendix B — Mobil (reálné zařízení, ~30 min)

NEEMULUJ. iOS Safari + Chrome Android na dvou fyzických telefonech
(ideálně iPhone SE malý + iPhone 15 Pro Max velký).

- [ ] **1. Beta cookie**: `document.cookie="mobile_ui_v1_beta=1"` v
      DevTools → reload → načte se mobilní shell. (Kanonický název flagy
      je `mobile_ui_v1_beta` — viz `apps/web/src/app/shared/mobile-ui/feature-flag.ts`.
      Starší `clientMobileShell` byl přejmenován; pokud jsi ho v prohlížeči
      měl nastavený, smaž ho.)
- [ ] **2. Bottom nav ergonomie**: všechna tlačítka dosažitelná
      palcem. FAB nepřekrývá obsah. Safe area respektována (iOS 15 Pro
      Max notch + iPhone SE bez notch).
- [ ] **3. Přechod `/client/navrhy`**: není v SPA paths → full reload
      → layout se nerozbije.
- [ ] **4. Notifikace tap**: stejné target URL jako desktop (B1.11
      sjednocený routing).
- [ ] **5. Chat**: softkey (klávesnice) push compose bar. Attachment
      upload (přes `capture=camera`) funguje.
- [ ] **6. Platby QR modal**: na iPhone SE se vejde (`max-h-[min(92dvh,640px)]`).
- [ ] **7. Portfolio chips**: horizontal scroll / snap funguje bez
      jumpů.
- [ ] **8. Hlavička subtitle**: „Platby a příkazy“, „Moje portfolio“,
      „Oznámení“ (B2.9) — žádné „segmenty“ / „evidence“.
- [ ] **9. Document preview fullscreen**: iOS URL bar neskáče při
      zobrazení. Zavření fullscreen vrátí do seznamu.
- [ ] **10. Calculators**: render OK při 320 px šířce.

Výsledek: **všech 10 [x]** = mobile ready.

---

## Appendix C — Zítra ráno (pre-launch, ~60 min)

### C.1 Deploy smoke test (10 min)
- [ ] `vercel ls` — produkce má nejnovější commit s Batch 1–3 merge.
- [ ] `/client` vrací 200 (curl z externího IP).
- [ ] Alespoň 3 ze CRITICAL fixes projdou smoke:
      B1.1 (zhodit payments query), B1.5 (zhodit polling), B1.9
      (zhodit profile load) → UI reaguje user-friendly, ne white screen.

### C.2 DB sanity (15 min) — spustit jako DB admin v Supabase SQL editoru
```sql
-- B2.3 assumption: 1 auth_user = 1 membership pro klientskou roli.
SELECT auth_user_id, COUNT(*) AS memberships
FROM memberships
GROUP BY auth_user_id
HAVING COUNT(*) > 1;
-- Očekáváno: 0 řádků. Pokud > 0 → zkontroluj Sentry warningy z
-- `[getMembership] multi-membership user`.
```
```sql
-- B1.2/B1.3 / ghost payments:
SELECT id, contact_id, created_at, visible_to_client
FROM client_payment_setups
WHERE visible_to_client = false
  AND created_at > NOW() - INTERVAL '7 days';
-- Očekáváno: buď prázdné, nebo všechny řádky mají
-- `needsHumanReview=true` (advisor si je vědom).
```
```sql
-- B1.3 / supporting docs zapomenuté:
SELECT id, contact_id, created_at, visible_to_client, tag_list
FROM documents
WHERE visible_to_client = false
  AND tag_list @> ARRAY['ai-smlouva']
  AND created_at > NOW() - INTERVAL '7 days';
-- Očekáváno: 0 řádků = všechny AI smlouvy prošly rozhodnutím.
```
```sql
-- B2.2 / klient bez portal access má visible_to_client:
SELECT c.id, c.contact_id
FROM contracts c
LEFT JOIN client_contacts cc ON cc.contact_id = c.contact_id
WHERE c.visible_to_client = true
  AND cc.contact_id IS NULL
  AND c.updated_at > NOW() - INTERVAL '7 days';
-- Očekáváno: 0 řádků (B2.2 guard).
```

### C.3 Sentry alerts (10 min)
- [ ] `client_portal.payments_load_fail` alert — threshold 5 za 10 min.
- [ ] `client_portal.profile_render_fail` alert — threshold 1 za hodinu.
- [ ] `client_portal.chat_polling_fail` — threshold 20 za 10 min
      (rate-limit aware).
- [ ] `getMembership.multi_membership_user` warning — any.

### C.4 Email / notif smoke (10 min)
- [ ] Resend webhook: pošli testovací notifikaci `new_message` →
      ověř že in-app bell badge inkrementuje AND email dorazí AND deep
      link otevře správnou route.

### C.5 Rollback (5 min)
- [ ] Feature flag `clientPortalEnabled=false` otestovaný v stagingu —
      klient dostane „Portál v údržbě“ statiku.
- [ ] Git revert commit ID uložený v on-call Slack kanálu.

### C.6 On-call (5 min)
- [ ] Slack #client-portal-launch kanál vytvořen.
- [ ] Primární on-call eskalační kontakt na telefonu 08:00–20:00 CET
      první 48 h.

### C.7 Go / No-go
- [ ] Všechny body C.1–C.6 [x] → **GO**.
- [ ] Cokoli FAIL → **NO GO**, odsunout launch o 24 h.

---

## Post-launch monitoring (prvních 48 h)

- [ ] Sentry error rate na `/client/**` < baseline * 1.5.
- [ ] Support tickety s klíčovými slovy „nevidím platbu“, „klikám nic“,
      „neposlal se“ → max 3 za den.
- [ ] Klientská konverze invite → login > 60 %.

---

## Appendix D — Native mobile release (iOS TestFlight + Android Internal)

Tento appendix je přidán po „mobile audit repair plan“ batchi.
Splň všechny checkboxy před submission do TestFlight / Play Internal Testing.

### D.1 Pre-build asserts (`cd apps/web`)

- [ ] `pnpm assert:fcm-config:release` → všechny checky OK.
      V CI injektuj `google-services.json` a `GoogleService-Info.plist` z
      `GOOGLE_SERVICES_JSON_B64` / `GOOGLE_SERVICE_INFO_PLIST_B64` secrets
      (viz `docs/runbook-push.md`).
- [ ] `node scripts/ios-preflight.mjs` → 0 failures.
- [ ] `pnpm build` a `pnpm cap:sync` → bez chyb.

### D.2 Deep-link handshake (real device)

- [ ] GET `https://aidvisora.cz/.well-known/apple-app-site-association`
      → `Content-Type: application/json`, `applinks.details[0].appIDs` má
      aspoň jednu hodnotu `<TeamID>.cz.aidvisora.app`.
- [ ] GET `https://aidvisora.cz/.well-known/assetlinks.json` →
      pole s aspoň jedním `sha256_cert_fingerprints` (Play App Signing
      release fingerprint).
- [ ] GET `/api/health/deep-links` → HTTP 200, `status: "ok"`.
      V produkci MUSÍ být 200 — jinak je univerzální linky rozbité.
- [ ] iOS: v Notes napsat `https://aidvisora.cz/portal/today` → tap →
      otevře se v aplikaci, NE v Safari.
- [ ] Android: Termux `am start -W -a android.intent.action.VIEW -d
      "https://aidvisora.cz/portal/today"` → aplikace chytne deep link.

### D.3 Navigation regression (reprodukce hlášeného bugu)

Na reálném zařízení (ne simulátoru):

- [ ] `/portal/pipeline` → kliknout na kartu → `/portal/pipeline/:id`
      otevře detail. Header back → zpět na `/portal/pipeline`. Znovu
      otevřít stejnou kartu → stejně, bez skoku o 2 obrazovky.
- [ ] `/portal/today` → hamburger → otevřít drawer → Android hw-back
      nebo iOS swipe → zavře drawer. Druhý back → vrátí se o route zpět
      (ne exit).
- [ ] `/portal/pipeline/:id` → otevřít bottom sheet (poznámka / akce)
      → android hw-back → zavře SHEET, ne route. Další back → zavře
      route → `/portal/pipeline`.
- [ ] V libovolné modální obrazovce stisknout Escape (BT klávesnice) →
      zavře overlay (ne route).

### D.4 Keyboard + safe-area

- [ ] Focus do `<input>` v `FullscreenSheet` → klávesnice se objeví
      bez překryvu pole (iOS `KeyboardResize.Native` + Android
      `windowSoftInputMode=adjustResize`).
- [ ] Splash screen se schová do 1 s po first paint.
- [ ] Status bar má správný kontrast (světlý text na tmavém pozadí
      v dark mode, obráceně v light mode).

### D.5 Push notifikace

- [ ] iOS: po cold startu se objeví soft prompt modal „Povolit push
      notifikace?“ — teprve po stisku „Povolit“ systémový dialog.
- [ ] Android (až bude aktivní): `google-services.json` přibalen do
      release APK (`unzip -l app-release.apk | grep google-services`
      nebo `aapt dump`).
- [ ] Zaslaná testovací notifikace otevře správnou deep-link routu.

### D.6 Pre-submit checklist

- [ ] `pnpm vitest run src/app/shared/mobile-ui src/app/portal/mobile` →
      všechny testy PASS.
- [ ] E2E Playwright mobile profile → navigation happy path PASS.
- [ ] `bash scripts/cap-smoke.sh` (viz `apps/web/scripts/cap-smoke.sh`) →
      build + sync + warm-start simulátoru + back-button dispatch bez
      chyb.
- [ ] Xcode Archive → TestFlight: build se objeví v processingu.
- [ ] Play Console → Internal testing track: release rollout 100 %.

### D.7 Rollback plán

- [ ] iOS: v App Store Connect → Expedited review nejde sám; pošli
      hotfix build s incrementem `CFBundleVersion`. Minimum 2 h cesta
      od commitu k dostupnosti v TestFlight.
- [ ] Android: Play Console → zrušit internal rollout → vrátit se na
      předchozí release (preserve install base), nebo halted rollout
      do 0 %.

