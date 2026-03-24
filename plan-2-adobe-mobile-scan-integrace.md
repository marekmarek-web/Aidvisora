# Plán 2 – Adobe preprocessing + mobile scan capture + napojení na extraction pipeline

## Účel dokumentu
Tento plán navazuje na Plán 1 (extraction / klasifikace / review / CRM draft flow) a řeší druhou vrstvu architektury:

1. jak bezpečně a spolehlivě předzpracovat všechny nahrané dokumenty přes Adobe API,
2. jak napojit skeny a focené dokumenty z iOS / Android aplikace,
3. jak sjednotit textová PDF, scan PDF, fotky dokumentů a vícestránkové dávky do jedné extraction pipeline,
4. jak připravit data tak, aby finální AI extraction vrstva měla co nejvyšší úspěšnost,
5. jak z platebních pokynů vytvářet platební údaje do klientského portálu.

---

## 1. Hlavní cíl
Systém musí umět rozumně zpracovat vše, co poradce nahraje nebo nafotí, pokud dokument dává smysl a je v použitelné kvalitě.

To znamená, že pipeline nesmí být postavená jen na textových PDF, ale musí podporovat:

- textové PDF,
- naskenované PDF bez textové vrstvy,
- fotky dokumentů pořízené mobilem,
- vícestránkové dokumenty vzniklé focením po stránkách,
- smíšené dokumenty (část text, část scan),
- více různých typů dokumentů v rámci jednoho upload flow.

Adobe vrstva zde není náhrada AI extraction, ale povinný preprocessing a normalizační mezikrok.

---

## 2. Co tento plán navazuje z Plánu 1
Plán 1 už předpokládá tyto funkční bloky:

- upload dokumentů,
- klasifikace typu dokumentu,
- extraction schema podle typu dokumentu,
- scan fallback,
- validation a confidence,
- review queue,
- draft akce do CRM,
- platební údaje do klientského portálu.

Plán 2 řeší, jak dostat vstupní dokumenty do takového stavu, aby tyto bloky fungovaly spolehlivě i na reálných dokumentech z praxe.

---

## 3. Vstupní kanály dokumentů

### 3.1 Web upload
- PDF upload z desktopu
- drag & drop
- vícenásobný upload
- upload dávky souborů najednou

### 3.2 Mobile app upload
- výběr existujícího PDF nebo obrázku ze zařízení
- přímé focení dokumentu z aplikace
- vícestránkové snímání (strana 1, 2, 3...)
- retake konkrétní stránky
- ořez a korekce perspektivy
- auto-detekce okrajů dokumentu
- převod nafocených stránek do jednoho PDF balíčku

### 3.3 E-mail / přílohy (budoucí rozšíření)
- ingest příloh z e-mailu
- automatické vytvoření review položky
- klasifikace a extraction stejně jako u ručního uploadu

---

## 4. Cílová architektura dokumentové pipeline

### Fáze A – Capture / Ingest
Přijmout soubor nebo scan z webu či mobilu a uložit:
- originál,
- metadata,
- source channel,
- tenant,
- uploader,
- timestamp,
- file hash.

### Fáze B – Adobe preprocessing
Použít Adobe API pro:
- normalizaci PDF,
- OCR,
- extrakci textu,
- rozpoznání struktury stránek,
- sjednocení dokumentů na standardní interní reprezentaci.

### Fáze C – Input mode detection
Rozhodnout, zda je dokument:
- text_pdf,
- scanned_pdf,
- image_document,
- mixed_document,
- unsupported_document.

### Fáze D – Document classification
Určit, o jaký typ dokumentu jde.

### Fáze E – Structured extraction
Vybrat správné schema a vytěžit data.

### Fáze F – Validation + review decision
Zvalidovat hodnoty, doplnit confidence, warnings a rozhodnout:
- extracted,
- review_required,
- failed.

### Fáze G – Business actions
Podle typu dokumentu vytvořit:
- klienta nebo match kandidáty,
- smlouvu,
- změnu smlouvy,
- platební údaje,
- úkol,
- draft emailu,
- notifikaci,
- položku do klientského portálu.

