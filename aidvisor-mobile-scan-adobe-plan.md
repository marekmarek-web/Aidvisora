# Aidvisor – komplexní implementační plán
## Vlastní mobile scan flow + volitelný Adobe PDF Services processing + AI review

**Datum:** 24. 3. 2026  
**Projekt:** Aidvisor  
**Autor plánu:** GPT-5.4 Thinking

---

## 1. Executive summary

Cílový stav je tento:

- poradce otevře v mobilní aplikaci Aidvisora funkci **Naskenovat dokument**,
- dokument nafotí přímo v Aidvisoru pomocí nativního scanneru telefonu,
- více stran se složí do jednoho PDF,
- PDF se nahraje do Aidvisora,
- dokument je okamžitě uložený a zobrazitelný,
- backend podle typu a kvality dokumentu rozhodne, zda spustí **processing**,
- pokud je aktivní Adobe PDF Services provider, spustí se podmíněně:
  - OCR,
  - PDF to Markdown,
  - případně structured Extract,
- AI review následně používá primárně Markdown, sekundárně strukturovaná data nebo fallback text.

Zásadní architektonické rozhodnutí:

1. **Mobile scan UX bude plně patřit Aidvisoru.**  
   Aidvisor bude vlastnit vstup dokumentu, preview, retake, reorder, upload a viewer.

2. **Adobe nebude vstupní scan aplikace.**  
   Adobe PDF Services bude pouze **server-side processing vrstva** pro OCR a inteligentní zpracování PDF.

3. **Systém musí fungovat i bez Adobe.**  
   Adobe je enhancement vrstva, ne core závislost.

4. **První fáze musí být co nejpraktičtější.**  
   Nejprve doručit stabilní scan → upload → viewer → AI review flow. Teprve potom rozšiřovat processing, heuristiky a optimalizace.

---

## 2. Proč je toto správná cesta

### 2.1 Co dává smysl stavět vlastní

Vlastní vrstva v Aidvisoru má dávat kontrolu nad:

- vstupem dokumentu,
- UX skenování,
- správou stran,
- uploadem,
- přiřazením dokumentu ke klientovi / entitě,
- dokumentovým workflow,
- zobrazením ve vieweru,
- AI review stavem,
- auditní stopou.

To je část, která je klíčová pro produkt, UX a adopci poradci.

### 2.2 Co nedává smysl stavět celé od nuly

Nedává smysl si od začátku psát vlastní plnohodnotný engine na:

- OCR,
- kvalitní text extraction,
- zachování pořadí čtení,
- tabulky a layout parsing,
- LLM-friendly konverzi do Markdownu,
- strukturované vytěžení komplikovaných PDF.

To je náročné na kvalitu, údržbu i edge cases.

### 2.3 Finální doporučení

Proto je správný hybridní model:

- **Aidvisor vlastní scan a upload flow**,
- **Adobe je volitelný processing provider**,
- AI review nad tím využívá nejlepší dostupný výstup.

---

## 3. Cíle projektu

### 3.1 Hlavní cíle

- Zavést vlastní mobilní scan dokumentů přímo v Aidvisoru.
- Umožnit vícestránkové skeny a uložení jako jedno PDF.
- Umožnit poradcům dokument hned po nahrání otevřít a používat.
- Zlepšit kvalitu AI review nad skeny a PDF.
- Udržet architekturu modulární a produkčně bezpečnou.
- Připravit systém tak, aby fungoval i bez Adobe a zároveň šel Adobe snadno zapnout.

### 3.2 Vedlejší cíle

- Zajistit přehledný processing status.
- Připravit retry-safe a auditovatelné zpracování dokumentu.
- Umožnit pozdější rozšíření o další processing providery.
- Připravit základ pro vyšší automatizaci dokumentového workflow.

---

## 4. Scope

## 4.1 In scope

- mobilní scan přímo v Aidvisor appce,
- vícestránkový scan,
- preview naskenovaných stran,
- smazání / přefocení / změna pořadí stran,
- export do jednoho PDF,
- upload PDF do Aidvisora,
- viewer dokumentu,
- metadata dokumentu,
- processing pipeline,
- Adobe provider pro OCR / Markdown / Extract,
- AI review napojení,
- processing stavy v UI,
- databázové rozšíření,
- základní monitoring a error handling,
- testy a rollout plán.

## 4.2 Out of scope pro první verzi

- plně custom kamera scanner engine od nuly,
- vlastní OCR engine,
- automatická klasifikace všech typů dokumentů na 100 %,
- podpisové workflow,
- elektronická pečeť,
- automatické importy z cizích cloud úložišť,
- pokročilé workflow rules typu „pokud je to smlouva X, automaticky založ entitu Y“.

---

## 5. Cílový uživatelský flow

## 5.1 Mobile scan flow

