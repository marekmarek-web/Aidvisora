# Aidvisora – plnohodnotný plán AI extrakce dat z nahraných smluv a dokumentů

## 1. Cíl

Cílem je navrhnout a implementovat robustní AI pipeline, která umí spolehlivě zpracovat prakticky všechny běžné dokumenty, které finanční poradce do Aidvisory nahraje, pokud mají rozumnou kvalitu a čitelnost. Systém nesmí být omezen jen na „čisté textové PDF“. Musí zvládnout:

- textové PDF,
- naskenované PDF,
- fotografii dokumentu,
- smíšené PDF obsahující text i obraz,
- vícestránkové dokumenty,
- kombinace smluv, příloh, návrhů, dodatků, AML bloků, platebních instrukcí a potvrzení.

Systém musí umět:

1. rozpoznat, co bylo nahráno,
2. bezpečně přečíst dokument včetně scanů,
3. rozhodnout, jaký dokumentový typ to je,
4. vytěžit správná data podle typu dokumentu,
5. přiřadit výsledek ke klientovi nebo navrhnout nového,
6. připravit návazné akce do CRM,
7. z platebních instrukcí vytvořit platební údaje do klientského portálu,
8. poslat nejasné případy do review,
9. ukládat korekce a zlepšovat extrakci v čase.

Tento plán počítá s integrací OpenAI GPT-5 mini jako hlavního extrakčního a rozhodovacího modelu a s Adobe jako klíčovou vrstvou pro preprocessing, PDF normalizaci, OCR a případně strukturální zpracování dokumentů.

---

## 2. Co ukazuje vzorek dodaných dokumentů

Z reálných ukázek je zřejmé, že poradci nebudou nahrávat jen jeden homogenní typ dokumentu. Ve vzorku se objevují minimálně tyto kategorie:

### 2.1 Finální pojistné smlouvy
Například Generali Bel Mondo 20 s jasně uvedeným nadpisem „Pojistná smlouva“, číslem pojistné smlouvy, pojistitelem, pojistníkem, počátkem a koncem pojištění a dalšími smluvními údaji.

### 2.2 Investiční životní smlouvy
Například investiční životní pojištění Bel Mondo 20, kde je podobná struktura jako u rizikového životního pojištění, ale přibývají investiční složky.

### 2.3 Návrhy / modelace / detailní nabídky
Například UNIQA „Detailní nabídka“, kde je výslovně uvedeno, že nejde o nabídku na uzavření smlouvy, ale o informační modelaci. Tuto kategorii je nutné striktně odlišit od uzavřené smlouvy.

### 2.4 Platební instrukce k investicím
Například Fundoo / Amundi dokumenty s bankovními spojeními, IBANy, variabilními symboly a částkami pro pravidelné investování.

### 2.5 Úvěrové smlouvy
Například smlouva o spotřebitelském úvěru od ČSOB, se splátkami, úrokem, RPSN, účtem, termíny splatnosti a parametry čerpání.

### 2.6 Změny a dodatky ke smlouvám
Například dokumenty typu změna smlouvy, doplnění, úprava krytí, změna údajů apod.

### 2.7 Doklady pro bonitu a finanční analýzu
Například daňová přiznání, výplatní pásky, potvrzení o příjmu, bankovní výpisy.

### 2.8 Platební / bankovní dokumenty
Například poštovní účet, výpisy a další dokumenty užitečné pro ověření platebních toků.

Z toho plyne, že systém musí být navržen jako **document understanding platform**, ne jako jednorázový parser jedné pojistné šablony.

---

## 3. Hlavní principy návrhu

### 3.1 Neexistuje „jedno extraction schema pro všechno"
Musí existovat klasifikační vrstva a více schémat.

### 3.2 Sken není chyba dokumentu
Pokud dokument nemá textovou vrstvu, systém ho musí zkusit přečíst přes OCR/image pipeline. „Failed“ je až poslední možnost.

### 3.3 Unsupported dokument není chyba pipeline
Když uživatel nahraje například modelaci nebo potvrzení o příjmu, systém to musí rozpoznat a buď vytěžit jiným schématem, nebo poslat do review jako „jiný podporovaný dokumentový typ“.

### 3.4 Review je součást produktu, ne nouzové řešení
Nejasné nebo nízko-confidenční případy musí jít do review fronty s vysvětlením proč.

