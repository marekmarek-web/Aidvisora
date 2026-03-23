---
name: FA do CRM – plný workflow
overview: "Propojit finanční analýzu s kompletní klientskou strukturou: synchronizace rodinných členů do CRM, vytvoření domácnosti, propsání FA do klientské karty, stavový model prodaných produktů, napojení na pipeline, úkoly a AI asistenta."
todos:
  - id: phase-1-db
    content: "Fáze 1: DB migrace – nové sloupce a tabulky (fa_plan_items, fa_sync_log, sale_status, archived_at, fa_source_id, fa_analysis_id)"
    status: completed
  - id: phase-2-softdelete
    content: "Fáze 2: Soft delete kontaktů + UI dialog s varováním a kaskádovou logikou"
    status: completed
  - id: phase-3-sync
    content: "Fáze 3: Server action syncFaToContacts + dedup logika + UI FaSyncDialog"
    status: completed
  - id: phase-4-planitems
    content: "Fáze 4: extractFaPlanItems + sale_status na FA + UI Obchodní výstup v StepSummary"
    status: completed
  - id: phase-5-coverage-pipeline
    content: "Fáze 5: importFaItemsToCoverage + createOpportunityFromFaItem + UI propojení"
    status: completed
  - id: phase-6-ai-cron
    content: "Fáze 6: Cron fa-followup + AI kontext rozšíření o fa_plan_items"
    status: completed
isProject: true
---

# Plán: FA → CRM – kompletní workflow

---

## A. ANALÝZA SOUČASNÉHO STAVU

### Finanční analýza (jistota z kódu)

- **DB tabulka** `financial_analyses` (`packages/db/src/schema/financial-analyses.ts`):
  - Sloupce propojení: `contact_id`, `household_id`, `company_id`, `primary_contact_id`, `linked_company_id`
  - `status`: `draft | completed | exported | archived`
  - `payload`: celý JSON `FinancialAnalysisData` – obsahuje `client`, `partner`, `children[]`, `incomeProtection.persons[].insurancePlans[]`, cashflow, assets, liabilities, goals, investments
  - **Chybí:** žádný sloupec pro stav "prodáno", žádná přímá vazba FA → opportunity, žádný stav doporučení
- **Store/typy:** `apps/web/src/lib/analyses/financial/types.ts`
- **Akce:** `apps/web/src/app/actions/financial-analyses.ts`

### Kontakty a domácnosti (jistota z kódu)

- **DB:** `contacts` (všechna kontaktní pole), `households`, `household_members` (role = volný text), `company_person_links` (vazba firma ↔ kontakt)
- **Akce:** `createContact`, `updateContact`, `deleteContact` (hard delete!), `createHousehold`, `addHouseholdMember`, `setContactHousehold`
- **Chybí:** `deleteContact` je hard delete bez soft-delete / archivace; žádná duplicity-detekce

### Produktové pokrytí (jistota z kódu)

- **DB:** `contact_coverage` – klíče: `item_key`, `segment_code`, `status` (`done|in_progress|none|not_relevant|opportunity`), `linked_contract_id`, `linked_opportunity_id`
- **Logika:** `apps/web/src/app/lib/coverage/calculations.ts` – `resolveCoverageItems` spojuje DB záznamy + smlouvy + open opportunities
- **Chybí:** žádná vazba coverage ↔ FA; žádný stav "doporučeno/rozjednáno/sjednáno z FA"

### Pipeline (jistota z kódu)

- **DB:** `opportunities` – `stage_id` → tenant-specifické stages; 6 výchozích: Začínáme / Analýza potřeb / Šla nabídka / Před uzavřením / Realizace / Péče & Servis; `closed_as` = `won | lost`
- **Chybí:** žádná vazba opportunity → FA; žádný automatický zápis z FA

### Úkoly (jistota z kódu)

- **DB:** `tasks` – sloupec `analysis_id` → `financial_analyses.id` **již existuje** ✓
- **Akce:** `createTask` přijímá `analysisId`, `contactId`, `opportunityId`