1. Poradce otevře detail klienta / dokumentů.
2. Klikne na **Naskenovat dokument**.
3. Otevře se nativní scanner telefonu.
4. Poradce naskenuje 1 až N stran.
5. Po dokončení vidí edit screen:
   - náhled stran,
   - přidat stránku,
   - přefotit stránku,
   - smazat stránku,
   - změnit pořadí,
   - potvrdit dokončení.
6. Aidvisor složí stránky do jednoho PDF.
7. PDF se nahraje do dokumentového systému Aidvisora.
8. Dokument je hned viditelný v seznamu dokumentů a ve vieweru.
9. Po uploadu proběhne processing podle pravidel.
10. AI review zobrazí stav a výsledek.

## 5.2 Processing flow

1. Server přijme originální PDF.
2. Zjistí základní metadata:
   - page count,
   - file size,
   - mime type,
   - source,
   - zda jde pravděpodobně o image-based scan.
3. Rozhodne, zda spustí processing.
4. Pokud provider = `disabled`, flow končí uložením originálu a případným fallback textem.
5. Pokud provider = `adobe`:
   - pro scan/image-based PDF spustit OCR,
   - následně PDF to Markdown,
   - volitelně Extract JSON.
6. Výsledky se uloží zpět k dokumentu.
7. AI review použije nejlepší dostupný vstup.

---

## 6. Architektonické principy

### 6.1 Server-only secrets

Adobe credentials nesmí být nikdy v klientovi. Veškerý processing bude výhradně server-side.

### 6.2 Provider abstraction

Zpracování dokumentu musí mít rozhraní typu:

- `disabled`
- `adobe`
- později případně `local`, `aws`, `google`, atd.

Aplikace nesmí být natvrdo svázaná s jediným providerem.

### 6.3 Graceful degradation

Když processing provider selže nebo je vypnutý:

- upload stále funguje,
- viewer stále funguje,
- dokument zůstane uložený,
- AI review musí mít fallback režim,
- chyba se zobrazí srozumitelně bez rozbití UX.

### 6.4 Idempotence a retry safety

Opakované spuštění processingu nesmí zanechávat nekonzistentní stav.

### 6.5 Minimal invasive change

Nezasahovat zbytečně do stávající upload a review architektury mimo scope této feature.

---

## 7. Navržená architektura řešení

## 7.1 Přehled vrstev

### A. Mobile scan layer
Odpovědná za pořízení skenu v mobilní appce.

### B. Capture state layer
Odpovědná za správu naskenovaných stran.

### C. PDF builder layer
Odpovědná za složení stran do finálního PDF.

### D. Upload layer
Odpovědná za nahrání PDF do Aidvisora.

### E. Document persistence layer
Odpovědná za uložení dokumentu a metadat.

### F. Processing orchestration layer
Rozhoduje, zda a jak dokument zpracovat.

### G. Processing provider layer
Konkrétní implementace Adobe nebo disabled provideru.

### H. AI ingestion layer
Připravuje nejvhodnější textový/strukturovaný vstup pro AI review.

### I. Viewer + status UI layer
Zobrazuje dokument a stav jeho zpracování.

---

## 8. Mobile scan vrstva

## 8.1 Doporučený přístup

Použít nativní scanner UI na obou platformách a nepsat low-level scanner engine od nuly.

### iOS
- systémový document scanner přes VisionKit.

### Android
- systémově/blízký nativní document scanner přes ML Kit Document Scanner API.

## 8.2 Abstrakční rozhraní

Navrhnout společné rozhraní třeba ve stylu:

```ts
interface ScanResultPage {
  uri: string
  width?: number
  height?: number
  index: number
}

interface ScanSessionResult {
  pages: ScanResultPage[]
  source: 'ios_visionkit' | 'android_mlkit'
  createdAt: string
}
```

Cíl: zbytek aplikace nesmí řešit platform-specific detaily.

## 8.3 Capture state management

Stav musí umět:

- načíst naskenované strany,
- přidat další stranu,
- nahradit stranu,
- smazat stranu,
- změnit pořadí,
- potvrdit finální podobu,
- zrušit rozpracovaný scan.

Doporučený interní model:

```ts
interface LocalScanPage {
  id: string
  uri: string
  order: number
  width?: number
  height?: number
  status: 'ready' | 'replacing' | 'deleting'
}
```

## 8.4 UI obrazovky

### Screen 1 – Document entry
- CTA „Naskenovat dokument“
- alternativně „Nahrát soubor“

### Screen 2 – Native scanner launch
- otevření systémového scanneru

### Screen 3 – Scan review/edit
- grid/list stran,
- přidat stránku,
- přefotit,
- smazat,
- reorder,
- potvrdit.

### Screen 4 – Upload progress
- progress state,
- chybový stav,
- retry.

