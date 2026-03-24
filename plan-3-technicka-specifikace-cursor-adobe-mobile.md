# Plán 3 – Technická implementační specifikace pro Cursor

## Účel dokumentu
Tento dokument navazuje na:
- Plán 1: extrakce AI smluv a dokumentů
- Plán 2: Adobe + mobile scan integrace

Cílem je převést produktové a architektonické požadavky do konkrétní technické specifikace pro implementaci v aplikaci Aidvisora tak, aby:
- šlo spolehlivě číst textová PDF, scan PDF i mobilní fotky dokumentů,
- systém uměl rozlišit typ dokumentu,
- systém uměl vytěžit strukturovaná data,
- platební instrukce šly propsat do klientského portálu,
- backend se dal postupně rozšiřovat bez přepisování celé pipeline.

---

## 1. Hlavní technický cíl

Vybudovat univerzální `document ingestion + understanding pipeline`, která:
1. přijme dokument z webu nebo mobilu,
2. rozhodne, zda je dokument textový nebo scan/image,
3. pošle ho přes Adobe preprocessing,
4. připraví sjednocený canonical payload,
5. provede klasifikaci typu dokumentu,
6. zvolí správné extrakční schema,
7. vytěží strukturovaná data pomocí OpenAI GPT-5 mini,
8. validuje výsledek,
9. rozhodne o automatickém draftu vs. review,
10. propsatelným způsobem připraví výstupy do CRM, úkolů, email draftů a klientského portálu.

---

## 2. Scope dokumentů, které musí pipeline zvládnout

### 2.1 Primární podporované kategorie
1. Pojistná smlouva – rizikové životní pojištění
2. Pojistná smlouva – investiční životní pojištění
3. Návrh pojistné smlouvy
4. Změna / dodatek ke smlouvě
5. Modelace / detailní nabídka / ilustrace
6. Platební instrukce / investiční pokyn / pokyn k pravidelné investici
7. Úvěrová smlouva / spotřebitelský úvěr / hypotéka
8. Bankovní výpis / účetní výpis / pohyby
9. Doklad o příjmu / výplatní páska / daňové přiznání
10. Ostatní podpůrný finanční dokument
11. Unknown / unsupported

### 2.2 Důležité pravidlo
Pipeline nesmí předpokládat, že každý dokument je smlouva.
Nejdřív klasifikace, až potom schema selection.

---

## 3. Cílová architektura

## 3.1 Přehled vrstev

### A. Ingestion layer
- web upload
- AI drawer upload
- mobile scan upload
- budoucí email/forward ingestion

### B. Preprocessing layer
- Adobe PDF Services / Document Services
- normalizace PDF
- OCR / scan rozpoznání
- page extraction / image rendering / text extraction

### C. Understanding layer
- input mode detection
- document classification
- schema selection
- structured extraction
- validation
- confidence scoring

### D. Workflow layer
- review queue
- client matching
- draft actions
- payment instruction composer
- communication suggestions

### E. Apply layer
- create/update client
- create/update contract
- create payment setup
- create task
- create note
- create email draft

### F. Presentation layer
- review page
- AI assistant drawer
- dashboard assistant
- klientský portál – platební údaje

---

## 4. Hlavní pipeline – krok za krokem

## 4.1 Entry point
Každý dokument po nahrání obdrží:
- `documentId`
- `tenantId`
- `sourceType` = `web_upload | ai_drawer | mobile_scan | backoffice_import`
- `originalFilename`
- `mimeType`
- `storagePathOriginal`
- `uploadedBy`
- `uploadedAt`

### 4.2 Ingestion status machine
`uploaded -> preprocessing -> normalized -> classified -> extracting -> validating -> extracted | review_required | failed`

### 4.3 Input mode detection
Po preprocessing se musí určit:
- `text_pdf`
- `scanned_pdf`
- `image_document`
- `mixed_pdf`
- `unsupported`

### 4.4 Adobe preprocessing
Každý dokument jde přes Adobe vrstvu, která má vrátit canonical preprocessing výstup:
- `normalizedPdfPath`
- `ocrText`
- `pageCount`
- `pageImages[]`
- `hasTextLayer`
- `ocrConfidenceEstimate`
- `documentQualityWarnings[]`