### AI asistent (jistota z kódu)

- Generuje: summary, opportunities narrative, next-best-action, briefing; kontext z `context/client-context.ts`
- Kontext zahrnuje: financial summary, smlouvy, tasky, timeline, active deals
- **Chybí:** FA prodaný plán / chybějící smlouva není sledována; AI neví o "rozjednaných" produktech z FA

---

## B. NÁVRH DATOVÉHO MODELU

### B.1 Nové sloupce na `financial_analyses`

```sql
ALTER TABLE financial_analyses
  ADD COLUMN sale_status TEXT DEFAULT 'draft'
    CHECK (sale_status IN ('draft','recommended','in_progress','sold_partial','sold_full')),
  ADD COLUMN sale_notes TEXT,
  ADD COLUMN sold_at TIMESTAMPTZ;
```

`status` = workflow FA wizardu; `sale_status` = stav "co bylo prodáno klientovi" (odděleno záměrně).

### B.2 Nová tabulka `fa_sync_log`

Sleduje, kdy a co bylo synchronizováno z FA do CRM (prevence duplikátů, ochrana ručně upravených dat):

```sql
CREATE TABLE fa_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  analysis_id UUID NOT NULL REFERENCES financial_analyses(id) ON DELETE CASCADE,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_by TEXT,
  contacts_created JSONB,   -- [{contactId, role, faRole}]
  household_id UUID,
  company_id UUID,
  sync_notes TEXT
);
```

### B.3 Nová tabulka `fa_plan_items`

Eviduje jednotlivé výstupy z FA (pojistné plány, investice, cíle, úvěry) se stavem:

```sql
CREATE TABLE fa_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  analysis_id UUID NOT NULL REFERENCES financial_analyses(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  item_type TEXT NOT NULL,
    -- 'insurance_plan' | 'investment' | 'goal' | 'credit' | 'pension'
  item_key TEXT,             -- mapuje na coverage item_key (např. 'zp_life')
  segment_code TEXT,         -- 'ZP', 'INV', 'DPS', 'HYPO', ...
  label TEXT,
  provider TEXT,
  amount_monthly NUMERIC(14,2),
  amount_annual NUMERIC(14,2),
  status TEXT NOT NULL DEFAULT 'recommended'
    CHECK (status IN
      ('recommended','in_progress','waiting_signature','sold','not_relevant','cancelled')),
  source_payload JSONB,      -- snapshot z FA (insuredRisks, premiums, …)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### B.4 Rozšíření `contact_coverage` o FA vazbu

```sql
ALTER TABLE contact_coverage
  ADD COLUMN fa_analysis_id UUID REFERENCES financial_analyses(id) ON DELETE SET NULL,
  ADD COLUMN fa_item_id UUID REFERENCES fa_plan_items(id) ON DELETE SET NULL;
```

### B.5 Rozšíření `opportunities` o zdroj z FA

```sql
ALTER TABLE opportunities
  ADD COLUMN fa_source_id UUID REFERENCES financial_analyses(id) ON DELETE SET NULL;
```

### B.6 Soft delete pro `contacts`

```sql
ALTER TABLE contacts
  ADD COLUMN archived_at TIMESTAMPTZ,
  ADD COLUMN archived_reason TEXT;