### Screen 5 – Document detail/viewer
- náhled PDF,
- processing status,
- AI review CTA.

---

## 9. PDF builder vrstva

## 9.1 Co musí umět

- vzít více stran z mobilního scanu,
- složit je do jednoho PDF,
- zachovat pořadí,
- sjednotit orientaci a page sizing,
- rozumně komprimovat bez zásadní ztráty čitelnosti,
- vrátit lokální PDF soubor připravený k uploadu.

## 9.2 Doporučené chování

- normalizovat bílé okraje jen pokud je to jednoduché a bezpečné,
- nepřehánět agresivní kompresi,
- preferovat čitelnost textu před minimální velikostí souboru,
- zachovat page order přesně podle UI.

## 9.3 Metadata pro PDF

K originálnímu uploadu uložit minimálně:

- page count,
- file size,
- source = `mobile_scan`,
- created via iOS/Android,
- mime type,
- timestamp,
- uploader user id.

---

## 10. Upload vrstva

## 10.1 Cíl

Využít stávající Aidvisor upload pipeline, neobcházet ji novým izolovaným tokem.

## 10.2 Požadavky

- upload musí fungovat na mobilu stabilně,
- musí mít progress stav,
- retry při síťové chybě,
- po úspěchu vrátit document/entity reference,
- nesmí rozbít stávající dokumentové use cases.

## 10.3 Business metadata při uploadu

Přidat nebo rozšířit upload payload o:

- `source: 'mobile_scan'`
- `pageCount`
- `capturedPlatform: 'ios' | 'android'`
- `originalFilename`
- `mimeType`
- `documentTypeHint` (volitelné)
- `clientId` / `entityId` podle existující architektury

---

## 11. Persistence a databázový model

## 11.1 Minimální rozšíření dokumentového modelu

Doporučená nová pole:

- `upload_source` – `manual_upload | mobile_scan | email_import | other`
- `processing_provider` – `disabled | adobe | none`
- `processing_status` – `queued | processing | completed | failed | skipped`
- `processing_stage` – `none | ocr | markdown | extract | completed`
- `processing_error` – text / json detail
- `processing_started_at`
- `processing_finished_at`
- `ocr_pdf_path`
- `markdown_path`
- `extract_json_path`
- `page_count`
- `has_text_layer` – nullable boolean
- `is_scan_like` – nullable boolean
- `ai_input_source` – `markdown | extract | ocr_text | native_text | none`

## 11.2 Doporučené rozšíření auditní stopy

- `processing_attempt_count`
- `last_processing_job_id`
- `last_processing_provider_response`

## 11.3 Varianta s oddělenou processing tabulkou

Lepší dlouhodobá varianta:

### `document_processing_jobs`

Pole například:

- `id`
- `document_id`
- `provider`
- `job_type`
- `status`
- `requested_by`
- `started_at`
- `finished_at`
- `error_message`
- `provider_job_id`
- `output_metadata_json`

Výhody:
- historie pokusů,
- audit,
- retry bez přepisování všeho do jedné tabulky,
- lepší reporting.

Doporučení:
- pro rychlost implementace lze začít s rozšířením dokumentové tabulky,
- ale pokud už teď očekáváte více processing kroků, je lepší udělat `document_processing_jobs` rovnou.

---

## 12. Processing orchestrace

## 12.1 Rozhodovací logika

Po uploadu server vyhodnotí:

1. Je processing provider zapnutý?
2. Je typ souboru podporovaný?
3. Je dokument vhodný pro processing?
4. Obsahuje PDF text layer?
5. Vypadá jako scan / image-based PDF?
6. Má processing smysl vzhledem ke stránkám a velikosti?

## 12.2 Doporučené výchozí chování

### Varianta A – scan z mobilní appky
- defaultně považovat za scan-like,
- OCR spustit vždy nebo podle heuristiky,
- následně Markdown,
- volitelně Extract.

### Varianta B – klasický upload PDF
- nejdřív ověřit, zda PDF obsahuje extrahovatelný text,
- pokud ano, přeskočit OCR,
- rovnou vytvořit Markdown,
- Extract jen když je potřeba přesnější struktura.

## 12.3 Priorita výstupů pro AI review

Preferovaný zdroj pro AI:

1. Markdown
2. Extract JSON + textové bloky
3. OCR text / searchable PDF text
4. native text layer z PDF
5. fallback metadata

---

## 13. Adobe provider vrstva

## 13.1 Základní odpovědnost

Adobe provider bude mít na starosti:

- autentizaci,
- upload assetu,
- submit jobu,
- polling / result fetching,
- download výstupu,
- uložení výstupů,
- mapování chyb,
- persistenci stavů.

## 13.2 Povinné env proměnné