### 4.5 Classification
Classifier musí vrátit:
- `detectedDocumentType`
- `classificationConfidence`
- `classificationReasons[]`
- `supportedForExtraction`

### 4.6 Schema selection
Podle `detectedDocumentType` se volí konkrétní extraction schema.
Schema selection musí být oddělená od klasifikace.

### 4.7 Structured extraction
OpenAI GPT-5 mini dostane:
- normalizovaný text,
- page-level snippets,
- případně selected image pages,
- system instrukce,
- JSON schema dle typu dokumentu.

Výstup musí být validován přes Zod.

### 4.8 Validation
Nad extrahovanými daty proběhne validační vrstva:
- formát čísel smluv,
- datumy,
- účty,
- IBAN,
- částky,
- frekvence,
- RČ / IČO,
- email,
- telefon,
- interní logické vztahy.

### 4.9 Review decision
Na základě classification confidence, extraction confidence a validation warnings se určí:
- `extracted`
- `review_required`
- `failed`

`failed` se smí použít jen když dokument opravdu nejde přečíst nebo pipeline spadla.
Scan dokument s validním fallbackem nesmí automaticky končit jako failed.

---

## 5. Adobe integrace – technický kontrakt

## 5.1 Role Adobe vrstvy
Adobe nebude dělat finální business extraction.
Adobe je preprocessing vrstva pro:
- PDF normalization,
- OCR,
- page image rendering,
- strukturální text extraction,
- případně detekci page blocks / table-like layout.

## 5.2 Server service
Vytvořit service např.:
- `apps/web/src/lib/documents/adobe-service.ts`

Service API:
- `preprocessDocument(input)`
- `normalizePdf(input)`
- `extractTextAndImages(input)`
- `detectScannedDocument(input)`

### 5.3 Výstup Adobe service
Canonical output:
```ts
{
  ok: boolean
  normalizedPdfPath?: string
  extractedText?: string
  pageImages?: Array<{ page: number; path: string }>
  hasTextLayer?: boolean
  pageCount?: number
  warnings?: string[]
  error?: { code: string; message: string }
}
```

## 5.4 Fallback pravidla
1. Když dokument obsahuje kvalitní textovou vrstvu -> extraction primárně z textu.
2. Když textová vrstva chybí nebo je slabá -> scan fallback.
3. Když je mixed PDF -> kombinace textu a page images.
4. Když preprocessing selže -> review_required nebo failed podle typu chyby.

---

## 6. OpenAI vrstva – technická role GPT-5 mini

## 6.1 Co GPT-5 mini dělá
- klasifikace dokumentu,
- strukturovaná extrakce,
- sekční confidence,
- business summarization,
- návrh draft akcí,
- návrh komunikace.

## 6.2 Co GPT-5 mini nedělá samo
- OCR bez preprocessing vrstvy jako jediný mechanismus,
- přímý zápis do produkčních tabulek,
- rozhodování bez guardrails,
- nahrazení validační logiky.

## 6.3 Service layer
Vytvořit nebo rozšířit service moduly:
- `document-classification.ts`
- `contract-extraction.ts`
- `payment-instruction-extraction.ts`
- `loan-extraction.ts`
- `income-document-extraction.ts`
- `review-decision.ts`

---

## 7. Klasifikace dokumentů – normalized taxonomy

## 7.1 Normalized document types
```ts
export type NormalizedDocumentType =
  | "insurance_contract_risk_life"
  | "insurance_contract_investment_life"
  | "insurance_contract_other"
  | "insurance_proposal"
  | "insurance_change_or_amendment"
  | "insurance_model_or_illustration"
  | "payment_instruction"
  | "loan_contract"
  | "loan_supporting_document"
  | "bank_statement"
  | "income_verification"
  | "financial_analysis_document"
  | "general_terms_or_appendix"
  | "unknown";
```

## 7.2 Poznámka
Raw model output může být širší nebo jiný.
Musí existovat mapování:
- raw model category
- normalized internal category

