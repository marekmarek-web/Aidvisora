# AI Review — Fáze 2 + 3 — Implementace (2026-04-04)

**Repo root:** `/Users/marekmarek/Developer/Aidvisora`  
**Datum:** 2026-04-04  
**Agent:** A (Fáze 2 + 3 — packet segmentation + canonical extraction schema)

---

## Co bylo implementováno

### Fáze 2 — Document Packet Segmentation

Nová logika: 1 upload != 1 dokument. Upload je **packet**, který může obsahovat více subdokumentů.

**Nové soubory:**
- `apps/web/src/lib/ai/document-packet-types.ts` — typy `PacketMeta`, `PacketSubdocumentCandidate`, `ParticipantRecord`, `InsuredRiskRecord`, `HealthQuestionnaireRecord`, `InvestmentDataRecord`, `PaymentDataRecord`, `PublishHints`, `PARTICIPANT_ROLES`, `PACKET_SUBDOCUMENT_TYPES`
- `apps/web/src/lib/ai/document-packet-segmentation.ts` — heuristická detekce bundle (keyword scan, heading detection, page count heuristics); `segmentDocumentPacket()` + `derivePublishHintsFromPacket()`

**Co detekuje:**
- `final_contract` — pojistná smlouva č. X, smlouva o úvěru
- `health_questionnaire` — zdravotní dotazník / prohlášení
- `aml_fatca_form` — AML formulář, FATCA, PEP
- `payment_instruction` — platební instrukce, FUNDOO, SIPA
- `modelation` — modelace, nezávazná kalkulace
- `contract_proposal` — návrh smlouvy
- `annex` — příloha, obchodní podmínky
- `service_document` — žádost o změnu, žádost o odkup

**Integrační bod:** `run-contract-review-processing.ts` — `segmentDocumentPacket()` se volá po preprocessing a před extraction. Výsledek:
- `packetMeta` → přiřazen do `data.packetMeta`
- Bundle warning → `reviewWarnings` (kód `multi_section_bundle_detected`)
- `contentFlags.containsMultipleDocumentSections = true` při bundle
- `packetMeta` (zkrácená verze) → `extractionTrace.packetMeta`

### Fáze 3 — Canonical Extraction Schema

**Nové soubory:**
- `apps/web/src/lib/ai/life-insurance-canonical-normalizer.ts` — `normalizeLifeInsuranceCanonical()` + `applyCanonicalNormalizationToEnvelope()`

**Nová pole na `DocumentReviewEnvelope` (vše optional, additive):**
```typescript
packetMeta?: PacketMeta | null
participants?: ParticipantRecord[] | null
insuredRisks?: InsuredRiskRecord[] | null
healthQuestionnaires?: HealthQuestionnaireRecord[] | null
investmentData?: InvestmentDataRecord | null
paymentData?: PaymentDataRecord | null
publishHints?: PublishHints | null
```

**Normalizer:**
- `participants[]` — z flat extractedFields (fullName, birthDate...) + parties record + insuredPersons JSON array
- `insuredRisks[]` — z coverages/riders/insuredRisks JSON arrays + flat fallback (deathBenefit, accidentBenefit...)
- `healthQuestionnaires[]` — z packetMeta.subdocumentCandidates + sectionSensitivity
- `investmentData` — investmentStrategy, investmentFunds JSON array, investmentPremium
- `paymentData` — bankAccount, iban, variableSymbol, paymentFrequency
- `publishHints` — odvozeno z lifecycle + packetMeta + sensitivityProfile

**Integrační bod:** `run-contract-review-processing.ts` — `applyCanonicalNormalizationToEnvelope(data, packetMeta)` se volá hned po extraction.

---

## Změněné soubory

| Soubor | Změna |
|--------|-------|
| `apps/web/src/lib/ai/document-review-types.ts` | Přidány optional canonical fields na `DocumentReviewEnvelope` type (additive intersection) + import typů z `document-packet-types.ts` |
| `apps/web/src/lib/ai/document-schema-registry.ts` | Enhanced extraction rules pro `life_insurance_contract` a `life_insurance_investment_contract`: multi-person parties, structured coverages, investmentFunds JSON, bundle detection rules |
| `apps/web/src/lib/ai/combined-extraction.ts` | Enhanced prompt: MULTI-PERSON, MULTI-RISK, INVESTICE, PLATBY, BUNDLE, ZDRAVOTNÍ SEKCE instrukce |
| `apps/web/src/lib/contracts/run-contract-review-processing.ts` | Přidán Phase 2 packet segmentation + Phase 3 canonical normalization po extraction |
| `fixtures/golden-ai-review/scenarios.manifest.json` | Version 3 + phase2_acceptance + phase3_acceptance pro G03, G04, G05, G09 |

---

## Nové soubory

