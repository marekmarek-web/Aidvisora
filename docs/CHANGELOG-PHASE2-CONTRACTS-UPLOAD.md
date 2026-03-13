# Changelog: Fáze 2 – Upload smluv, structured extraction, CRM draft actions

## Změněné / nové soubory

- **packages/db/src/schema/contract-upload-reviews.ts** – Nová tabulka `contract_upload_reviews`: metadata uploadu, `processingStatus` (uploaded | processing | extracted | review_required | failed), `reviewStatus` (pending | approved | rejected | applied), extractedPayload, clientMatchCandidates, draftActions, confidence, reasonsForReview.
- **packages/db/src/schema/index.ts** – Export `contract-upload-reviews`.
- **apps/web/src/lib/ai/extraction-schemas.ts** – Rozšíření o plné Zod schéma smlouvy (documentType, contractNumber, institutionName, productName, client, paymentDetails, effectiveDate, expirationDate, notes, missingFields, confidence, needsHumanReview) a `validateContractExtraction()`.
- **apps/web/src/lib/openai.ts** – Nová funkce `createResponseWithFile(fileUrl, textPrompt, options?)` pro Responses API s `input_file` + `input_text`.
- **apps/web/src/lib/ai/contract-extraction.ts** – Nový modul: `extractContractFromFile(fileUrl)` volá OpenAI, validuje výstup přes Zod, vrací řízený error objekt.
- **apps/web/src/lib/ai/upload-pipeline.ts** – Typ `ContractFileInput` (file_id | url | base64), TODO pro normalizaci DOC/DOCX/JPG/PNG na PDF.
- **apps/web/src/lib/ai/draft-actions.ts** – `findClientCandidates`, `buildCreateClientDraft`, `buildCreateContractDraft`, `buildCreatePaymentDraft`, `buildCreateTaskDraft`, `buildDraftEmailSuggestion`, `buildAllDraftActions` (žádný zápis do DB).
- **apps/web/src/lib/ai/review-queue.ts** – Rozšíření `DraftActionType` o `create_contract`.
- **apps/web/src/lib/ai/review-queue-repository.ts** – Persistence: `createContractReview`, `getContractReviewById`, `listContractReviews`, `updateContractReview`.
- **apps/web/src/app/api/contracts/upload/route.ts** – POST upload: validace PDF a velikosti, uložení do Supabase Storage (`documents` bucket, path `contracts/{tenantId}/{id}/...`), záznam do `contract_upload_reviews`, volání `extractContractFromFile(signedUrl)`, sestavení draft actions a kandidátů, update stavu (review_required / extracted / failed). Logování bez API klíče a bez celého dokumentu, maskování citlivých hodnot.
- **apps/web/src/app/api/contracts/review/[id]/route.ts** – GET detail zpracované smlouvy a review payloadu pro budoucí UI.

## Hotovo

- Contract upload API: POST `/api/contracts/upload` s multipart PDF, validace MIME a velikost (20 MB), uložení do storage a metadata do DB, processing status včetně `uploaded | processing | extracted | review_required | failed`.
- Contract Zod schema a TS typy podle specifikace (včetně client, paymentDetails, confidence, needsHumanReview).
- Structured extraction service: `extractContractFromFile(fileUrl)` přes Responses API s `input_file` (file_url), validace výstupu přes Zod, při chybě vrácení řízeného error objektu.
- File handling: rozhraní pro file_id / url / base64, primárně PDF; TODO pro normalizaci DOC/DOCX/JPG/PNG na PDF.
- CRM draft actions: všechny builder funkce vracejí draft payloady, nic se nezapisuje do produkčních tabulek; `findClientCandidates` zatím vrací prázdné pole (připraveno na doplnění dotazu do contacts).
- Review queue persistence: tabulka + repository (create, getById, list, updateStatus).
- GET `/api/contracts/review/[id]` pro načtení detailu a review payloadu.
- Logování: endpoint, latence, success/failure; API key a celé dokumenty se nelogují; citlivé hodnoty v logu maskovány.

## Co ještě chybí do plně funkčního upload → extract → review flow

- **DB migrace**: Tabulka `contract_upload_reviews` musí být v DB. Z kořene repo spusť `pnpm db:generate` (vygeneruje migraci z Drizzle schématu) a `pnpm db:migrate`, nebo pro vývoj `pnpm db:push`.
- **Storage**: Bucket `documents` v Supabase musí existovat (již používán pro dokumenty). Cesta `contracts/{tenantId}/{id}/...` je v rámci téhož bucketu.
- **Review queue UI**: Obrazovka pro seznam položek ve frontě a detail s draft actions (tlačítka „Vytvořit klienta“, „Vytvořit smlouvu“, atd.) a aplikací akcí zatím není – data flow a API jsou připravené.
- **findClientCandidates**: Implementace vyhledání kontaktů podle jména/emailu/IČO a přiřazení skóre (např. fulltext nebo podobnost); nyní vrací prázdné pole.
- **Aplikace draft akcí**: Endpoint nebo akce „Apply“ pro approved položku (vytvoření klienta/smlouvy/platby/úkolu z draft payloadu) – zatím jen uložení stavu `applied`, bez skutečného zápisu do CRM (lze doplnit v další fázi).

## DB migrace a storage konfigurace

- **Migrace**: Je potřeba vytvořit a spustit migraci pro tabulku `contract_upload_reviews`. V projektu se používá Drizzle – po přidání schématu spusťte z kořene `pnpm db:generate` a poté `pnpm db:migrate` (nebo `pnpm db:push` pro přímé nasazení schématu bez migračního souboru).
- **Storage**: Žádná nová konfigurace – používá se stávající Supabase Storage bucket `documents`. Pro upload smluv se ukládá pod prefix `contracts/{tenantId}/{id}/`.