---

## 5. Role Adobe v pipeline
Adobe musí fungovat jako spolehlivá preprocessing vrstva mezi uploadem a AI extraction.

### Adobe má řešit zejména
- OCR na naskenovaných PDF,
- převod obrázků do PDF,
- standardizaci orientace stránek,
- zlepšení čitelnosti dokumentů,
- extrakci textové vrstvy,
- zachycení strukturálních prvků dokumentu,
- sloučení vícestránkových mobilních scanů do jednoho PDF,
- případné rozdělení nekvalitních nebo poškozených vstupů do review.

### Adobe nesmí být jediný zdroj „pravdy“
Adobe má dodat:
- preprocessovaný PDF dokument,
- textovou vrstvu,
- případně strukturální výstup,
- technická metadata.

GPT mini nebo následná extraction vrstva pak řeší:
- porozumění dokumentu,
- klasifikaci,
- výběr správného schema,
- extrakci polí,
- business interpretaci,
- confidence a review flags.

---

## 6. Standardizovaný interní dokumentový formát
Po Adobe preprocessingu musí každý dokument dostat jednotnou interní reprezentaci.

### Povinná pole
- documentId
- tenantId
- sourceChannel (web_upload, mobile_camera, mobile_files, email_attachment...)
- originalFilePath
- normalizedPdfPath
- adobeJobId
- adobeProcessingStatus
- pageCount
- inputMode
- preprocessingWarnings[]
- extractedPlainText
- pageTextMap[]
- pageImageRefs[]
- documentFingerprint
- createdAt
- processedAt

### Cíl
Všechny další kroky už nesmí řešit, jestli dokument přišel jako scan, fotka nebo textové PDF. Musí pracovat nad sjednocenou reprezentací.

---

## 7. Mobilní skenování v iOS / Android appce

### 7.1 Funkční požadavky
Mobilní aplikace musí umět:
- otevřít fotoaparát,
- detekovat papír / dokument,
- nabídnout automatický ořez,
- srovnat perspektivu,
- zlepšit kontrast,
- ukládat více stránek po sobě,
- přeskupit stránky,
- retake vybrané stránky,
- exportovat výsledek do interního PDF,
- nahrát PDF na backend,
- zobrazit průběh uploadu a zpracování.

### 7.2 UX flow v mobilu
1. Poradce otevře AI asistenta.
2. Zvolí „Naskenovat dokument“.
3. Nafotí jednu nebo více stránek.
4. Upraví ořez, otočení, kontrast.
5. Potvrdí kompletaci dokumentu.
6. Aplikace vytvoří PDF balíček.
7. PDF odešle do stejné upload pipeline jako web.
8. Backend pošle dokument do Adobe preprocessingu.
9. Po zpracování se dokument objeví v AI draweru/review queue.

### 7.3 Důležité produktové pravidlo
Mobilní scan nesmí být vedlejší nebo „druhá kvalita“ pipeline.
Musí vstupovat do stejného backend flow jako web upload.

---

## 8. Input mode detection po Adobe preprocessingu
Po předzpracování musí backend vyhodnotit, jak kvalitní vstup dostal.

### Typy vstupu
- text_pdf
- scanned_pdf
- mixed_pdf
- image_document
- unreadable_or_low_quality

### Rozhodovací signály
- množství extrahovaného textu,
- poměr textu vůči počtu stran,
- přítomnost OCR vrstvy,
- kvalita OCR,
- chybovost / noise,
- orientace / rotace,
- přítomnost pouze obrázkových stran.

### Výstup
- inputMode
- inputReadabilityScore
- requiresScanFallback
- preprocessingWarnings[]

---

## 9. Povinné rozlišení typů dokumentů
Systém musí povinně rozlišit minimálně tyto kategorie:

### 9.1 Finální smlouvy
- pojistná smlouva – rizikové životní pojištění
- pojistná smlouva – investiční životní pojištění
- úvěrová smlouva
- investiční smlouva / pokyn / produktový kontrakt