| Soubor | Účel |
|--------|------|
| `apps/web/src/lib/ai/document-packet-types.ts` | Typy pro packet layer + Phase 3 canonical typy |
| `apps/web/src/lib/ai/document-packet-segmentation.ts` | Heuristická detekce bundle PDFs |
| `apps/web/src/lib/ai/life-insurance-canonical-normalizer.ts` | Canonical normalizer: flat → structured |
| `docs/ai-review-phase-2-3-implementation.md` | Tento dokument |

---

## Auditnuté, ale neměněné soubory

- `ai-review-pipeline-v2.ts` — žádná změna; packet layer je transparentní
- `apply-contract-review.ts` — žádná změna; `publishHints` je doporučení, ne blocker
- `contract-understanding-pipeline.ts` — žádná změna
- `ai-review-extraction-router.ts` — žádná změna
- `review-queue-repository.ts` — žádná změna; nová pole jdou do `extracted_payload` JSONB (schéma nezměněno)
- Veškerý assistant/chat kód — neměněn

---

## Co zůstává mimo scope

- Page-level PDF splitter (fyzické rozdělení PDF na stránky) — bezpečná první iterace je metadata-only
- LLM-powered packet segmentation (drahé; heuristika postačí pro první vlnu)
- Per-subdocument extraction (každá sekce zvlášť přes AI) — architekturu lze rozšířit
- Změny v publish/apply flow kvůli `publishHints` — `publishHints.contractPublishable` je doporučení, downstream `apply-contract-review.ts` ho zatím nečte
- Assistant chat route, reviewId v chatu, selectable actions
- Claude provider migration, UI polish, ratingy

---

## Kompatibilita / rizika

| Oblast | Stav |
|--------|------|
| `DocumentReviewEnvelope` downstream čtení | Bezpečné — nová pole jsou optional; existující kód je nemusí číst |
| DB `contract_upload_reviews.extracted_payload` | Nová pole jdou do JSONB → žádná migrace nutná |
| `apply-contract-review.ts` | Neměněn; přečte nová pole až v příští fázi |
| `mappers.ts` / corrections flow | Neměněn |
| `buildAllDraftActions()` | Neměněn |
| Combined extraction prompt | Instrukce jsou additive — starší dokumenty prostě nevyplní nová pole |
| Linter | Čistý (ověřeno ReadLints) |

**Rizika:**
1. `insuredPersons` / `coverages` jako JSON string v `extractedFields.value` — závisí na tom, zda model vrátí validní JSON string. Normalizer gracefully fallback na flat fields pokud parse selže.
2. Packet segmentation může generovat false-positive `containsMultipleDocumentSections` na velmi dlouhých jednodokumentových smlouvách s více sekcemi. Threshold confidence >= 0.3 je konzervativní.

---

## Regression / ověření

### Ověřeno (kódem a architekturou):

| Scénář | Ověření |
|--------|---------|
| Modelace-only PDF | `segmentDocumentPacket` → `modelation` candidate, `isBundle = false` |
| Finální smlouva-only | `final_contract` candidate, `isBundle = false`, `publishHints.contractPublishable = true` |
| Bundle smlouva + dotazníky (G03/C027) | `isBundle = true`, `hasSensitiveAttachment = true`, `needsSplit = true` |
| Multi-person life insurance (G04/C008) | `participants[]` >= 2, roles `policyholder` + `insured` |
| Investment strategy (G05/C004) | `investmentData` ≠ null |
| Payment data (G05, G01) | `paymentData` ≠ null, variableSymbol |
| AML/FATCA dokument (G09/C023) | `aml_fatca_form` candidate, `publishHints.sensitiveAttachmentOnly = true` |
| Nepublikovatelný dokument | `publishHints.contractPublishable = false` |

### Ještě neověřeno (runtime):

- Fyzické PDF soubory z `Test AI/` přes live pipeline (vyžaduje Vercel / local server)
- Model output consistency pro insuredPersons/coverages jako JSON string
- Edge case: 2 smlouvy v jednom PDF (fyzická hranice mimo keyword heuristiku)

---

## Doporučená další fáze

**Po Agentovi A navazuje integrační fáze (Fáze 5 nebo Agent B):**

1. **apply-contract-review.ts** — přečíst `publishHints` a blokovat apply pokud `contractPublishable = false`
2. **Review UI** — zobrazit `participants[]`, `insuredRisks[]`, `packetMeta.subdocumentCandidates` ve review panelu
3. **Per-subdocument extraction** — po splitteru spustit extraction per sekci s dedikovaným promptem
4. **LLM packet classifier** — nahradit/doplnit heuristiku LLM-based segmentation pro edge cases
5. **Golden dataset harness** — vitest runner přes manifest scenarios.manifest.json

---

## SQL migrace

Žádné SQL migrace nejsou potřeba.

Nová pole (`participants`, `insuredRisks`, atd.) jsou uložena do existujícího JSONB sloupce `extracted_payload` v tabulce `contract_upload_reviews`. DB schéma se nemění.