- `ADOBE_PDF_SERVICES_CLIENT_ID`
- `ADOBE_PDF_SERVICES_CLIENT_SECRET`
- `ADOBE_PDF_SERVICES_REGION=ew1`
- `ADOBE_PDF_PROCESSING_ENABLED=true|false`

## 13.3 Rozhraní provideru

Doporučené rozhraní:

```ts
interface DocumentProcessingProvider {
  name: 'disabled' | 'adobe'
  isEnabled(): boolean
  runOcr(input: ProcessingInput): Promise<ProcessingOutput>
  runMarkdown(input: ProcessingInput): Promise<ProcessingOutput>
  runExtract(input: ProcessingInput): Promise<ProcessingOutput>
}
```

## 13.4 Disabled provider

Musí existovat `disabled` provider, který:

- vrátí deterministický výsledek,
- nic nevolá externě,
- umožní jednotný kód bez `if` chaosu po celé aplikaci.

## 13.5 Adobe job orchestrace

Pro první verzi:

- synchronní zahájení jobu,
- asynchronní čekání/polling na výsledek v serverové vrstvě,
- per-job status persistence.

Pro další verzi:

- webhooky,
- background queue,
- reprocessing jobs,
- bulk processing.

---

## 14. AI review integrace

## 14.1 Cíl

AI review musí umět pracovat s různou kvalitou vstupu bez rozbití UX.

## 14.2 Navržená strategie vstupů

### Pokud existuje Markdown
Použít Markdown jako primární zdroj.

### Pokud existuje Extract JSON
Použít jako strukturovaný doplněk.

### Pokud existuje searchable/OCR PDF
Použít text z OCR vrstvy.

### Pokud není nic z výše uvedeného
Fallback na minimální metadata a upozornit uživatele na omezenou kvalitu analýzy.

## 14.3 UI stavy AI review

- `Dokument nahrán`
- `Čeká na zpracování`
- `Probíhá OCR`
- `Připravuji text pro AI`
- `Strukturovaná data připravena`
- `AI review připraveno`
- `Zpracování selhalo`
- `AI review poběží v omezeném režimu`

## 14.4 Doporučené AI metadata

Předat do review pipeline i tato metadata:

- source type,
- number of pages,
- processing provider,
- processing quality/fallback level,
- detection confidence pokud bude dostupná,
- scan/upload date.

---

## 15. Viewer a UI stavy

## 15.1 Viewer musí umět

- zobrazit originální PDF,
- případně zobrazit searchable/OCR variantu,
- ukázat processing status,
- nabídnout ruční re-run,
- nabídnout spuštění AI review,
- zobrazit chybový stav srozumitelně.

## 15.2 UX principy

- dokument musí být otevřitelný ihned po uploadu,
- processing nesmí blokovat základní práci,
- chyba v processingu nesmí působit dojmem, že se dokument nenahrál,
- ruční retry musí být jednoduché,
- stav nesmí být schovaný nebo nejasný.

## 15.3 Doporučené CTA

- `Spustit AI review`
- `Znovu zpracovat dokument`
- `Zobrazit scan`
- `Zobrazit text pro AI`
- `Zobrazit structured data` (později)

---

## 16. API / server routes / actions

## 16.1 Doporučené endpointy

### Upload a základní dokumenty
- použít stávající upload route, rozšířit payload a metadata

### Processing actions
- `POST /api/documents/:id/process`
- `POST /api/documents/:id/process/ocr`
- `POST /api/documents/:id/process/markdown`
- `POST /api/documents/:id/process/extract`
- `POST /api/documents/:id/process/retry`

### Status / detail
- `GET /api/documents/:id`
- `GET /api/documents/:id/processing`

## 16.2 Doporučené chování orchestrace

Možnosti:

### Varianta 1 – jednoduchý orchestrator endpoint
`POST /api/documents/:id/process`

Ten sám rozhodne:
- OCR ano/ne,
- Markdown ano/ne,
- Extract ano/ne.

Toto doporučuji jako hlavní vstup.

### Varianta 2 – granular routes
Použít pro interní debugging, admin nástroje a manuální retry.

---

## 17. Doporučená struktura souborů

Níže je návrh, ne dogma. Přizpůsobit stávající architektuře projektu.

### Mobile / client vrstva
- `apps/mobile/src/features/documents/scan/ScanEntryScreen.tsx`
- `apps/mobile/src/features/documents/scan/ScanReviewScreen.tsx`
- `apps/mobile/src/features/documents/scan/hooks/useScanCapture.ts`
- `apps/mobile/src/features/documents/scan/lib/scanner.ts`
- `apps/mobile/src/features/documents/scan/lib/pdfBuilder.ts`
- `apps/mobile/src/features/documents/scan/types.ts`

### Shared / upload
- `apps/web/src/lib/upload/...` nebo odpovídající shared modul
- případně `packages/...` pokud je upload sdílený