```

Místo hard delete → nastavit `archived_at`. **Hard delete odstraněn z plánu** – fyzické smazání dat pouze přes GDPR export/erase flow (`consents`, `exports` tabulky), nikdy přes UI tlačítko.

### B.7 Sjednocený stavový model (UPŘESNĚNÍ)

**Kanonická sada stavů** (sdílená mezi `fa_plan_items` a `contact_coverage`):


| Status               | FA plan items                           | Coverage UI label | Barva  |
| -------------------- | --------------------------------------- | ----------------- | ------ |
| `recommended`        | FA to doporučila, poradce nic nepodnikl | Doporučeno        | šedá   |
| `in_progress`        | Rozjednáno / probíhá obchodní jednání   | Rozjednáno        | modrá  |
| `waiting_signature`  | Vše domluveno, čeká na podpis / smlouvu | Čeká na podpis    | žlutá  |
| `sold` / `done`      | Sjednáno, smlouva existuje              | Sjednáno          | zelená |
| `not_relevant`       | Přeskočeno / klient nemá zájem          | Nerelevantní      | skrytá |
| `cancelled` / `none` | Bylo rozjednáno, ale zrušeno            | Nemá              | skrytá |


**Mapování fa_plan_items.status → contact_coverage.status:**

```
fa_plan_items.status    →  contact_coverage.status
recommended             →  opportunity
in_progress             →  in_progress
waiting_signature       →  waiting_signature  (nový)
sold                    →  done
not_relevant            →  not_relevant
cancelled               →  none
```

**contact_coverage.status** se rozšíří o `waiting_signature`. Stávající hodnoty (`done`, `in_progress`, `none`, `not_relevant`, `opportunity`) se NEpřejmenovávají – zachovávají se kvůli backward compatibility.

**financial_analyses.sale_status** zůstává oddělený (popisuje celou FA, ne položky): `draft | recommended | in_progress | sold_partial | sold_full`.

### B.8 Mapování FA segment ↔ coverage item_key ↔ opportunity caseType

Logická konstanta v kódu (rozšíření existujícího `segmentToCaseType` v `coverage.ts`):

- `insurancePlans` s `planType = 'full'` → segment `ZP`, item_key `zp_life` / `zp_invalidity` / ...
- `investments` s `type = 'pension'` → segment `DPS`
- `goals` s `type = 'hypo'` → segment `HYPO`

---

## C. SYNCHRONIZAČNÍ LOGIKA

### C.1 Flow "Vytvořit klienty z FA"

```
Poradce klikne "Synchronizovat klienty z FA"
  → ukáže se modal s preview:
      - Hlavní klient: [jméno] – [nový | nalezen dle email]
      - Partner: [jméno] – [nový | nalezen dle email]
      - Dítě 1..N: [jméno] – [nový]
      - Domácnost: [vytvořit novou | přidat do existující "[název]"]
      - Firma: [vytvořit | existuje dle IČO]
  → poradce potvrdí (volitelně odškrtne co nechce)
  → server action syncFaToContacts(analysisId)
      1. Deduplikovat každou osobu (viz C.2)
      2. Vytvořit/updatovat kontakty
      3. Nastavit FA.contactId + primaryContactId
      4. Vytvořit/najít domácnost, přidat členy s rolemi
      5. Vytvořit/propojit firmu (pokud includeCompany)
      6. Zapsat do fa_sync_log