### 9.2 Předsmluvní nebo nezávazné dokumenty
- modelace
- detailní nabídka
- ilustrace
- produktový list
- návrh smlouvy
- kalkulace

### 9.3 Změnové a servisní dokumenty
- změna pojistné smlouvy
- dodatek
- změna osoby / obmyšleného / krytí / parametrů
- servisní žádost

### 9.4 Platební dokumenty
- platební instrukce
- pokyn k investici
- předpis plateb
- přehled pravidelných plateb
- informace o účtech a symbolech

### 9.5 Podklady pro bonitu a analýzu
- potvrzení o příjmu
- výplatní páska
- daňové přiznání
- bankovní výpis
- přehled pohybů na účtu

### 9.6 Ostatní / nepodporované
- všeobecné podmínky
- čistě marketingové materiály
- interní poznámky
- poškozené dokumenty
- nečitelný obsah

---

## 10. Rozhodovací logika: co s dokumentem po klasifikaci

### 10.1 Finální smlouva
Cíl:
- extrakce klienta,
- extrakce smlouvy,
- extrakce platebních údajů,
- draft zápisu do CRM,
- review / schválení / aplikace.

### 10.2 Návrh / modelace / nabídka
Cíl:
- nepropsat jako aktivní smlouvu,
- uložit jako nezávazný dokument,
- vytěžit orientační parametry,
- navázat ke klientovi jako návrh,
- volitelně vytvořit follow-up úkol.

### 10.3 Změnový dokument
Cíl:
- najít existující smlouvu,
- určit rozsah změny,
- připravit návrh změny,
- review potvrzení před aplikací.

### 10.4 Platební dokument
Cíl:
- vytěžit bankovní spojení,
- vytěžit IBAN,
- vytěžit variabilní/specifický/konstantní symbol,
- částku,
- měnu,
- frekvenci,
- splatnost,
- účel platby,
- název instituce,
- název produktu,
- vazbu ke klientovi / smlouvě,
- zapsat platební údaje do klientského portálu.

### 10.5 Příjmový / bankovní dokument
Cíl:
- nevytvářet smlouvu,
- vytěžit příjmové / bonitní údaje,
- použít v analytických a úvěrových flows,
- případně použít pro interní finanční analýzu.

---

## 11. Platební pokyny → klientský portál
Toto je kritická business větev.

### 11.1 Co se musí extrahovat
- typ platebního dokumentu,
- název instituce / správce / pojišťovny / platformy,
- název produktu,
- číslo smlouvy / pokynu / investice,
- příjemce platby,
- bankovní účet,
- IBAN,
- BIC/SWIFT, pokud existuje,
- variabilní symbol,
- specifický symbol,
- konstantní symbol,
- měna,
- částka,
- minimální částka,
- frekvence (měsíčně / čtvrtletně / ročně / jednorázově),
- datum první platby,
- splatnost / den v měsíci,
- účel platby,
- pravidelná vs. jednorázová platba,
- podmínky správného zaslání platby,
- odkazy na více měnových variant (CZK / EUR / USD), pokud existují.

### 11.2 Co musí vzniknout v klientském portálu
Každá validní platební instrukce musí být schopná vytvořit „platební kartu“ klienta:
- co klient platí,
- komu platí,
- kam platí,
- jak často platí,
- kolik platí,
- jaký symbol použít,
- zda jde o pravidelnou či jednorázovou platbu,
- zda jsou k dispozici alternativní měnové účty,
- vazba na konkrétní smlouvu / investici.

### 11.3 Povinná validace
Do portálu se nesmí propsat platební údaje bez:
- rozpoznaného příjemce,
- rozpoznaného účtu nebo IBAN,
- měny,
- alespoň jednoho identifikátoru vazby (VS / smlouva / produkt / klient),
- přiměřené confidence.

---

## 12. Adobe + AI orchestrace