### Web / server processing
- `apps/web/src/lib/documents/processing/orchestrator.ts`
- `apps/web/src/lib/documents/processing/provider.ts`
- `apps/web/src/lib/documents/processing/disabled-provider.ts`
- `apps/web/src/lib/adobe/client.ts`
- `apps/web/src/lib/adobe/pdf-services.ts`
- `apps/web/src/lib/adobe/types.ts`
- `apps/web/src/lib/documents/ai/resolveAiInput.ts`

### API
- `apps/web/src/app/api/documents/[id]/process/route.ts`
- `apps/web/src/app/api/documents/[id]/process/ocr/route.ts`
- `apps/web/src/app/api/documents/[id]/process/markdown/route.ts`
- `apps/web/src/app/api/documents/[id]/process/extract/route.ts`

### DB
- `packages/db/src/schema/...`
- `packages/db/drizzle/...`

---

## 18. Fázovaný implementační plán

## Fáze 0 – analýza stávající architektury

### Cíl
Přesně zmapovat existující upload, documents, AI review a mobile flow.

### Úkoly
- projít stávající document upload pipeline,
- najít zdroj pravdy pro dokumentový model,
- ověřit, jak je dnes řešen viewer,
- ověřit, jak AI review získává vstup,
- zjistit, kde nejlépe přidat upload source a processing metadata,
- zjistit, zda mobile app a web sdílí upload vrstvu.

### Výstup
- potvrzené integrační body,
- seznam souborů a míst zásahu,
- identifikace rizik před implementací.

### Checklist
- [ ] Zmapovaný current-state upload flow
- [ ] Zmapovaný document schema/source of truth
- [ ] Zmapovaný current AI review input flow
- [ ] Zmapované mobile/web integrační body

---

## Fáze 1 – datový model a processing statusy

### Cíl
Připravit databázový základ bez kterého se feature špatně řídí.

### Úkoly
- přidat pole pro upload source,
- přidat processing provider,
- přidat processing status a stage,
- přidat cesty k výstupům,
- přidat timestamps a error pole,
- případně založit `document_processing_jobs` tabulku.

### Výstup
- migrace,
- updated schema,
- typové modely.

### Checklist
- [ ] Přidán upload source
- [ ] Přidán processing provider
- [ ] Přidán processing status/stage
- [ ] Přidána pole pro OCR/Markdown/Extract output
- [ ] Přidány timestamps a error pole
- [ ] Připravený typed model v appce

---

## Fáze 2 – mobile scan abstraction

### Cíl
Zavést nativní scan schopnost do aplikace.

### Úkoly
- vytvořit scanner abstraction layer,
- implementovat iOS variantu,
- implementovat Android variantu,
- sjednotit výstup do společného modelu,
- řešit cancel flow a error handling.

### Výstup
- funkční scan session vracející pages.

### Checklist
- [ ] Existuje scanner interface
- [ ] Funguje iOS scan flow
- [ ] Funguje Android scan flow
- [ ] Sjednocený výstup pages/session
- [ ] Ošetřen cancel a error flow

---

## Fáze 3 – scan review/edit obrazovka

### Cíl
Dát poradci plnou kontrolu nad naskenovanými stránkami před uploadem.

### Úkoly
- postavit scan review screen,
- implementovat page preview,
- add page,
- retake page,
- delete page,
- reorder pages,
- finalize action.

### Výstup
- hotový UX flow před uploadem.

### Checklist
- [ ] Existuje review screen
- [ ] Funguje add page
- [ ] Funguje retake page
- [ ] Funguje delete page
- [ ] Funguje reorder
- [ ] Funguje finalize scan

---

## Fáze 4 – PDF builder a upload

### Cíl
Složit finální PDF a bezpečně ho uložit do Aidvisora.

### Úkoly
- implementovat PDF builder,
- napojit na existující upload pipeline,
- přidat source metadata,
- zobrazit progress stav,
- retry při síťové chybě,
- po úspěchu vrátit document record.

### Výstup
- scan se stane reálným dokumentem v systému.

### Checklist
- [ ] Stránky se skládají do PDF
- [ ] PDF jde nahrát přes existující upload flow
- [ ] Ukládá se `source = mobile_scan`
- [ ] Funguje progress UI
- [ ] Funguje retry
- [ ] Po uploadu existuje document entity

---

## Fáze 5 – viewer a základní dokumentové UX

### Cíl
Uživatel musí dokument ihned otevřít a neztratit důvěru ve flow.

### Úkoly
- zobrazit nově nahraný dokument ve vieweru,
- ukázat metadata,
- ukázat processing status placeholder,
- zobrazit AI review CTA,
- ošetřit loading/error states.

### Výstup
- dokument je použitelný i bez processingu.