### 3.5 Každý extrahovaný údaj má mít původ, confidence a validaci
Nestačí vytáhnout jen text. Každá důležitá entita má mít:
- hodnotu,
- confidence,
- zdroj,
- validační stav,
- případné upozornění.

### 3.6 Adobe a GPT se mají doplňovat
Adobe má dodat robustní zpracování dokumentu a OCR/preprocessing. GPT má dělat porozumění, klasifikaci, normalizaci, strukturovanou extrakci a návrh akcí.

---

## 4. Cílová architektura pipeline

### Fáze 0 – příjem souboru
Po uploadu se uloží:
- originální soubor,
- metadata souboru,
- tenant,
- uploader,
- source (AI drawer, review page, mobile scan apod.),
- MIME type,
- velikost,
- počet stran,
- hash souboru,
- status zpracování.

### Fáze 1 – normalizace vstupu
Systém sjednotí vstup na zpracovatelný formát.

#### Vstupy:
- PDF s textem,
- PDF scan,
- JPG/PNG/HEIC,
- DOC/DOCX,
- případně vícestránkový mobilní scan.

#### Výstupy:
- normalized PDF,
- page images,
- text layer (pokud existuje),
- OCR layer,
- technical quality metrics.

Tato vrstva je primárně práce pro Adobe preprocessing + případné pomocné lokální utility.

### Fáze 2 – detekce input mode
Systém určí:
- `text_pdf`
- `scanned_pdf`
- `image_document`
- `mixed_pdf`
- `unsupported`

Uloží také:
- `inputMode`
- `extractionMode`
- `ocrRequired`
- `pageCount`
- `qualityWarnings[]`

### Fáze 3 – raw content extraction
- Pro textové PDF: vytáhnout text + layout.
- Pro scan: OCR přes Adobe, případně image-based page extraction.
- Pro obrazové dokumenty: OCR + page segmentation.

Výstup:
- raw text,
- page-level text,
- key visual blocks,
- detected tables,
- detected signatures,
- detected form fields,
- page confidence.

### Fáze 4 – document classification
Nejdřív se musí rozhodnout, co dokument je.

### Fáze 5 – schema selection
Podle klasifikace se vybere správné extrakční schéma.

### Fáze 6 – structured extraction
GPT vytvoří přesný JSON podle schématu.

### Fáze 7 – validation
Proběhne validační vrstva nad extrahovanými daty.

### Fáze 8 – review decision
Na základě confidence a validací se určí:
- `extracted`
- `review_required`
- `failed`

### Fáze 9 – CRM mapping a draft actions
Systém navrhne:
- přiřazení ke klientovi,
- vytvoření nového klienta,
- vytvoření nebo aktualizaci smlouvy,
- vytvoření platebních údajů,
- vytvoření úkolu,
- připravení emailu,
- vytvoření notifikace.

### Fáze 10 – human correction loop
Lidské opravy se ukládají jako cenný eval/training materiál.

---

## 5. Dokumentová taxonomie

Níže je doporučená cílová klasifikace dokumentů.

### 5.1 Smluvní dokumenty
- `insurance_contract_life_risk`
- `insurance_contract_life_investment`
- `insurance_contract_nonlife`
- `loan_contract_consumer`
- `mortgage_contract`
- `investment_contract`
- `pension_contract`
- `supplementary_contract_or_amendment`

### 5.2 Předsmluvní / modelační dokumenty
- `insurance_proposal`
- `insurance_quote_or_modelation`
- `investment_modelation`
- `precontract_information`
- `illustrative_document`

### 5.3 Platební a instrukční dokumenty
- `payment_instruction`
- `investment_payment_instruction`
- `standing_order_or_bank_instruction`
- `account_statement`
- `payment_schedule`

### 5.4 Bonita / příjem / analýza
- `income_confirmation`
- `payslip`
- `tax_return_individual`
- `tax_return_company`
- `financial_analysis`
- `underwriting_support_document`

### 5.5 Ostatní
- `identity_document`
- `medical_questionnaire`
- `consent_or_declaration`
- `terms_and_conditions`
- `unknown`

Každý dokument může mít také:
- `isFinalContract`
- `isProposalOnly`
- `containsPaymentInstructions`
- `containsClientData`
- `containsAdvisorData`
- `containsMultipleDocumentSections`