### 12.1 Doporučené pořadí volání
1. Upload / mobile capture
2. Uložení originálu
3. Adobe preprocess job
4. Uložení normalizovaného PDF + OCR textu
5. Input mode detection
6. Klasifikace dokumentu
7. Výběr extraction schema
8. GPT mini structured extraction
9. Validation
10. Review / business actions

### 12.2 Zakázaný přístup
Neposílat syrově každý dokument rovnou do extraction promptu bez:
- Adobe preprocessingu,
- klasifikace,
- detekce scan-like dokumentu,
- volby správného schema.

---

## 13. GPT mini role v této architektuře
GPT mini má být použit jako rozumová vrstva nad kvalitně připraveným vstupem.

### GPT mini má řešit
- klasifikaci typu dokumentu,
- interpretaci textu a struktur,
- výběr schema,
- extrakci business polí,
- vysvětlení confidence / warnings,
- navrhování další akce.

### GPT mini nemá sám suplovat
- surové OCR,
- zpracování nekvalitních scanů bez předzpracování,
- image normalization,
- file conversion,
- low-level PDF opravy.

---

## 14. Návrh stavů zpracování
Každý dokument musí mít životní cyklus.

### Technické stavy
- uploaded
- preprocessing_pending
- preprocessing_running
- preprocessing_failed
- normalized
- classified
- extraction_running
- extracted
- review_required
- failed

### Business stavy
- pending_review
- approved
- rejected
- applied_to_crm
- applied_to_client_portal
- archived

---

## 15. UI / UX dopady do aplikace

### 15.1 AI drawer
Musí umět:
- nahrát PDF,
- otevřít fotoaparát v mobilu,
- ukázat „scan detected / OCR processing“,
- po zpracování nabídnout další kroky,
- rozlišit smlouvu vs. modelaci vs. platební dokument.

### 15.2 Review workspace
Musí ukazovat:
- input mode,
- extraction mode,
- dokumentový typ,
- confidence,
- warnings,
- Adobe preprocessing status,
- zda šlo o scan,
- co bude vytvořeno v CRM / portálu.

### 15.3 Klientský portál
Musí přijímat výstup z platebních dokumentů jako samostatnou sadu platebních instrukcí.

---

## 16. Co musí umět AI hledat a extrahovat napříč dokumenty

### Identifikace osob
- pojistník
- pojištěný
- klient
- spoludlužník
- oprávněná osoba
- zprostředkovatel
- zaměstnanec / poradce
- plátce

### Identifikátory
- číslo smlouvy
- číslo obchodního případu
- číslo varianty
- číslo nabídky
- číslo modelace
- číslo úvěru
- číslo pokynu
- VS / SS / KS
- rodné číslo
- IČO
- interní čísla instituce

### Produktové údaje
- název produktu
- typ produktu
- instituce
- pojistitel / banka / investiční platforma
- typ smluvního vztahu
- stav dokumentu (návrh / finální / změna)

### Finanční údaje
- pojistné
- splátka úvěru
- investice
- jednorázová investice
- pravidelná investice
- měna
- účet
- IBAN
- sazba / úrok / RPSN
- termíny plateb
- frekvence

### Časové údaje
- datum podpisu
- datum vzniku
- počátek pojištění
- konec pojištění
- první splátka
- poslední splátka
- splatnost
- datum platnosti nabídky

### Specifické segmenty
- připojištění
- rizika
- pojistné částky
- čekací doby
- podmínky investic
- úvěrové parametry
- bonitní údaje
- příjmy / obrat / výpisy

---

## 17. Mobile-first scan standard
Aby mobilní scan fungoval spolehlivě, musí být součástí produktu i kvalitativní pravidla.

### Při snímání uživatele vést
- foťte celý dokument,
- nefoťte v šeru,
- nefoťte rozmazaně,
- každý list zvlášť,
- nezakrývejte rohy,
- potvrďte čitelnost před odesláním.

### Automatické kontroly
- rozmazání,
- příliš tmavé / světlé foto,
- oříznutí mimo stránku,
- otočení,
- malá čitelnost textu.

