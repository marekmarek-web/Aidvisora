# Human decisions required before launch

**Verze:** 2026-04-22
**Status:** bloker pro pár batch 1/2 merges. Bez rozhodnutí product ownera
je buď implementace nejasná, nebo je výsledek v rozporu s legal / UX záměrem.

Pro každé rozhodnutí je: kontext, options, doporučení, impact.

---

## D1 · GDPR export strategy (B1.3)

**Kontext:** `apps/web/src/app/actions/gdpr.ts` dnes exportuje full SAR
(včetně interních poznámek). Legal ale není explicitní, zda aligned-policy
(= jen klientský portál scope) nebo full SAR.

**Options:**
- **A — Aligned-visibility:** filtrovat contracts/documents/payment_setups podle
  `visibleToClient=true`; `contact.notes` odstranit. Menší právní risk.
- **B — Full SAR:** export všeho, co o klientovi existuje. Plná GDPR compliance,
  ale vyžaduje legal sign-off + UI copy update („stahujete veškeré záznamy").

**Doporučení:** **A** pro launch (minimální risk, beta poradci mají interní
poznámky). Přepnout na B, pokud právník po auditu schválí + UI refaktor.

**Impact:** implementované jako A (B1.3 je hotové). Pokud přepneme na B,
vrátit `visibleToClient` filter a přidat copy do `/privacy`.

## D2 · PII backfill vs. landing page oslabení (B1.4)

**Kontext:** landing page tvrdila „AES-256-GCM šifrování". V prod DB jsou
historické `personal_id` plaintext. Po `pii-encrypt-contacts-columns-2026-04-21`
nové writes jsou cipher, ale staré řádky jsou plain dokud nedoběhne backfill.

**Options:**
- **A — Spustit backfill** před launchem. Vyžaduje 1-2 h maintenance window
  + monitoring (nesmí překročit pool limit).
- **B — Oslabit landing copy** na „AES-256-GCM šifrování nových citlivých
  polí; historická data šifrujeme postupně". Přesnější, ale slabší marketing.

**Doporučení:** **A**. Maintenance window nic nestojí a claim je jinak
pravdivý. Claim je dnes po B1.4 úpravě opatrnější, ale tvrdá shoda vyžaduje
backfill.

**Impact:** spustit `scripts/ops/pii-backfill-contacts.ts` (nebo ekvivalent)
v maintenance window. Sign-off po kontrole SQL verify query (check #4).

## D3 · Pricing net vs. gross presentation (B1.5)

**Kontext:** Pricing page dnes říká „1290 Kč včetně 21 % DPH". Většina B2B
SaaS v CZ ukazuje net (bez DPH) + informační „DPH se připočítá", protože
klienti si DPH odpočítají. Beta target = poradci, kteří jsou DPH plátci.

**Options:**
- **A — Gross (včetně DPH):** transparentnější pro neplátce, dnes
  implementováno.
- **B — Net + poznámka:** lepší pro DPH plátce (odpočet), standard v B2B.

**Doporučení:** **B** — obsluhujeme poradce, kteří téměř všichni jsou DPH
plátci. Ale komunikovat jasně: „1066 Kč bez DPH (1290 Kč s DPH)".

**Impact:** refactor `apps/web/src/app/pricing/page.tsx` + sync s FAQ
sekcí (co je net, co je gross).

## D4 · Review tenant credentials strategy (B1.8)

**Kontext:** Review tenant seed má dnes fixní default password přes env.
Po každém review cyklu (= demo produktu potenciálnímu klientovi) hrozí,
že credentials zůstanou „venku". Plan říká „heslo re-roll pro každý review
cycle".

**Options:**
- **A — Manual re-roll po každém demo** (README + checklist).
- **B — Automatický re-roll** (cron denní nebo po expiraci session).

**Doporučení:** **A** pro launch (B je nad-inženýrství dokud nemáme > 2
demo/měsíc). Přidat položku do demo runbooku.

**Impact:** doplnit checklist do `docs/demo-workflow.md` (TBD).

## D5 · Offboarding advisorId approach (B2.5)

**Kontext:** Při offboardingu poradce přepisujeme `advisorId` na nového
servicing advisora, ale tím ztrácíme historický creator (kdo smlouvu původně
sjednal). Vzniká drift v BJ metrikách.

**Options:**
- **A — Rewrite advisorId** (stávající přístup, B2.5 fix zachoval).
- **B — Přidat sloupec `servicing_advisor_id`** vedle `creator_advisor_id`,
  oddělit creator vs. servicing advisora v metrikách.

**Doporučení:** **B** v Batch 4 (viz B4.14). Pro launch nechat A, ale
upozornit v docs, že BJ za offboardované poradce je incomplete.

**Impact:** `docs/release-v1-decisions.md` dokumentace + issue pro B4.14.

## D6 · Visible-to-client default (B2.12)

**Kontext:** Manual payment setup modal dnes default `visibleToClient: false`
(B2.12 fix). Některé product owneři preferují `true`, aby klient okamžitě
viděl.

**Options:**
- **A — Default false** (implementováno). Bezpečnější, klient neuvidí
  polotovary.
- **B — Default true.** Rychlejší UX pro poradce, ale riskuje zobrazit
  nevalidní data.

**Doporučení:** **A** (už je implementováno). Pokud poradci budou tlačit na
B, přidat workspace-level setting.

## D7 · Sentry Session Replay (B2.17)

**Kontext:** Dnes `replaysSessionSampleRate: 0` v produkci, `0.1` on error.
Legal vyžaduje, aby cookie banner reflektoval realitu.

**Options:**
- **A — Disabled v production** (implementováno).
- **B — Consent-based enabling** přes CMP (Cookie Management Platform).

**Doporučení:** **A** pro launch; **B** post-launch po zapojení CMP (viz
TBD v Batch 4 follow-up).

## D8 · TXT export (B2.14)

**Kontext:** Runbook zmiňoval TXT export; JSON export je hotový.

**Options:**
- **A — Implementovat TXT writer** (markdown-like summary, nový button).
- **B — Odstranit z runbooku.** Hotovo v B2.14.

**Doporučení:** **B** (implementováno). Přidat TXT jen pokud klienti budou
požadovat (B4.12).

---

## Decision log

| Datum | Decision | Kdo | Poznámka |
|---|---|---|---|
| 2026-04-22 | D1 = A (aligned) | Marek | Viz B1.3 implementace. |
| 2026-04-22 | D6 = A (false default) | Marek | Viz B2.12 implementace. |
| 2026-04-22 | D7 = A (disabled) | Marek | Viz B2.17 implementace. |
| 2026-04-22 | D8 = B (remove) | Marek | Viz B2.14 implementace. |
|  | D2 | ? |  |
|  | D3 | ? |  |
|  | D4 | ? |  |
|  | D5 | ? |  |