---

## 6. Jak musí systém poznat rozdíl mezi modelací, smlouvou a platebními pokyny

Tohle je kritická produktová část.

### 6.1 Finální smlouva
Silné znaky:
- výrazy typu „Pojistná smlouva“, „Smlouva o úvěru“, „Smlouva o spotřebitelském úvěru“,
- číslo smlouvy,
- podpisy nebo doložka uzavření,
- datum uzavření,
- formulace „smlouva vznikla“,
- jasné smluvní strany,
- parametry produktu a závazku.

### 6.2 Návrh / modelace / detailní nabídka
Silné znaky:
- „Návrh pojistné smlouvy“,
- „Detailní nabídka“,
- „Modelace“,
- „Tato nabídka je pouze informačním sdělením...“,
- „může se od konečné výše pojistného lišit“,
- chybí finální uzavírací doložka a podpisová finalita.

### 6.3 Platební pokyny
Silné znaky:
- „Platební instrukce“,
- „Bankovní spojení“,
- IBAN,
- variabilní symbol,
- částka v CZK/EUR/USD,
- frekvence, měsíčně / jednorázově,
- účet příjemce,
- instrukce pro zaslání investice / pojistného.

### 6.4 Změna smlouvy
Silné znaky:
- „změna smlouvy“,
- „dodatek“,
- „změna údajů“,
- reference na existující číslo smlouvy,
- upravované parametry bez vzniku zcela nové smlouvy.

---

## 7. Extrakční profily podle typu dokumentu

## 7.1 Životní pojistná smlouva – rizikové

### Povinná data
- typ dokumentu,
- finální/návrh,
- pojišťovna,
- produkt,
- číslo smlouvy,
- číslo obchodního případu,
- datum uzavření,
- počátek pojištění,
- konec pojištění,
- délka pojištění,
- pojistník,
- pojištěné osoby,
- rodné číslo / datum narození,
- adresa,
- kontakty,
- zprostředkovatel,
- vázaný zástupce,
- výše pojistného,
- frekvence placení,
- účet/IBAN/VS/SIPO/instrukce,
- sjednaná rizika,
- pojistné částky,
- připojištění,
- beneficient/oprávněná osoba, pokud je uvedena,
- AML/KYC údaje, pokud jsou součástí.

### Volitelná data
- zdravotní údaje, pokud mají být zpracovány a je to compliance-safe,
- sleva/přirážka,
- způsob podpisu,
- zpracovatel nabídky.

## 7.2 Životní pojistná smlouva – investiční
Vše z bodu 7.1 plus:
- investiční složka,
- investiční strategie,
- fondy,
- alokace,
- pravidelné mimořádné pojistné,
- investiční rizika,
- poplatková struktura, pokud je z dokumentu extrahovatelná.

## 7.3 Návrh pojistné smlouvy
- vše podobné smlouvě,
- ale s flagem `proposalOnly = true`,
- `notFinalContract = true`,
- `contractStatus = draft_or_proposal`.

## 7.4 Modelace / detailní nabídka
- dokument type,
- instituce,
- produkt,
- číslo nabídky,
- datum vystavení,
- zpracovatel,
- klient,
- navržená rizika,
- navrhované pojistné,
- délka trvání,
- slevy/přirážky,
- disclaimers, že nejde o finální smlouvu.

## 7.5 Platební instrukce k investici / pojištění
Tohle je kritická větev pro klientský portál.

### Extrahovat:
- poskytovatel / platforma,
- produkt,
- typ investice / pojistky,
- číslo smlouvy / reference,
- klient,
- variabilní symbol,
- specifický symbol, pokud je,
- bankovní účet,
- kód banky,
- IBAN,
- SWIFT/BIC, pokud je,
- měna,
- jednorázová částka,
- pravidelná částka,
- frekvence,
- datum první platby,
- instrukce „kam, kolik, jak často“,
- podmínky minimální investice,
- oddělené instrukce pro CZK / EUR / USD,
- účel platby.

### CRM/portál výstup:
- platební karta v portálu klienta,
- jasně zobrazit:
  - co platí,
  - komu platí,
  - na jaký účet,
  - jaký symbol použít,
  - kolik,
  - kdy,
  - jak často.