### Reakce systému
- nabídnout „vyfotit znovu“,
- nečekat až na finální extraction fail,
- upozornit už při capture kroku.

---

## 18. Error handling a fallbacky

### Dokument není čitelný
- označit jako unreadable_or_low_quality
- nabídnout retake / nový upload
- neschovávat to pod generické „failed"

### Adobe fail
- vrátit preprocess_failed
- nabídnout retry job
- zachovat originál souboru

### Classification nejednoznačná
- poslat do review,
- nebrat to jako extraction hard fail,
- zobrazit top kandidátní typy.

### Extraction validace selže
- uložit raw classification,
- uložit selected schema,
- uložit validation issues,
- dát dokument do review.

---

## 19. Bezpečnost a audit
- tenant isolation,
- audit kdo dokument nahrál,
- audit kdo schválil review,
- audit kdo aplikoval výstup do CRM/portálu,
- nelogovat celé citlivé dokumenty do plain logu,
- logovat pouze technická metadata a maskované preview,
- zřetelně oddělit staging a production dokumenty.

---

## 20. Metriky úspěšnosti
Musí se měřit zvlášť pro textové dokumenty a scan dokumenty.

### Povinné metriky
- successful preprocessing rate,
- OCR success rate,
- classification accuracy,
- extraction accuracy per document type,
- payment instruction extraction accuracy,
- review rate,
- false create-contract rate,
- false payment-data creation rate,
- average time upload → extracted,
- average time scan → extracted,
- manual correction rate.

---

## 21. Fázování implementace

### Fáze 2A – Adobe preprocessing foundation
- Adobe API integration
- upload → preprocess job
- normalizované PDF
- OCR text
- preprocessing status v DB

### Fáze 2B – Unified input model
- interní document object
- input mode detection
- extraction mode metadata
- warnings

### Fáze 2C – Mobile scan capture
- iOS/Android capture flow
- multi-page scan
- PDF generation
- upload do stejné pipeline

### Fáze 2D – Scan-aware classification + extraction
- scan fallback
- lepší heuristiky pro modelace / smlouvy / platební pokyny
- validace a review flags

### Fáze 2E – Payment instructions → client portal
- extraction schema pro platební instrukce
- persistence platebních údajů
- portal UI mapping

### Fáze 2F – Eval a zlepšování
- dataset text vs. scan
- correction loop
- scorecards podle typu dokumentu

---

## 22. Co musí být hotové, než se to pustí do ostrého provozu
1. Adobe preprocessing funguje spolehlivě pro textové PDF i scan PDF.
2. Mobilní scan vytvoří použitelné PDF.
3. Dokumenty se správně třídí alespoň na:
   - finální smlouva,
   - návrh/modelace,
   - platební dokument,
   - změnový dokument,
   - bonita / příjmový dokument.
4. Platební dokument umí vytvořit data pro klientský portál.
5. Scan dokument nekončí automaticky jako failed.
6. Review detail zobrazuje input mode, extraction mode a warnings.
7. Není možné propsat nevalidní platební údaje nebo špatný typ dokumentu do produkce bez kontroly.

---

## 23. Zadání pro navazující technickou specifikaci
Další dokument po tomto plánu má převést tuto architekturu do konkrétních implementačních bodů pro Cursor:
- endpointy,
- storage flow,
- DB modely,
- Adobe service layer,
- mobile capture contracts,
- extraction orchestration service,
- status machine,
- review payload,
- payment portal mapping,
- telemetry a eval hooks.

---

## 24. Finální produktová věta
Cílový stav není „umět číst PDF“.
Cílový stav je:

- poradce nahraje nebo nafotí jakýkoli rozumně čitelný dokument,
- systém jej přes Adobe a AI správně předzpracuje, rozpozná a vytěží,
- rozliší smlouvu, modelaci, změnu, platební pokyny i bonitní podklad,
- a bezpečně z něj připraví CRM data, review kroky a platební údaje do klientského portálu.
