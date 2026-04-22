# Post-launch roadmap (Batch 4)

**Verze:** 2026-04-22
**Stav:** navazuje na Batch 1/2/3 oprav z `aidvisora pre-launch repair plan`
(viz `.cursor/plans/aidvisora_pre-launch_repair_plan_6abee001.plan.md`).

Tento dokument NENÍ launch blocker — jsou to high-ROI zlepšení pro první
4–8 týdnů po go-live. Každá položka má owner, trigger a akceptační kritérium,
aby nezapadla do „někdy v budoucnu".

---

## B4.1 · Cutover na `aidvisora_app` runtime role

- **Dnes:** prod DB běží přes `DATABASE_URL` s BYPASSRLS; runtime čte/zapisuje
  bez ohledu na RLS policy (testujeme je separátně v CI).
- **Trigger:** Batch 1/2/3 merged + staging burn-in 2 týdny bez regrese.
- **Kroky:**
  1. `apps/web/src/lib/security/__tests__/ws2-batch6-full-swap-readiness.test.ts`
     L166-170 placeholder → hard assertion proti live `aidvisora_app`.
  2. Přidat `DATABASE_URL_SERVICE` (BYPASSRLS) pro cron endpointy / service identity.
  3. Přepnout `DATABASE_URL` na `aidvisora_app` role (non-BYPASSRLS).
  4. Staging burn-in: 14 dní s produkční mixem tenantů (interní + pilot).
  5. Prod swap v maintenance window (30 min předem banner přes kill-switch).
- **Akceptace:** 14 dní bez RLS-related 500s v Sentry, všechny cron joby běží zelené.
- **Rollback:** env variable swap zpět; žádné DB změny.

## B4.2 · PII plaintext column drop

- Navazuje na migraci `pii-encrypt-contacts-columns-2026-04-21`. Dnes běží v
  dual-read režimu (plaintext `personal_id` + `personal_id_ciphertext`).
- **Trigger:** 30 dní po B4.1 bez čtení z plaintextového sloupce (Sentry nemá
  event `pii.plaintext_read_fallback`).
- **Kroky:**
  1. Potvrdit, že všechny read call sites čtou přes `decryptPersonalId()`.
  2. Migrace `packages/db/migrations/drop-contacts-personal-id-plaintext-YYYY-MM-DD.sql`.
  3. Po 7 dnech bez issues: `DROP COLUMN personal_id` (není pgvector-like
     index).
- **Akceptace:** `information_schema.columns` pro `contacts.personal_id` = 0.

## B4.3 · Contact dedup fuzzy matching

- Dnes dedup v `apps/web/src/lib/ai/apply-contract-review.ts` L821-874 porovnává
  `LOWER(email)` nebo `normalizedPhone`. Nechytá:
  - email s diakritikou vs. bez (`dan@Áčko.cz` vs. `dan@acko.cz` — idna rozdíl).
  - telefon v mezinárodním vs. lokálním formátu.
  - jméno + diakritika + poslední 6 čísel telefonu jako soft-match.
- **Trigger:** 3+ hlášení „kontakt se duplikoval i když jsem zadal stejný e-mail"
  od pilotních poradců.
- **Kroky:**
  1. Dopsat `normalizeContactIdentity(contact)` → `{ emailKey, phoneKey, nameKey }`.
  2. Rozšířit dedup query o fuzzy `nameKey` + poslední 6 digits phone.
  3. Telemetrie `contact.dedup.soft_match` + `contact.dedup.blocked_merge`.
- **Akceptace:** < 1 duplicitní contact / 100 importů smluv.

## B4.4 · Contract dedup hardening