### Checklist
- [ ] Dokument jde otevřít hned po uploadu
- [ ] Viewer nezávisí na Adobe
- [ ] Zobrazuje se processing status
- [ ] Zobrazuje se AI review CTA
- [ ] Ošetřené loading/error states

---

## Fáze 6 – processing provider abstraction

### Cíl
Oddělit aplikaci od konkrétního processing enginu.

### Úkoly
- vytvořit provider interface,
- přidat disabled provider,
- přidat config/env-based provider selection,
- připravit orchestrator.

### Výstup
- aplikace umí běžet bez Adobe a zároveň být připravená na jeho zapnutí.

### Checklist
- [ ] Existuje provider interface
- [ ] Existuje disabled provider
- [ ] Provider selection jde přes config/env
- [ ] Orchestrator neobsahuje hardcoded Adobe chaos

---

## Fáze 7 – Adobe provider implementace

### Cíl
Napojit server-side Adobe processing.

### Úkoly
- implementovat autentizaci,
- implementovat upload assetu,
- implementovat OCR job,
- implementovat Markdown job,
- implementovat Extract job,
- implementovat result download,
- ukládání výsledků do storage,
- mapování error stavů,
- uložení processing statusů.

### Výstup
- funkční Adobe backend provider.

### Checklist
- [ ] Funguje token/auth vrstva
- [ ] Funguje asset upload
- [ ] Funguje OCR job
- [ ] Funguje Markdown job
- [ ] Funguje Extract job
- [ ] Výstupy se ukládají do storage
- [ ] Stav a chyby se persistují

---

## Fáze 8 – processing orchestrace a heuristiky

### Cíl
Rozhodovat chytře, kdy processing spustit a jaký.

### Úkoly
- detekce mobile scan vs native PDF,
- odhad text layer / scan-like dokumentu,
- OCR jen tam, kde dává smysl,
- Markdown téměř vždy pro AI-ready vstup,
- Extract jen pro vybrané flow nebo při vyšší hodnotě dokumentu,
- retry-safe stavový automat.

### Výstup
- efektivní využití Adobe transakcí a lepší výkon.

### Checklist
- [ ] Funguje základní rozhodovací logika
- [ ] OCR neběží zbytečně na všem
- [ ] Markdown se používá tam, kde pomáhá AI review
- [ ] Retry nemá destruktivní chování
- [ ] Stavový automat je konzistentní

---

## Fáze 9 – AI review integrace

### Cíl
Napojit nejlepší dostupný dokumentový výstup do AI review.

### Úkoly
- implementovat resolver AI input source,
- preferovat Markdown,
- doplnit fallback logiku,
- zobrazit kvalitu/stav vstupu v UI,
- zajistit kompatibilitu se stávající AI vrstvou.

### Výstup
- AI review funguje i na skenech výrazně lépe než dnes.

### Checklist
- [ ] Existuje AI input resolver
- [ ] Markdown má prioritu
- [ ] Existuje fallback při selhání processingu
- [ ] AI review UI zobrazuje stav vstupu
- [ ] Nenastala regrese existujícího review flow

---

## Fáze 10 – observabilita, testy a rollout

### Cíl
Dostat feature do produkční kvality.

### Úkoly
- logování processing kroků,
- základní telemetry/metrics,
- unit testy,
- integrační testy,
- smoke testy na reálných PDF,
- feature flag rollout,
- interní pilot s několika poradci.

### Výstup
- bezpečné nasazení s možností rychlého rollbacku.

### Checklist
- [ ] Existují logy pro upload a processing
- [ ] Existují základní metriky úspěšnosti/chyb
- [ ] Jsou pokryté klíčové unit flows
- [ ] Jsou pokryté integrační flows
- [ ] Proběhl smoke test na reálných dokumentech
- [ ] Feature jde zapnout/vypnout
- [ ] Připraven rollback scénář

---

## 19. Heuristiky pro spouštění processingu

## 19.1 Doporučená verze V1

### Mobile scan dokument
- OCR: **ano**
- Markdown: **ano**
- Extract: **volitelně**

### Klasický upload PDF s text layer
- OCR: **ne**
- Markdown: **ano**
- Extract: **volitelně podle typu dokumentu**

### Velmi malé nebo technicky nekonzistentní PDF
- zkusit Markdown / text extraction,
- pokud selže, zapsat fallback status,
- AI review pustit v omezeném režimu.

## 19.2 Budoucí verze V2

Doplnit heuristiky podle:

- page count,
- typ dokumentu,
- text density,
- přítomnost tabulek,
- očekávaná obchodní hodnota dokumentu,
- vyčerpanost transakcí.

---

## 20. Nákladová a kapacitní strategie pro Adobe

## 20.1 Princip