## 7.3 Rule-based override vrstva
Pokud dokument obsahuje velmi silné markery, classification musí mít override/boost.
Příklady:
- `Pojistná smlouva` + `Číslo pojistné smlouvy` + `Pojistitel` -> insurance contract
- `Detailní nabídka` + `nejedná se o nabídku na uzavření smlouvy` -> modelace / ilustrace
- `Platební instrukce` + `IBAN` + `Variabilní symbol` -> payment instruction
- `Smlouva o úvěru` + `Výše úvěru` + `RPSN` -> loan contract
- `Výpis z účtu` + `Počáteční zůstatek` + `Konečný zůstatek` -> bank statement

---

## 8. Extrakční schémata – povinné rodiny schémat

## 8.1 Common base schema
Všechna schémata musí mít minimálně:
- `documentId`
- `detectedDocumentType`
- `documentTitle`
- `institutionName`
- `clientCandidates[]`
- `missingFields[]`
- `validationWarnings[]`
- `fieldConfidenceMap`
- `needsHumanReview`
- `summary`

## 8.2 Insurance contract schema
Pole minimálně:
- číslo smlouvy
- typ pojištění
- produkt
- pojistitel
- pojistník
- pojištěné osoby
- rodné číslo / datum narození
- počátek pojištění
- konec pojištění
- pojistná doba
- frekvence placení
- běžné / jednorázové pojistné
- účet / VS / SS / IBAN, pokud je uvedeno
- sjednaná připojištění
- pojistné částky
- zprostředkovatel / poradce
- AML / identifikační sekce

## 8.3 Insurance proposal schema
Pole jako u smlouvy, ale navíc:
- `proposalStatus`
- `isFinalContract = false`
- `containsIllustrativeValues`

## 8.4 Insurance change/amendment schema
- číslo původní smlouvy
- typ změny
- datum účinnosti změny
- co se mění
- co se ruší
- co se přidává

## 8.5 Modelation / illustration schema
- číslo nabídky / modelace
- produkt
- klient
- navržené rizika / fondy
- kalkulované pojistné / investice
- disclaimer, že nejde o finální smlouvu

## 8.6 Payment instruction schema
- instituce / společnost
- produkt / fond / smlouva
- číslo smlouvy
- příjemce platby
- účet
- bank code
- IBAN
- BIC/SWIFT
- VS
- SS
- KS
- měna
- částka
- frekvence
- datum první platby
- účel platby
- upozornění / instrukce k párování plateb

## 8.7 Loan contract schema
- číslo smlouvy
- banka
- klient
- výše úvěru
- úroková sazba
- RPSN
- počet splátek
- výše splátky
- datum první splátky
- datum poslední splátky
- účet čerpání
- typ úvěru

## 8.8 Bank statement schema
- účet
- IBAN
- období
- počáteční zůstatek
- konečný zůstatek
- kreditní/debetní souhrny
- transaction summary
- možnost exportu transakcí do pomocné analytické vrstvy

## 8.9 Income verification schema
- typ dokladu
- období
- zaměstnavatel / subjekt
- příjem čistý / hrubý
- odvody / daň / bonusy, pokud relevantní
- použitelnost pro bonita flow

---

## 9. Platební instrukce -> klientský portál

## 9.1 Cíl
Z nahraných platebních instrukcí musí vzniknout strukturovaný objekt pro klientský portál, kde klient uvidí:
- co platí,
- komu platí,
- na jaký účet,
- jaký symbol použít,
- jak často platí,
- kdy platba začíná,
- v jaké měně,
- zda jde o povinnou, doporučenou nebo jednorázovou platbu.

## 9.2 Payment setup entity
Navržená doménová entita:
```ts
{
  paymentSetupId: string
  tenantId: string
  clientId: string
  sourceDocumentId: string
  status: "draft" | "review_required" | "active" | "archived"
  paymentType: "insurance" | "investment" | "loan" | "other"
  providerName: string
  productName?: string
  contractNumber?: string
  beneficiaryName?: string
  accountNumber?: string
  bankCode?: string
  iban?: string
  bic?: string
  variableSymbol?: string
  specificSymbol?: string
  constantSymbol?: string
  amount?: number
  currency?: string
  frequency?: "monthly" | "quarterly" | "semiannual" | "annual" | "one_off" | "unknown"
  firstPaymentDate?: string
  dueDayOfMonth?: number
  paymentInstructionsText?: string
  confidence?: number
  needsHumanReview?: boolean
}
```

