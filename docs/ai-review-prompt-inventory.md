# AI Review — inventář promptů vs. `ai uceni`

Generováno jako součást auditu. **Prompt Builder** musí používat přesně ty názvy proměnných, které očekává kód ([`ai-review-prompt-variables.ts`](../apps/web/src/lib/ai/ai-review-prompt-variables.ts)).

**Rollout (sekční šablony, env, smoke):** viz [ai-review-prompt-rollout.md](./ai-review-prompt-rollout.md).

## Kontrakty proměnných (shrnutí)

| Skupina | Povinné klíče (Prompt Builder → API) | Poznámka |
|--------|--------------------------------------|----------|
| Extrakce (většina `*Extraction`) | `extracted_text`, `classification_reasons`, `adobe_signals`, `filename` | Kód duplicitně posílá `extractedText`, `classificationReasons`, `adobeSignals` a často `document_text` = `extracted_text`. |
| Klasifikátor `docClassifierV2` | `filename`, `page_count`, `input_mode`, `text_excerpt`, `adobe_signals`, `source_channel` | Jiná sada než extrakce. |
| `reviewDecision` | `normalized_document_type`, `extraction_payload`, `validation_warnings`, `section_confidence`, `input_mode`, `preprocess_warnings` | Volitelně i `section_confidence_summary` (dual-send v kódu). |
| `clientMatch` | `extracted_client_payload`, `existing_client_candidates` | |

## Tabulka: `AiReviewPromptKey` → env → soubor v `ai uceni`

| Prompt key | Env proměnná (ID) | Soubor spec v `ai uceni/` | Stav |
|------------|-------------------|---------------------------|------|
| `docClassifierV2` | `OPENAI_PROMPT_AI_REVIEW_DOC_CLASSIFIER_ID` | `ai-review-doc-classifier-v1.txt` | OK |
| `insuranceContractExtraction` | `OPENAI_PROMPT_AI_REVIEW_INSURANCE_CONTRACT_EXTRACTION_ID` | `ai-review-insurance-contract-extraction-v1.txt` | OK |
| `insuranceProposalModelation` | `OPENAI_PROMPT_AI_REVIEW_INSURANCE_PROPOSAL_MODELATION_ID` | `ai-review-insurance-proposal-modelation-v1.txt` | OK |
| `insuranceAmendment` | `OPENAI_PROMPT_AI_REVIEW_INSURANCE_AMENDMENT_ID` | `ai-review-insurance-amendment-v1.txt` | OK |
| `nonLifeInsuranceExtraction` | `OPENAI_PROMPT_AI_REVIEW_NON_LIFE_INSURANCE_EXTRACTION_ID` | `ai-review-non-life-insurance-extraction-v1.txt` | OK |
| `carInsuranceExtraction` | `OPENAI_PROMPT_AI_REVIEW_CAR_INSURANCE_EXTRACTION_ID` | `ai-review-car-insurance-extraction-v1.txt` | OK |
| `investmentContractExtraction` | `OPENAI_PROMPT_AI_REVIEW_INVESTMENT_CONTRACT_EXTRACTION_ID` | `ai-review-investment-contract-extraction-v1.txt` | OK |
| `investmentProposal` | `OPENAI_PROMPT_AI_REVIEW_INVESTMENT_PROPOSAL_ID` | `ai-review-investment-proposal-v1.txt` (zástupný spec) | Zástupný — doplnit obsah promptu z Prompt Builderu |
| `retirementProductExtraction` | `OPENAI_PROMPT_AI_REVIEW_RETIREMENT_PRODUCT_EXTRACTION_ID` | `ai-review-retirement-product-extraction-v1.txt` | OK |
| `dipExtraction` | `OPENAI_PROMPT_AI_REVIEW_DIP_EXTRACTION_ID` | `ai-review-dip-extraction-v1.txt` | OK |
| `buildingSavingsExtraction` | `OPENAI_PROMPT_AI_REVIEW_BUILDING_SAVINGS_EXTRACTION_ID` | `ai-review-building-savings-extraction-v1.txt` | OK |
| `loanContractExtraction` | `OPENAI_PROMPT_AI_REVIEW_LOAN_CONTRACT_EXTRACTION_ID` | `ai-review-loan-contract-extraction-v1.txt` | OK |
| `mortgageExtraction` | `OPENAI_PROMPT_AI_REVIEW_MORTGAGE_EXTRACTION_ID` | `ai-review-mortgage-extraction-v1.txt` (zástupný spec) | Future / zástupný |
| `paymentInstructionsExtraction` | `OPENAI_PROMPT_AI_REVIEW_PAYMENT_INSTRUCTIONS_EXTRACTION_ID` | `ai-review-payment-instructions-extraction-v1.txt` | OK |
| `supportingDocumentExtraction` | `OPENAI_PROMPT_AI_REVIEW_SUPPORTING_DOCUMENT_EXTRACTION_ID` | `ai-review-supporting-document-extraction-v1.txt` | OK |
| `legacyFinancialProductExtraction` | `OPENAI_PROMPT_AI_REVIEW_LEGACY_FINANCIAL_PRODUCT_EXTRACTION_ID` | `ai-review-legacy-financial-product-extraction-v1.txt` | OK |
| `terminationDocumentExtraction` | `OPENAI_PROMPT_AI_REVIEW_TERMINATION_DOCUMENT_ID` | `ai-review-termination-document-v1.txt` (zástupný spec) | Zástupný |
| `consentIdentificationExtraction` | `OPENAI_PROMPT_AI_REVIEW_CONSENT_IDENTIFICATION_ID` | `ai-review-consent-identification-v1.txt` (zástupný spec) | Zástupný |
| `confirmationDocumentExtraction` | `OPENAI_PROMPT_AI_REVIEW_CONFIRMATION_DOCUMENT_ID` | `ai-review-confirmation-document-v1.txt` (zástupný spec) | Zástupný |
| `reviewDecision` | `OPENAI_PROMPT_AI_REVIEW_REVIEW_DECISION_ID` | `ai-review-review-decision-v1.txt` | OK |
| `clientMatch` | `OPENAI_PROMPT_AI_REVIEW_CLIENT_MATCH_ID` | `ai-review-client-match-v1.txt` | OK |

## Soubory v `ai uceni/` mimo `AI_REVIEW_PROMPT_KEYS`

Tyto txt patří k jiným funkcím (copilot / portál), ne k tabulce výše:

- `team-summary-v1.txt`, `pre-meeting-briefing-v1.txt`, `post-meeting-followup-v1.txt`, `portal-payment-summary-v1.txt`, `next-best-action-v1.txt`, `client-summary-v1.txt`, `client-opportunities-v1.txt`
- `vercel-openai-prompts.env` — přehled ID pro nasazení

## Doporučení

1. Zástupné soubory `ai-review-*-v1.txt` u `investmentProposal`, `mortgageExtraction`, `termination*`, `consent*`, `confirmation*` doplň v Prompt Builderu a sem vlož export ID / stručný popis výstupu.
2. Po každé změně šablony v OpenAI zvýšit **verzi** promptu, pokud používáte `OPENAI_PROMPT_*_VERSION` (dnes u `docClassifierV2`, `reviewDecision`, `clientMatch`).