## 7.6 Úvěrová smlouva
- typ úvěru,
- poskytovatel,
- číslo smlouvy,
- klient,
- datum uzavření,
- výše úvěru,
- úrok,
- RPSN,
- splatnost,
- počet splátek,
- výše splátky,
- první a poslední splátka,
- účet pro čerpání,
- účet splácení,
- účelovost,
- další poplatky,
- zprostředkovatel.

## 7.7 Daňové přiznání / potvrzení o příjmu / výplatní páska
Tyto dokumenty nemusí generovat „smlouvu“, ale musí být čitelné pro:
- ověření příjmu,
- underwriting,
- bonitu,
- finanční analýzu,
- doplnění klientského profilu.

Extrahovat:
- typ dokladu,
- osoba / firma,
- IČO / RČ,
- období,
- příjmy,
- daňový základ,
- čistý příjem,
- zaměstnavatel,
- potvrzující subjekt,
- relevantní částky.

## 7.8 Bankovní výpis / poštovní účet
- číslo účtu,
- vlastník účtu,
- období,
- kredit/debet,
- relevantní příchozí/odchozí platby,
- opakující se platby,
- identifikace plateb spojených se smlouvou.

---

## 8. Adobe + AI spolupráce

## 8.1 Role Adobe
Adobe vrstva má dělat zejména:
- normalizaci PDF,
- OCR scanů,
- extrakci textové vrstvy,
- rozpad dokumentu na stránky,
- zachování layoutu,
- případnou identifikaci formulářových bloků,
- práci s obrazovými vstupy,
- technické zlepšení čitelnosti.

## 8.2 Role GPT-5 mini
GPT-5 mini má dělat:
- klasifikaci dokumentu,
- porozumění obsahu,
- mapování do schémat,
- rozlišení smlouva vs. modelace vs. instrukce,
- normalizaci údajů,
- field-level confidence,
- review důvody,
- návrhy CRM akcí,
- tvorbu follow-up návrhů.

## 8.3 Doporučené pořadí
1. Upload.
2. Adobe preprocessing.
3. Kontrola textové vrstvy.
4. Pokud scan, OCR + page image extraction.
5. Do AI vrstvy poslat:
   - raw text,
   - page text,
   - page image references nebo vizuální strukturu,
   - metadata o kvalitě.
6. AI provede classification + schema selection + extraction.

---

## 9. Scan/OCR fallback – kritický požadavek

Systém musí být navržen s předpokladem, že značná část dokumentů bude naskenovaná.

### 9.1 Co systém musí poznat
- text layer chybí,
- text layer je příliš slabá,
- PDF je jen obraz,
- dokument je šikmo,
- dokument má špatný kontrast,
- dokument je částečně oříznutý,
- dokument je více-stránkový scan.

### 9.2 Co systém musí udělat
- nepřepnout rovnou na `failed`,
- přepnout na `scan_fallback`,
- zkusit OCR,
- zkusit obrazové čtení stránkově,
- uložit `extractionWarnings`.

### 9.3 UI komunikace
Místo „Extrakce selhala“ raději:
- „Dokument je scan. Přepínáme na OCR režim.“
- „Kvalita dokumentu je nižší, některé údaje mohou vyžadovat kontrolu.“

---

## 10. Field-level confidence a validace

## 10.1 Confidence musí být po sekcích
Doporučené členění:
- `documentTypeConfidence`
- `clientConfidence`
- `contractConfidence`
- `institutionConfidence`
- `paymentDetailsConfidence`
- `datesConfidence`
- `advisorConfidence`

## 10.2 U klíčových polí i per-field confidence
Například:
- číslo smlouvy,
- jméno klienta,
- rodné číslo,
- účet,
- IBAN,
- VS,
- částka,
- datum počátku,
- datum splatnosti,
- frekvence.

## 10.3 Validace
Musí se kontrolovat minimálně:
- validita dat,
- rozumný formát čísla smlouvy,
- že částka je číslo,
- že frekvence je jedna z povolených hodnot,
- že IBAN/account number vypadá validně,
- že datumy dávají smysl,
- že „návrh“ není označen jako finální smlouva,
- že platební instrukce nejsou zaměněny za smlouvu,
- že u změnového dokumentu je reference na existující smlouvu.

---

## 11. Matching klienta a CRM akce