## 9.3 Business pravidla
- Pokud chybí klíčové identifikátory platby, payment setup nesmí být aktivován bez review.
- Pokud existuje více platebních variant v jednom dokumentu, musí se rozdělit do více draft položek.
- Pokud dokument obsahuje pouze obecné instrukce bez vazby na klienta, zůstane jen review suggestion.

---

## 10. Mobile scan flow – iOS / Android

## 10.1 Cíl
Mobilní aplikace musí umět z fotoaparátu vytvořit použitelný vstup pro pipeline.

## 10.2 Požadované kroky v appce
1. otevřít scan režim,
2. detekovat okraje dokumentu,
3. vyfotit jednu nebo více stran,
4. umožnit retake,
5. pages spojit do PDF,
6. poslat do stejného upload endpointu jako web,
7. označit sourceType jako `mobile_scan`.

## 10.3 Metadata z mobile skenu
- `captureMode = camera_scan`
- `pageCount`
- `devicePlatform = ios | android`
- `captureQualityWarnings[]`
- `manualCropApplied`
- `rotationAdjusted`

## 10.4 Povinné UX stavy
- scan quality preview
- warning při rozmazání
- warning při nízkém kontrastu
- preview výsledného PDF
- progress uploadu
- progress AI zpracování

## 10.5 Sjednocení s webem
Mobilní scan nesmí mít vlastní separátní business pipeline.
Musí končit do stejného document ingestion flow jako web upload.

---

## 11. API a service kontrakty

## 11.1 Upload API
### `POST /api/documents/upload`
Vstup:
- multipart file
- optional metadata

Výstup:
```json
{
  "ok": true,
  "documentId": "...",
  "processingStatus": "uploaded"
}
```

## 11.2 Start processing API
### `POST /api/documents/process/:id`
Spustí preprocessing + classification + extraction.

## 11.3 Review detail API
### `GET /api/documents/review/:id`
Vrací:
- source file metadata
- preprocessing metadata
- classification
- extraction result
- validation warnings
- draft actions
- payment setup draft, pokud relevantní

## 11.4 Assistant upload action
AI drawer nesmí implementovat separátní upload backend.
Použije stejný upload endpoint a jen jinou UI orchestraci.

## 11.5 Payment preview API
### `GET /api/clients/:id/payment-setups`
Vrací seznam aktivních i draft payment setups pro klientský portál a poradce.

---

## 12. DB / persistence návrh

## 12.1 Document records
Tabulka např. `document_ingestions`
- id
- tenant_id
- source_type
- original_filename
- mime_type
- storage_path_original
- storage_path_normalized
- processing_status
- input_mode
- extraction_mode
- uploaded_by
- uploaded_at
- processed_at
- failed_step
- error_code
- error_message_safe

## 12.2 Document classification
Tabulka nebo JSON sloupec:
- detected_document_type
- raw_classification_value
- classification_confidence
- classification_reasons
- classification_override_reason

## 12.3 Document extraction results
- schema_selected
- extracted_payload
- field_confidence_map
- validation_warnings
- missing_fields
- needs_human_review

## 12.4 Human corrections
Tabulka např. `document_extraction_corrections`
- id
- document_id
- original_payload
- corrected_payload
- corrected_fields
- correction_reason
- corrected_by
- corrected_at

## 12.5 Payment setup drafts
Tabulka např. `client_payment_setups`
- dle entity výše

---

## 13. Review workflow

## 13.1 Kdy automaticky review_required
- scan s nízkou OCR kvalitou
- nejasná klasifikace
- chybí číslo smlouvy u smlouvy
- chybí účet/VS u platební instrukce
- více kandidátů klienta s podobným score
- validační konflikt mezi poli

## 13.2 Review obrazovka musí ukazovat
- originální PDF
- normalized PDF / preview pages
- detected document type
- input mode
- extraction mode
- extracted payload
- field confidence
- warnings
- proposed actions
- payment setup preview