Adobe free tier je omezený, proto processing nesmí běžet bezmyšlenkovitě na vše.

## 20.2 Doporučení

- OCR spouštět jen na scan-like dokumenty,
- Markdown používat jako hlavní AI-ready formát,
- Extract nespouštět povinně na vše,
- mít možnost processing vypnout feature flagem,
- logovat spotřebu a typy jobů.

## 20.3 Důležitá produktová zásada

Když dojdou Adobe transakce:

- upload musí fungovat dál,
- viewer musí fungovat dál,
- AI review musí mít fallback,
- systém nesmí spadnout do nepoužitelnosti.

---

## 21. Error handling strategie

## 21.1 Typy chyb

### Mobile scan errors
- uživatel zruší scan,
- scanner není dostupný,
- chybí oprávnění,
- selže generování PDF.

### Upload errors
- síťová chyba,
- timeout,
- storage failure,
- auth/session problém.

### Processing errors
- provider disabled,
- Adobe auth fail,
- unsupported PDF,
- timeout jobu,
- invalid result,
- storage save fail.

### AI review errors
- chybí vstupní text,
- zpracování ještě neběží hotové,
- fallback quality je nízká.

## 21.2 UX zásady chyb

- chyba musí být lokální a srozumitelná,
- nikdy nesmí uživatel nabýt dojmu, že dokument zmizel, pokud se reálně nahrál,
- processing chyba ≠ upload chyba,
- retry musí být jasně dostupný.

---

## 22. Bezpečnost a compliance

## 22.1 Zásady

- žádné Adobe secrets v klientu,
- dokumenty posílat externě jen server-side,
- logy nesmí obsahovat citlivý plný obsah dokumentů,
- storage paths a permissions musí respektovat existující authorization model,
- viewer a AI review musí respektovat role a ownership dokumentů.

## 22.2 Audit

- kdo dokument nahrál,
- kdy byl dokument nahrán,
- kdo spustil processing,
- jaký provider se použil,
- kdy processing skončil,
- jaký je poslední stav.

---

## 23. Testovací plán

## 23.1 Unit testy

- scan state reducer / hook,
- reorder/delete/replace logika,
- provider selection,
- AI input resolver,
- processing state transitions.

## 23.2 Integrační testy

- mobile scan → PDF build → upload,
- upload → document persisted,
- processing orchestrator → provider call → saved outputs,
- AI review with Markdown,
- AI review fallback without processing.

## 23.3 Manuální smoke test scénáře

Minimálně tyto reálné dokumenty:

- 1stránková smlouva,
- 5stránková smlouva,
- špatně osvětlený scan,
- výpis z účtu,
- potvrzení o příjmu,
- dokument s tabulkou,
- nativní textové PDF,
- PDF bez text layer,
- velký více stránkový soubor.

## 23.4 Ověřované výsledky

- čitelnost ve vieweru,
- správné pořadí stran,
- stabilní upload,
- správné processing stavy,
- AI review nepadá,
- fallback funguje.

---

## 24. Rollout strategie

## 24.1 Fáze nasazení

### Interní vývojový režim
- scan + upload bez Adobe

### Interní pilot
- zapnout Adobe provider jen interně

### Omezený produkční pilot
- pár poradců, reálné dokumenty

### Postupné rozšíření
- více uživatelů,
- sledovat error rate a usage

## 24.2 Feature flags

Doporučené flagy:

- `mobile_scan_enabled`
- `document_processing_enabled`
- `adobe_processing_enabled`
- `document_extract_enabled`
- `ai_review_markdown_enabled`

---

## 25. Rizika a mitigace

## 25.1 Riziko: příliš velký scope v jedné iteraci

### Mitigace
Rozdělit na fáze a nejdřív dodat scan → upload → viewer.

## 25.2 Riziko: Adobe integrace zkomplikuje první release

### Mitigace
Adobe držet jako volitelnou vrstvu za feature flagem.

## 25.3 Riziko: mobilní scanner vrací rozdílné výsledky na iOS/Android

### Mitigace
Silná abstraction layer a normalizace společného výstupu.

## 25.4 Riziko: AI review se bude spoléhat jen na Adobe výstup

### Mitigace
Zachovat fallback chain a degradovat graceful způsobem.

## 25.5 Riziko: nekonzistentní processing stavy

### Mitigace
Jednoduchý explicitní stavový model + audit trail.

## 25.6 Riziko: vysoká spotřeba Adobe transakcí

### Mitigace
Podmíněné spouštění OCR/Extract a monitoring usage.

---

## 26. Doporučené pořadí implementace v praxi

### Iterace 1
- schema,
- mobile scan abstraction,
- review screen,
- PDF builder,
- upload,
- viewer,
- source metadata.

### Iterace 2
- provider interface,
- disabled provider,
- processing orchestrator skeleton,
- status UI.