- Aktuálně ve stejném souboru řeší M3 („Multi-contract per domain"), ale pro
  definitivní dedup vyžaduje 2+ signály (partner + contractNumber NEBO partner
  + contact).
- **Kroky:**
  1. Rozšířit `resolveExistingContractForDedup()` o contract number normalization
     (strip leading zeros, whitespace).
  2. Přidat unit testy v `apps/web/src/lib/ai/__tests__/apply-contract-review-dedup.test.ts`.
- **Akceptace:** 0 duplicitních contractů při opětovném nahrání identické smlouvy.

## B4.5 · Document ↔ contract n:n join table

- Dnes má `documents.contractId` 1:1, což blokuje bundle PDF obsahující 2
  smlouvy. Řešíme to příznakem „first contract wins" → druhý nemá attached doc.
- **Kroky:**
  1. Nová tabulka `document_contract_links (document_id, contract_id, role)`.
  2. Backfill z `documents.contractId`.
  3. Udržet legacy sloupec pro rollback 30 dní, pak DROP.
- **Akceptace:** Portfolio detail i klientský portál ukazuje oba contracty
  s odkazem na stejný source document.

## B4.6 · Granulární kill-switches per feature

- Dnes máme 9 flagů (`MAINTENANCE_MODE`, `AI_REVIEW_UPLOADS_DISABLED`, atd.).
  Chybí: `INVITE_DISABLED`, `AI_DRAWER_DISABLED`, `PAYMENTS_PORTAL_DISABLED`.
- **Kroky:**
  1. Rozšířit `ALL_FLAG_KEYS` v `apps/web/src/lib/ops/kill-switch.ts`.
  2. Napojit na odpovídající route handlery.
- **Akceptace:** Admin UI na `/portal/admin/kill-switches` ukazuje všechny.

## B4.7 · Native Sentry (`@sentry/capacitor`)

- Dnes iOS/Android shell nemá vlastní crash reporter; native JS chyby chytne
  Sentry web, ale native crash (memory, signal, forced unwind) ztratíme.
- **Kroky:**
  1. `pnpm add @sentry/capacitor` + iOS pod install.
  2. `Sentry.init` v `apps/mobile/*` init cestě.
  3. Smoke test crash v staging build.
- **Akceptace:** Forced crash produce Sentry event typu `native`.

## B4.8 · Android FCM push

- Per `docs/release-v1-decisions.md` je Android push v1 intentional deferred.
  Cíl: po Android Play Store public listing rollout.
- **Kroky:**
  1. `google-services.json` escrow (Vault / 1Password Team).
  2. Server-side nastavit FCM sender ID do env.
  3. Otevřít gate v `apps/web/src/lib/push/usePushNotifications.ts`.
- **Akceptace:** Android test device dostane push po birthday cron spuštění.

## B4.9 · Universal Links + App Links

- Dnes deep link `/client/notifications/<id>` otevře mobilní browser, ne nativní app.
- **Kroky:**
  1. `/.well-known/apple-app-site-association` (iOS) — associated paths.
  2. `/.well-known/assetlinks.json` (Android) — SHA-256 fingerprint.
  3. Next.js rewrite: oba soubory přes `public/` s `application/json` MIME.
- **Akceptace:** Klik na deep link v iMessage otevře nativní app.

## B4.10 · Stripe `DUNNING_RESTRICTED` hard suspend

- Dnes dunning banner soft-reminder + UI zpráva; žádné hard gate na API.
- **Kroky:**
  1. Rozšířit `plan-access-guards` o `assertSubscriptionState(tenant).not(unpaid)`.
  2. Vrátit `402 Payment Required` s JSON `{ code: "DUNNING_RESTRICTED" }`.
  3. Handle na frontendu — redirect na billing portal.
- **Akceptace:** Unpaid tenant nemůže psát do DB (čte jen read-only).

## B4.11 · Household shared products visibility

- Dnes `contracts.visibleToClient` gate-uje viditelnost vlastníkovi contractu,
  ale neuvidí ji manžel/ka / dítě v household.
- **Kroky:**
  1. Nový flag `contracts.householdVisible` (default false).
  2. Klientský portál query rozšíří o `OR (householdVisible AND household_match)`.
  3. UI toggle v advisor portal payment modal.
- **Akceptace:** Manžel vidí pojistku manželky, pokud poradce zapnul
  `householdVisible`.

## B4.12 · TXT export (pokud ne B2.14)

- Per B2.14 rozhodnutí jsme odstranili z runbooku. Pokud klienti budou TXT
  export požadovat, implementovat `buildClientZoneTxtExport(bundle)` helper.

## B4.13 · Contact dedup telemetry

- Navazuje na B4.3: po rolloutu fuzzy dedup chceme vidět, kolik merges bylo
  blokováno a kolik partner-only single-match path triggered.
- **Kroky:**
  1. Nový event `contact.dedup.blocked_merge` + `contact.dedup.partner_only`.
  2. Dashboard v PostHog / Sentry Metrics.

## B4.14 · Business plan „servicing advisor" column

- Dnes creator == servicing advisor (na všech metrikách), což je nepřesné
  po B2.5 offboarding re-assignment. Oddělit na `creator_advisor_id` a
  `servicing_advisor_id` v BJ / business plan metrikách.

---

## Ownership

Všechny položky primárně CTO (Marek). Owner sign-off v komentáři PR + merge
do `main`. Priority pořadí: B4.1 > B4.2 > B4.8 > B4.9 > B4.10 > B4.3 > B4.4 >
ostatní.