## 11.1 Co AI po extrakci navrhne
- přiřadit ke stávajícímu klientovi,
- vytvořit nového klienta,
- vytvořit novou smlouvu,
- aktualizovat existující smlouvu,
- vytvořit platební údaje,
- vytvořit úkol,
- připravit email,
- upozornit na review.

## 11.2 Matching logika
Podle:
- rodného čísla,
- IČO,
- jména + data narození,
- emailu,
- telefonu,
- adresy,
- čísla smlouvy,
- reference produktu,
- vazby na stávající záznamy.

## 11.3 Platební údaje do portálu
Pokud dokument obsahuje platební pokyny, musí se vygenerovat strukturovaný platební objekt:
- název závazku,
- typ platby,
- poskytovatel,
- smlouva/reference,
- účet příjemce,
- IBAN,
- VS,
- částka,
- frekvence,
- první splatnost,
- měna,
- poznámka klientovi.

Klient pak v portálu jasně uvidí:
- co má platit,
- kolik,
- jak často,
- na jaký účet,
- s jakým symbolem,
- od kdy.

---

## 12. Review systém

Review není jen „něco se pokazilo“.

### 12.1 Do review jde dokument, pokud:
- dokumentType confidence je nízká,
- klíčové údaje chybí,
- scan je nekvalitní,
- více kandidátů klienta,
- typ dokumentu je podporovaný, ale nejednoznačný,
- validace vrací varování,
- platební instrukce jsou neúplné.

### 12.2 Review detail musí ukazovat
- originální PDF,
- detekovaný typ dokumentu,
- input mode,
- extraction mode,
- extrahovaná data,
- field confidence,
- validation warnings,
- kandidáty klienta,
- návrhy akcí,
- důvod review.

### 12.3 Opravy člověka
- upravit pole,
- potvrdit klienta,
- potvrdit vytvoření nového klienta,
- potvrdit platební údaje,
- zamítnout extrakci.

---

## 13. Human correction loop a eval dataset

Tohle je kritické pro zlepšování čtení smluv v čase.

## 13.1 Co ukládat
- original extracted payload,
- corrected payload,
- corrected fields,
- correction reason,
- corrected by,
- corrected at,
- source document type,
- input mode,
- extraction mode.

## 13.2 Eval dataset
Musí vzniknout sada reálných anonymizovaných dokumentů se správným ground truth JSON.

Minimální první sada:
- 10 textových životních smluv,
- 10 scan životních smluv,
- 5 návrhů / modelací,
- 5 platebních instrukcí,
- 5 úvěrových smluv,
- 5 bonusových dokumentů: výplatní páska, daňové přiznání, výpis.

## 13.3 Metriky
- document classification accuracy,
- contract extraction completeness,
- field-level accuracy,
- payment instruction extraction accuracy,
- client matching accuracy,
- review rate,
- false positive apply rate.

---

## 14. Doporučená data schémata

## 14.1 CommonDocumentEnvelope
- documentId
- tenantId
- sourceFile
- inputMode
- extractionMode
- documentTypeRaw
- documentTypeNormalized
- classificationConfidence
- supportedForExtraction
- reviewRequired
- warnings[]
- pages[]

## 14.2 InsuranceContractSchema
- contractType
- insurer
- productName
- contractNumber
- businessCaseNumber
- contractStatus
- dateSigned
- effectiveDate
- expirationDate
- duration
- policyHolder
- insuredPersons[]
- beneficiaries[]
- advisor
- brokerCompany
- premium
- paymentFrequency
- paymentInstructions
- coverages[]
- riders[]
- amlData
- confidenceMap
- missingFields[]

## 14.3 ProposalOrModelationSchema
- proposalType
- provider
- productName
- proposalNumber
- issuedAt
- validUntil
- preparedBy
- client
- proposedCoverages[]
- proposedPremium
- disclaimers[]
- confidenceMap

## 14.4 PaymentInstructionSchema
- provider
- platform
- contractReference
- client
- paymentPurpose
- paymentType
- regularAmount
- oneOffAmount
- frequency
- currency
- bankAccount
- bankCode
- iban
- bic
- variableSymbol
- specificSymbol
- firstPaymentDate
- paymentInstructionsText
- confidenceMap