### Iterace 3
- Adobe auth + OCR,
- Markdown,
- storage outputs,
- retry.

### Iterace 4
- AI input resolver,
- Extract JSON,
- lepší heuristiky,
- logging,
- rollout.

Toto pořadí je nejlepší kompromis mezi rychlostí doručení a technologickým rizikem.

---

## 27. Finální doporučení

Pro Aidvisora doporučuji tento cílový model:

- **vlastní mobile scan v appce** jako primární vstup dokumentu,
- **Aidvisor upload a viewer** jako produktové jádro,
- **Adobe PDF Services** jako volitelný server-side processing provider,
- **AI review** postavené nad nejlepší dostupnou reprezentací dokumentu,
- **graceful fallback** při vypnutém nebo selhaném processingu.

Tento model je:

- UXově čistý,
- technicky realistický,
- škálovatelný,
- bezpečný,
- a dává nejlepší poměr mezi vlastní kontrolou a rychlostí doručení.

---

## 28. Master checklist všech úkolů

### Analýza
- [ ] Zmapovat current upload flow
- [ ] Zmapovat document schema a ownership model
- [ ] Zmapovat AI review input pipeline
- [ ] Zmapovat mobile/web integrační body

### Datový model
- [ ] Přidat upload source
- [ ] Přidat processing provider
- [ ] Přidat processing status/stage
- [ ] Přidat output paths pro OCR/Markdown/Extract
- [ ] Přidat error a timestamps
- [ ] Zvážit nebo vytvořit `document_processing_jobs`

### Mobile scan
- [ ] Implementovat scanner abstraction
- [ ] Implementovat iOS scan flow
- [ ] Implementovat Android scan flow
- [ ] Normalizovat společný scan result model
- [ ] Ošetřit cancel/error flow

### Scan review UX
- [ ] Postavit scan review screen
- [ ] Přidat page preview
- [ ] Přidat add page
- [ ] Přidat retake page
- [ ] Přidat delete page
- [ ] Přidat reorder pages
- [ ] Přidat finalize scan action

### PDF a upload
- [ ] Implementovat PDF builder
- [ ] Napojit upload na existující pipeline
- [ ] Ukládat `source = mobile_scan`
- [ ] Ukládat page count a metadata
- [ ] Přidat progress UI
- [ ] Přidat retry uploadu

### Viewer
- [ ] Zobrazit dokument ihned po uploadu
- [ ] Zobrazit metadata dokumentu
- [ ] Zobrazit processing status
- [ ] Zobrazit AI review CTA
- [ ] Ošetřit loading/error states

### Provider vrstva
- [ ] Vytvořit provider interface
- [ ] Implementovat disabled provider
- [ ] Implementovat provider selection přes env/config
- [ ] Přidat processing orchestrator

### Adobe provider
- [ ] Přidat auth/token logiku
- [ ] Přidat asset upload
- [ ] Přidat OCR job
- [ ] Přidat Markdown job
- [ ] Přidat Extract job
- [ ] Přidat result download
- [ ] Ukládat outputy do storage
- [ ] Persistovat statusy a chyby

### Orchestrace a heuristiky
- [ ] Rozlišit mobile scan vs native PDF
- [ ] Detekovat scan-like soubory
- [ ] Spouštět OCR jen když dává smysl
- [ ] Spouštět Markdown jako AI-ready vrstvu
- [ ] Extract dělat podmíněně
- [ ] Zajistit retry-safe stavový model

### AI review
- [ ] Implementovat AI input resolver
- [ ] Preferovat Markdown
- [ ] Přidat fallback chain
- [ ] Zobrazit quality/status v UI
- [ ] Ověřit kompatibilitu se stávajícím review flow

### Kvalita a provoz
- [ ] Přidat logování klíčových kroků
- [ ] Přidat základní telemetry/metrics
- [ ] Přidat unit testy
- [ ] Přidat integrační testy
- [ ] Udělat smoke test na reálných dokumentech
- [ ] Zavést feature flags
- [ ] Připravit rollout a rollback scénář

---

## 29. Doporučení pro samotnou exekuci agentem

### Na plánování a architekturu
Použít reasoning-heavy model.

### Na implementaci
Použít model, který je silný v dlouhých multi-file code changes.

### Praktický workflow
1. vzít tento plán jako source of truth,
2. implementovat po fázích,
3. po každé fázi vrátit checklist hotových bodů,
4. nepřeskakovat datový model a statusy,
5. nepouštět Adobe jako první krok bez hotového scan/upload jádra.

---

## 30. Jedna věta, která shrnuje celý směr

**Aidvisor má vlastnit scan a dokumentové workflow; Adobe má pouze zvyšovat kvalitu zpracování dokumentu, ne být vstupní aplikací ani hard dependency celého systému.**