## 13.3 Human correction loop
Review uživatel musí umět:
- upravit extrahovaná pole,
- změnit typ dokumentu,
- potvrdit payment setup,
- přiřadit ke klientovi,
- označit dokument jako nepodporovaný.

---

## 14. Client matching

## 14.1 Matching signály
- rodné číslo
- IČO
- datum narození
- jméno + příjmení
- email
- telefon
- adresa
- číslo smlouvy u známých providerů

## 14.2 Výstup matching engine
```ts
{
  clientId: string
  score: number
  confidence: "high" | "medium" | "low"
  reasons: string[]
  matchedFields: Record<string, boolean>
}
```

## 14.3 Guardrail
Bez jednoznačného matchingu nesmí dojít k přímému zápisu do finálního klienta bez potvrzení.

---

## 15. Validace a confidence

## 15.1 Povinné confidence buckets
- `classificationConfidence`
- `clientConfidence`
- `contractConfidence`
- `paymentConfidence`
- `datesConfidence`
- `institutionConfidence`

## 15.2 Validation warnings examples
- číslo smlouvy nenalezeno
- částka není ve validním formátu
- IBAN neprošel validací
- frekvence není rozpoznána
- dokument obsahuje disclaimer, že nejde o finální smlouvu
- OCR text má nízkou kvalitu

---

## 16. Observability a debug

## 16.1 Ukládat pro každý dokument
- input mode
- preprocessing result
- classification result
- selected schema
- extraction latency
- validation issues
- final status

## 16.2 Nelogovat
- celé PDF do plain logů
- celé OCR texty do běžných logů
- citlivé identifikátory bez maskování

## 16.3 Bezpečný debug payload
Povolit interní debug view jen pro admin/review role.

---

## 17. Bezpečnost a compliance

- tenant isolation u všech dokumentů,
- signed URLs pro originální PDF,
- server-side only OpenAI a Adobe volání,
- žádné API klíče do klienta,
- audit trail uploadu, review a apply akcí,
- maskování citlivých identifikátorů v logu,
- možnost retention policy pro dokumenty.

---

## 18. Rollout plán pro Cursor

## Fáze A – Adobe preprocessing foundation
- service layer
- canonical preprocessing output
- input mode detection
- normalized PDF storage

## Fáze B – classification + schema selection
- normalized taxonomy
- mapping raw -> normalized
- rule-based overrides

## Fáze C – extraction families
- insurance contract
- insurance proposal/modelation
- payment instructions
- loan contract
- income docs
- bank statement

## Fáze D – payment setup flow
- payment schema
- client portal data model
- draft activation flow

## Fáze E – mobile scan integration
- capture flow
- PDF assembly
- shared upload endpoint

## Fáze F – correction loop + eval
- corrected payload storage
- comparison tools
- dataset foundation

---

## 19. Co má Cursor dodat z tohoto dokumentu

### Povinné deliverables
1. Service vrstva pro Adobe preprocessing
2. Sjednocený document ingestion model
3. Input mode detection
4. Klasifikační vrstva
5. Schema selection engine
6. Nové extraction schema rodiny
7. Payment setup doménový model
8. Mobile scan kompatibilní upload flow
9. Review payload enrichment
10. Human correction storage

---

## 20. Definition of done

Tato iniciativa je považována za funkčně připravenou, když:
- textové PDF jde spolehlivě klasifikovat a vytěžit,
- scan PDF jde přes Adobe + fallback číst bez tvrdého failu,
- systém rozliší finální smlouvu vs. modelaci vs. platební instrukce,
- z platebních instrukcí umí vytvořit draft platebních údajů do klientského portálu,
- review detail ukazuje, proč AI něčemu věří / nevěří,
- lidské opravy se ukládají pro další zlepšování,
- web a mobile scan končí do jedné pipeline.

---

## 21. Doporučené navazující dokumenty
Po tomto Plánu 3 mají vzniknout ještě:
1. Cursor execution prompt – implementační prompt po fázích
2. DB migration spec – přesné tabulky a sloupce
3. Adobe integration spec – endpointy, retry, timeout, failure modes
4. Mobile scan UX spec – iOS/Android capture flow
5. Eval spec – jak měřit přesnost klasifikace a extrakce