```

### C.2 Deduplikační logika (pořadí priorit)

1. Přesná shoda `personalId` (rodné číslo) – **nejvyšší priorita**
2. Přesná shoda `email` (neprázdný)
3. Přesná shoda `phone` (normalizovaný formát)
4. Fuzzy: shoda `firstName+lastName` + `birthDate` (rok ±0)
5. Více shod → poradce musí zvolit v UI

### C.3 Sync FA → klientská karta

- `ClientFinancialSummaryBlock` čte data při každém načtení (žádná aktivní sync akce)
- Směr: FA payload → summary widget (jednosměrné)
- Co se zobrazuje: net worth, cashflow surplus, cíle, pojistné mezery, `fa_plan_items`

### C.4 Sync FA → finanční souhrn (produkty/coverage)

- `contact_coverage` rows se NEVYTVÁŘEJÍ automaticky
- Poradce ručně spustí "Přenést do produktů" v StepSummary
- Akce upsertuje `contact_coverage` se statusem dle `fa_plan_item.status`

### C.5 Opakovaný import

- `fa_sync_log` zachytí, co bylo vytvořeno (kontakty linked na sync)
- Opakovaný sync: kontakty vytvořené tímto syncem se updatují (ne duplikují)
- CRM pole s existující hodnotou ≠ null → nepřepíše, zobrazí varování

---

## D. UX / UI FLOW

### D.1 Akce "Synchronizovat klienty z FA"

- **Umístění:** StepClientInfo (banner) + StepSummary (tlačítko "Propsat do CRM")
- **Modalní dialog `FaSyncDialog`:**
  - Preview osob s deduplicitním výsledkem
  - Checkbox per osoba / domácnost / firma
  - Varování: "Tento kontakt již existuje, bude aktualizován"
  - CTA: Potvrdit a vytvořit

### D.2 Akce "Přenést doporučení do produktů / obchodů"

- **Umístění:** nová sekce v StepSummary "Obchodní výstup FA"
- **UI:** seznam `fa_plan_items` seskupených dle type
- Per-položka: status dropdown + checkbox "Vytvořit obchod v pipeline"
- Při vytvoření obchodu: přednastavit stage "Šla nabídka", titulek z `label`

### D.3 Smazání kontaktu

- **Primární akce: Archivovat** (soft delete, `archived_at`)
  - Varování: "Kontakt má X smluv, Y obchodů, Z dokumentů"
  - Archivovaný kontakt skrytý v listingu (filtr "Aktivní")
- **Sekundární: Smazat trvale** (admin role, extra potvrzení)
  - Kaskáda: documents, timeline, messages – smazáno; opportunities, tasks, financial_analyses – SET NULL
  - Domácnost: pokud byl jediný člen, archivovat domácnost
  - Primary člen: UI vyžádá přidělení jiného primary

### D.4 Stavový widget produktů na klientské kartě

- `ClientCoverageWidget` rozšíření:
  - Badge "Z analýzy [datum]" pokud `fa_analysis_id` je nastaven
  - Nový status `waiting_signature` (žlutá barva)
  - Akce: "Označit jako sjednáno po podpisu"
- Pod widgetem: sekce "Nedokončené z FA" – seznam `fa_plan_items` se statusem `recommended`/`in_progress`/`waiting_signature`

### D.5 Pipeline – obchod ze FA

- `OpportunityLinkedTab.tsx` – zobrazí odkaz na zdrojovou FA pokud `fa_source_id` nastaven
- Při vytváření obchodu z FA: prefill `caseType` dle `segment_code`, `title` z FA item label

---

## E. AUTOMATIZACE A AI

### Automatické (bez akce poradce)

- `fa_plan_items` se vytváří při `setFinancialAnalysisStatus('completed')` (server-side)
- AI generuje summary po exportu (existuje `generateClientSummaryAction`)

### Manuální potvrzení poradce

- Vytvoření kontaktů z FA (FaSyncDialog)
- Přenos doporučení → produkty / obchody
- Smazání / archivace kontaktu
- Přepnutí `fa_plan_item.status` na `sold`

### Kdy vznikne task (automaticky – cron)


| Spouštěč                                                 | Task                                     |
| -------------------------------------------------------- | ---------------------------------------- |
| `fa_plan_item.status = 'in_progress'` starší 14 dní      | "Urgentní follow-up: [label]"            |
| `fa_plan_item.status = 'waiting_signature'` starší 7 dní | "Chybí podpis / smlouva: [provider]"     |
| FA `status = 'draft'` > 30 dní bez aktivity              | "Dokončit finanční analýzu pro [klient]" |


### AI rozšíření

- `getClientAiOpportunities` – nové pravidlo: "FA doporučila [segment], chybí smlouva"
- `generateNextBestActionAction` – kontext rozšíření o `fa_plan_items` pending
- Nový prompt v `prompt-registry.ts`: "FA follow-up suggestions"

---

## F. MIGRACE A BACKWARD COMPATIBILITY


| Změna                                            | Dopad na existující data                                                        |
| ------------------------------------------------ | ------------------------------------------------------------------------------- |
| `financial_analyses.sale_status`                 | DEFAULT `'draft'` – bezpečné, existující záznamy získají výchozí hodnotu        |
| `fa_plan_items` (nová tabulka)                   | Žádná stará data – starší FA prostě nemají položky                              |
| `fa_sync_log` (nová tabulka)                     | Žádná stará data                                                                |
| `contact_coverage.fa_analysis_id` / `fa_item_id` | Nullable – žádný backfill nutný                                                 |
| `opportunities.fa_source_id`                     | Nullable – žádný backfill nutný                                                 |
| `contacts.archived_at`                           | Nullable, NULL = aktivní – stávající kontakty nejsou dotčeny                    |
| `deleteContact` → soft delete                    | Pouze archivace; fyzické smazání výhradně přes GDPR flow                        |
| `getContactsList`                                | Přidat `WHERE archived_at IS NULL` – **pozor: dotýká se VŠECH contact queries** |


---

## G. IMPLEMENTAČNÍ FÁZE

### Fáze 1: Datový model a migrace

**Cíl:** Připravit DB a typy bez rozbití čehokoli.

- `ALTER TABLE financial_analyses ADD COLUMN sale_status / sale_notes / sold_at`
- `CREATE TABLE fa_sync_log`
- `CREATE TABLE fa_plan_items`
- `ALTER TABLE contact_coverage ADD COLUMN fa_analysis_id, fa_item_id`
- `ALTER TABLE opportunities ADD COLUMN fa_source_id`
- `ALTER TABLE contacts ADD COLUMN archived_at, archived_reason`
- Nové Drizzle schema soubory + migrace SQL
- TypeScript typy rozšíření
- **DOD:** migrace projde, testy projdou, build OK

### Fáze 2: Soft-delete kontaktů (POUZE archivace)

**Cíl:** Bezpečné mazání kontaktů bez ztráty dat. Žádný hard delete v UI.

- `deleteContact` → přejmenovat na `archiveContact`, nastaví `archived_at = now()`, `archived_reason`
- **Žádná** `hardDeleteContact` akce – fyzické smazání jen přes GDPR erase flow
- UI: dialog s varováním (X smluv, Y obchodů, Z dokumentů), jediné CTA "Archivovat"
- `getContactsList` + další contact queries: `AND archived_at IS NULL`
- Filtr "Zobrazit archivované" v contact listu
- **Zasažené soubory:** `apps/web/src/app/actions/contacts.ts`, `apps/web/src/app/actions/households.ts`, portal + dashboard contact pages, contact list
- **DOD:** archivovaný kontakt zmizí z listingu; žádné hard delete tlačítko; data přežijí

### Fáze 3: Sync FA → klientská struktura

**Cíl:** "Vytvořit klienty z FA" vytvoří hlavního klienta, partnera, děti, domácnost, firmu.

- Nová server action `syncFaToContacts(analysisId)` v `apps/web/src/app/actions/fa-sync.ts`
- Nový modul `apps/web/src/lib/analyses/financial/contactSync.ts` (deduplikace, mapování)
- Mapování partner/children → `addHouseholdMember` s příslušnou rolí
- Vytvoření/propojení firmy z `companyFinance` pokud `includeCompany = true`
- Zápis do `fa_sync_log`
- Nová UI komponenta `FaSyncDialog.tsx` (preview + confirm)
- Integrace do `StepClientInfo.tsx` (banner) a `StepSummary.tsx` (tlačítko)
- **DOD:** FA s partnerem + 2 dětmi → 4 kontakty + domácnost; opakovaný sync neduplicuje

### Fáze 4: FA plan items + stav prodeje

**Cíl:** Evidovat co bylo doporučeno / prodáno z FA.

- Nová server action `extractFaPlanItems(analysisId)` v `apps/web/src/app/actions/fa-plan-items.ts`
  - Čte `incomeProtection.persons[].insurancePlans`, `investments`, `goals`, `newCreditWishList`
  - Mapuje na `fa_plan_items` rows se statusem `recommended`
  - Volána automaticky v `setFinancialAnalysisStatus('completed')`
- `updateFaPlanItemStatus(itemId, status)` – per-item update
- `updateFaSaleStatus(analysisId, saleStatus)` – celková FA sale status
- Nová komponenta `FaPlanItemsSection.tsx` v StepSummary
- Badge `sale_status` v FA toolbaru
- **DOD:** po completion FA jsou viditelné plan items; poradce může přepnout item na sold

### Fáze 5: Napojení na coverage a pipeline

**Cíl:** FA items se promítnou do produktového pokrytí a obchodů.

- Nová akce `importFaItemsToCoverage(analysisId, itemIds[])` – upsert `contact_coverage` s `fa_analysis_id`
- Nová akce `createOpportunityFromFaItem(faItemId, stageId?)` – opp s `fa_source_id`
- `ClientCoverageWidget.tsx` – FA badge, nový status `waiting_signature`
- `OpportunityLinkedTab.tsx` – odkaz na zdrojovou FA
- **Zasažené soubory:** `apps/web/src/app/actions/coverage.ts`, `apps/web/src/app/actions/pipeline.ts`, `ClientCoverageWidget.tsx`, `OpportunityLinkedTab.tsx`
- **DOD:** z FA lze kliknout "Propsat do pokrytí" a "Vytvořit obchod"; obchod odkazuje na FA

### Fáze 6: Automatické úkoly + AI monitoring

**Cíl:** Automatické follow-up tasky z nedokončených FA items, AI context rozšíření.

- Nový cron `apps/web/src/app/api/cron/fa-followup/route.ts`
- Kontext `context/client-context.ts` – přidat `fa_plan_items` pending
- `opportunity-rules.ts` – nové pravidlo pro pending FA items
- `prompt-registry.ts` – "FA follow-up" prompt
- **DOD:** po 14 dnech nevyřešeného item vznikne task; AI v NBA zmiňuje chybějící smlouvy

---

## H. EDGE CASES


| Případ                                              | Řešení                                                                                       |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| FA bez partnera                                     | Sync vytvoří jen hlavního klienta; domácnost dle nastavení (1-členná nebo nevytváří)         |
| Partner z FA už existuje v kontaktech (email shoda) | Dedup ho najde; nabídne propojení místo vytvoření; přidá do household_members s rolí partner |
| Děti bez kompletních údajů                          | Chybějící email/phone = null; kontakt se vytvoří jen s jménem/datem; UI varování             |
| Klient už má domácnost                              | Nabídne "přidat do existující [název]" nebo "vytvořit novou"                                 |
| Klient už má firmu (company_person_link)            | Deduplikace dle ICO; aktualizuje existující link                                             |
| Produkt doporučen, nikdy nepodepsán                 | `fa_plan_item.status = 'recommended'` zůstane; cron vytvoří task po N dnech                  |
| Produkt "domluvený", smlouva chybí                  | Status `waiting_signature`; AI flaguje; coverage item propojen na opp                        |
| Klient smazán, má obchody a dokumenty               | Soft delete – data přežijí; hard delete: cascade docs, SET NULL opp/tasks                    |
| Smazání primary člena domácnosti                    | UI vyžádá nový primary nebo smazání domácnosti                                               |
| Opakovaný import stejné FA                          | `fa_sync_log` zachytí; kontakty se updatují (ne duplikují)                                   |
| Ručně změněná klientská data po syncu               | FA sync ignoruje neprázdná CRM pole; zobrazí varování o konfliktu                            |


---

## I. TEST PLAN

### Unit testy

- `contactSync.ts`: deduplikace email/phone/personalId/fuzzy name+birth
- `mapFaClientToContactForm`: všechny mapovací cesty
- `extractFaPlanItems`: různé konfigurace incomeProtection + goals + investments

### Integrační testy

- `syncFaToContacts`: FA s partner+2 děti → 4 kontakty + domácnost; kontrola `fa_sync_log`
- Opakovaný sync → žádné duplikáty
- `importFaItemsToCoverage` → correct `contact_coverage` rows s `fa_analysis_id`
- `createOpportunityFromFaItem` → opp má `fa_source_id`
- Soft delete kontaktu → `archived_at` nastaven, kontakt zmizí z `getContactsList`
- Cron fa-followup → task vytvoří se s `analysis_id`

### E2E scénáře (Playwright)

1. FA wizard → StepSummary → "Synchronizovat klienty" → dialog → potvrdit → zkontrolovat kontakty + domácnost
2. FA → "Přenést do produktů" → `ClientCoverageWidget` zobrazuje items z FA
3. FA → "Vytvořit obchod" → pipeline zobrazuje opp se stage "Šla nabídka"
4. Archivace kontaktu → zmizí z listingu → obchody přežijí
5. Poradce označí `fa_plan_item` jako `sold` → coverage item se přepne na `done`

---

## J. FINÁLNÍ DOPORUČENÍ

### MVP (implementovat první)

1. **Fáze 1** – DB migrace (základ, nutný pro vše ostatní)
2. **Fáze 2** – Soft delete (kritická bezpečnostní mezera)
3. **Fáze 3** – Sync FA → klientská struktura (největší přidaná hodnota pro poradce)

### Druhá vlna

1. **Fáze 4** – FA plan items + sale status
2. **Fáze 5** – Coverage + pipeline napojení

### Nice-to-have

1. **Fáze 6** – Cron + AI monitoring

### Největší technická rizika

- **Deduplikace:** fuzzy matching může mít false positives → vždy UI potvrzení, nikdy automaticky
- `**getContactsList` a spol.:** všechny contact queries musí dostat `AND archived_at IS NULL` (hodně souborů)
- **Payload JSON:** `extractFaPlanItems` čte `payload.data` – číst jednou, transformovat in-memory, neindexovat

---

## Souhrn všech dotčených částí

### DB změny


| Tabulka              | Typ změny                               |
| -------------------- | --------------------------------------- |
| `financial_analyses` | +`sale_status`, `sale_notes`, `sold_at` |
| `contact_coverage`   | +`fa_analysis_id`, `fa_item_id`         |
| `opportunities`      | +`fa_source_id`                         |
| `contacts`           | +`archived_at`, `archived_reason`       |
| `fa_plan_items`      | Nová tabulka                            |
| `fa_sync_log`        | Nová tabulka                            |


### Nové serverové akce

- `apps/web/src/app/actions/fa-sync.ts` – `syncFaToContacts`, `getFaSyncPreview`
- `apps/web/src/app/actions/fa-plan-items.ts` – `extractFaPlanItems`, `updateFaPlanItemStatus`, `getFaPlanItems`
- Rozšíření `contacts.ts` – `archiveContact`, `hardDeleteContact`
- Rozšíření `financial-analyses.ts` – `updateFaSaleStatus`
- Rozšíření `coverage.ts` – `importFaItemsToCoverage`
- Rozšíření `pipeline.ts` – `createOpportunityFromFaItem`

### Nové / upravené UI

- Nová: `FaSyncDialog.tsx`, `FaPlanItemsSection.tsx`
- Upravená: `StepClientInfo.tsx`, `StepSummary.tsx`, `ClientCoverageWidget.tsx`, `OpportunityLinkedTab.tsx`, `apps/web/src/app/portal/contacts/page.tsx` (filtr archivovaných), contact delete flow

### Nový cron

- `apps/web/src/app/api/cron/fa-followup/route.ts`

### AI soubory

- `apps/web/src/lib/ai/context/client-context.ts`
- `apps/web/src/lib/ai-opportunities/opportunity-rules.ts`
- `apps/web/src/lib/ai/prompt-registry.ts`

### Nové lib moduly

- `apps/web/src/lib/analyses/financial/contactSync.ts`