## 14.5 LoanContractSchema
- lender
- contractNumber
- borrower
- loanAmount
- annualRate
- apr
- monthlyInstallment
- installmentCount
- firstInstallmentDate
- lastInstallmentDate
- repaymentDay
- payoutAccount
- fees[]
- purpose
- broker
- confidenceMap

---

## 15. UX požadavky pro AI asistenta

## 15.1 Po uploadu má AI mluvit lidsky
Například:
- „Rozpoznala jsem pojistnou smlouvu k rizikovému životnímu pojištění.“
- „Našla jsem platební instrukce pro pravidelnou investici.“
- „Dokument je scan, část údajů může vyžadovat kontrolu.“
- „Tohle je modelace / nabídka, ne finálně uzavřená smlouva.“

## 15.2 AI má ukazovat quick actions
- Přiřadit ke klientovi
- Vybrat kandidáta klienta
- Vytvořit nového klienta
- Vytvořit platební údaje
- Vytvořit úkol
- Připravit email
- Otevřít detail review

## 15.3 Chybové stavy musí být srozumitelné
Špatně:
- „invalid schema“
- „extraction failed"

Správně:
- „Dokument byl rozpoznán jako jiný typ než podporovaná finální smlouva.“
- „Dokument je scan a kvalita OCR je nízká.“
- „Platební instrukce neobsahují dost údajů pro automatické založení plateb.“

---

## 16. Bezpečnost a compliance

- žádné API klíče na klientu,
- tenant isolation všude,
- audit log pro extrakci a apply,
- maskování citlivých údajů v logu,
- opatrnost u zdravotních dat a rodných čísel,
- možnost role-based přístupu k detailům dokumentu,
- možnost vypnout automatický apply,
- platební údaje zapisovat až po validaci nebo review.

---

## 17. Technický implementační plán po fázích

## Fáze 1 – stabilní ingestion a preprocessing
- upload,
- storage,
- metadata,
- Adobe preprocessing,
- input mode detection,
- OCR fallback.

## Fáze 2 – classification engine
- document taxonomy,
- classifyDocument service,
- rule boosts a heuristiky,
- normalization vrstvy.

## Fáze 3 – schema-based extraction
- separate schemas,
- structured outputs,
- Zod validace,
- field confidence.

## Fáze 4 – payment instruction pipeline
- special payment schema,
- mapping do klientského portálu,
- validace VS/IBAN/účtu/frekvence.

## Fáze 5 – review workspace
- review queue,
- review detail,
- human corrections,
- confidence a warnings.

## Fáze 6 – CRM mapping a apply
- client matching,
- create/update client,
- create/update contract,
- create payment setup,
- create task,
- email draft.

## Fáze 7 – eval a continuous improvement
- corrected payload store,
- eval dataset,
- regression tests,
- document coverage dashboard.

---

## 18. Akceptační kritéria

Systém je připravený až když:

1. rozezná finální smlouvu, návrh, modelaci, změnu a platební pokyny,
2. zvládne textové PDF i scan s rozumnou kvalitou,
3. nepovažuje modelaci za finální smlouvu,
4. umí z platebních instrukcí založit použitelné platební údaje do portálu,
5. vrací field-level confidence,
6. nejasné případy posílá do review místo tvrdého failu,
7. lidské opravy se ukládají,
8. funguje matching klienta,
9. existují eval testy na reálných vzorcích,
10. UI umí uživateli lidsky vysvětlit, co systém našel a co udělá dál.

---

## 19. Doporučení pro zadání Cursoru

Z tohoto plánu by měly vzniknout minimálně tři navazující implementační prompty:

1. **Document ingestion + Adobe preprocessing + OCR fallback**
2. **Classification + schema selection + extraction profiles**
3. **Payment instructions -> client portal payment setup + review/correction loop**

---

## 20. Shrnutí

Aidvisora nesmí mít „AI na čtení jedné smlouvy“. Musí mít **plnohodnotný document intelligence systém pro finanční poradce**, který:

- čte smlouvy,
- čte scan smlouvy,
- rozlišuje modelaci od finální smlouvy,
- rozpozná platební instrukce,
- vytěží údaje do CRM,
- vytváří platební údaje do klientského portálu,
- podporuje review,
- učí se z oprav,
- a v čase se zlepšuje.

Tohle je správný základ pro spolehlivou AI asistentku v Aidvisoře.
