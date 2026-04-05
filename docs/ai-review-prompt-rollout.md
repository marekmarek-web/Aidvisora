# AI Review — Platform Prompt Builder rollout + env + smoke

Tento dokument doplňuje [ai-review-prompt-inventory.md](./ai-review-prompt-inventory.md) o **sekční (bundle-aware) fázi**: mapování lokální reference → `pmpt_*` v OpenAI → env na Vercelu → ověření po nasazení.

## A) Mapování: lokální šablona → env → proměnné → fallback

Zdroj textu šablon v repu: `apps/web/src/lib/ai/ai-review-prompt-templates-content.ts` (exporty `*_TEMPLATE`).

Programové mapování (env, export, rizika): `apps/web/src/lib/ai/ai-review-prompt-rollout.ts` → `getSectionAwareRolloutEntries()`.

| Prompt key | Export v `ai-review-prompt-templates-content.ts` | Env (ID promptu) | Povinné proměnné (API) | Volitelné sekční proměnné | Fallback |
|------------|---------------------------------------------------|------------------|-------------------------|---------------------------|----------|
| `insuranceContractExtraction` | `INSURANCE_CONTRACT_EXTRACTION_TEMPLATE` | `OPENAI_PROMPT_AI_REVIEW_INSURANCE_CONTRACT_EXTRACTION_ID` | `extracted_text`, `classification_reasons`, `adobe_signals`, `filename` | Sekční klíče jen pokud hlavní pipeline předá `bundleSectionTexts` (jinak v API vůbec nejsou — v šabloně je nedeklaruj jako povinné, nebo používej podmíněný text) | S ID + dost textu: Prompt Builder. Bez ID: `schema_text_wrap` nebo PDF (`ai-review-pipeline-v2`). |
| `investmentContractExtraction` | `INVESTMENT_CONTRACT_EXTRACTION_TEMPLATE` | `OPENAI_PROMPT_AI_REVIEW_INVESTMENT_CONTRACT_EXTRACTION_ID` | stejné | stejné | Stejná logika větve jako ostatní `*Extraction` podle routeru. |
| `dipExtraction` | `DIP_EXTRACTION_TEMPLATE` | `OPENAI_PROMPT_AI_REVIEW_DIP_EXTRACTION_ID` | stejné | stejné | Stejně. |
| `retirementProductExtraction` | `RETIREMENT_PRODUCT_EXTRACTION_TEMPLATE` | `OPENAI_PROMPT_AI_REVIEW_RETIREMENT_PRODUCT_EXTRACTION_ID` | stejné | stejné | Stejně. |
| `insuranceProposalModelation` | `INSURANCE_PROPOSAL_MODELATION_TEMPLATE` | `OPENAI_PROMPT_AI_REVIEW_INSURANCE_PROPOSAL_MODELATION_ID` | stejné | stejné | Stejně. |
| `healthSectionExtraction` | `HEALTH_SECTION_EXTRACTION_TEMPLATE` | `OPENAI_PROMPT_AI_REVIEW_HEALTH_SECTION_EXTRACTION_ID` | Minimálně stejné čtyři; sekční proměnné orchestrátor **nepřidává** | V šabloně nepovinné — primárně `{{extracted_text}}` = už zúžená health sekce | Bez ID: hardcoded prompt + structured output. |
| `investmentSectionExtraction` | `INVESTMENT_SECTION_EXTRACTION_TEMPLATE` | `OPENAI_PROMPT_AI_REVIEW_INVESTMENT_SECTION_EXTRACTION_ID` | Stejně jako health | Stejně | Bez ID: hardcoded + structured output. |

**Poznámka:** U health/investment section pass orchestrátor posílá do `extracted_text` už **zúžený** text sekce; sekční proměnné (`contractual_section_text`, …) tam mohou být prázdné / „(not available)“. Šablona v Prompt Builderu musí spoléhat na `extracted_text` jako primární vstup pro tyto dva klíče.

## B) Prompt Builder — checklist (krok za krokem)

1. Otevři OpenAI Platform → Prompts → vyber existující `pmpt_*` nebo vytvoř nový prompt ve stejné „rodině“ jako současná produkce.
2. Zkopíruj **system** (nebo hlavní instrukční blok) z příslušného exportu v `ai-review-prompt-templates-content.ts` (konstanta `systemPrompt`).
3. V editoru Prompt Builderu přidej **variables** se jmény přesně jako v kódu:
   - Povinné: `extracted_text`, `classification_reasons`, `adobe_signals`, `filename`.
   - Doporučené pro bundle: `contractual_section_text`, `health_section_text`, `investment_section_text`, `payment_section_text`, `attachment_section_text`, `bundle_section_context` (a případně camelCase zrcadla, pokud je šablona používá — kód je dual-senduje stejně jako u jiných polí).
4. Ověř, že v těle promptu jsou odkazy `{{extracted_text}}` a u hlavních extract šablon i sekční bloky podle reference.
5. **Publish** novou verzi promptu v OpenAI.
6. Zkopíruj nové **Prompt ID** (`pmpt_…`) do Vercelu / `.env`:
   - odpovídající `OPENAI_PROMPT_AI_REVIEW_*_ID` z tabulky výše.
7. Volitelné verzování: u klíčů s `versionEnvKey` v `prompt-model-registry.ts` nastav i `OPENAI_PROMPT_*_VERSION` (extrakční klíče většinou verzi nemají — neposílej globální verzi omylem ke špatnému `pmpt_`).
8. Redeploy aplikace (Next načte env při build/start).

## C) Env rollout — checklist

- [ ] Všechny ID z tabulky A, které chcete používat v produkci, jsou v **Vercel → Project → Environment Variables** (Production / Preview podle potřeby).
- [ ] Hodnoty začínají na `pmpt_` (ne mezery, ne uvozovky).
- [ ] Lokální vývoj: zkopíruj do `apps/web/.env.local` (soubor není v gitu). Šablona klíčů je v `apps/web/.env.example` (včetně `OPENAI_PROMPT_AI_REVIEW_HEALTH_SECTION_EXTRACTION_ID` a `…INVESTMENT_SECTION…`).
- [ ] Ověření načtení: po deployi spusť review na jednom dokumentu a v `extractionTrace` zkontroluj:
  - `aiReviewExtractionBuilder === "prompt_builder"` → běží Prompt Builder pro hlavní extrakci (když je ID + dost textu).
  - `aiReviewExtractionPmptFingerprint` → první znaky `pmpt_*` (pro porovnání s novou verzí).
- [ ] Orchestrátor bundle: v trace / `subdocOrchestration` warnings hledej řádky `pb_prompt:healthSectionExtraction:…` nebo `…local_structured_fallback`.

**Validace v repu (volitelná striktní CI):**

```bash
cd apps/web
AI_REVIEW_ENV_VALIDATE_STRICT=1 pnpm exec vitest run src/lib/ai/__tests__/ai-review-prompt-env-validator.test.ts
```

Nebo bez striktního režimu (vždy zelené, jen struktura):

```bash
pnpm exec vitest run src/lib/ai/__tests__/ai-review-prompt-rollout.test.ts src/lib/ai/__tests__/ai-review-prompt-env-validator.test.ts
```

## D) Smoke validace po rolloutu (manuální)

Pro každý scénář: nahraj dokument, počkej na dokončení review, otevři extrakci / trace (nebo log).

| # | Scénář | Co ověřit | Očekávání |
|---|--------|-----------|-----------|
| 1 | Bundle finální smlouva + zdravotní dotazník | `contractNumber` / pojistné nejsou „vycucané“ z health textu; `healthQuestionnaires` zaplněné | Contract core z smluvní části; health odděleně |
| 2 | Modelace + finální smlouva v jednom PDF | `lifecycleStatus`, `publishHints` | Modelace neoznačí finální active contract; publishHints nejsou uvolněné |
| 3 | IŽP s investiční složkou | `investmentData` / strategie | Strategie a fondy konzistentní s investiční sekcí |
| 4 | Čistý DIP | klasifikace + `productType` | DIP nepadá do čistého life bez důvodu |
| 5 | Čistý DPS | penzijní signály | DPS/PP rozlišení rozumné |
| 6 | AML/FATCA / attachment-only | `publishHints`, `sensitiveAttachmentOnly` | Nepublishovatelný contract; core nezAML |
| 7 | Vyndat jedno `OPENAI_PROMPT_*_ID` (staging) | pipeline | Fallback (`schema_text_wrap` / structured) neshodí processing |
| 8 | `extractionTrace` | `aiReviewExtractionBuilder`, fingerprint | Po nasazení nového `pmpt_` se fingerprint změní |

## E) Rizika a kompatibilita

- Šablona v Prompt Builderu **musí** obsahovat alespoň povinné čtyři proměnné; jinak Responses API vrátí chybu „Missing prompt variables“.
- Sekční proměnné jsou **nepovinné pro validátor** — když chybí v šabloně, OpenAI je nepožaduje; když jsou v šabloně deklarované, kód je vyplní (nebo `(not available)`).
- `publishHints` se mění jen heuristikami a merge vrstvami v kódu; samotná úprava promptu by neměla „uvolňovat“ gate — pokud ano, vrátit šablonu k pravidlům z reference souboru.

## F) Související soubory

| Soubor | Účel |
|--------|------|
| `apps/web/src/lib/ai/ai-review-prompt-templates-content.ts` | Texty ke kopírování do OpenAI |
| `apps/web/src/lib/ai/ai-review-prompt-rollout.ts` | Mapování + fingerprint |
| `apps/web/src/lib/ai/ai-review-prompt-env-validator.ts` | Kontrola env (7 klíčů + rozšířitelné) |
| `apps/web/src/lib/ai/prompt-model-registry.ts` | Všechny `AiReviewPromptKey` → env |
| `apps/web/src/lib/ai/ai-review-prompt-variables.ts` | Povinné + optional section vars |
| `apps/web/src/lib/ai/ai-review-pipeline-v2.ts` | Volba Prompt Builder vs text vs PDF + trace |

---

Žádné SQL migrace nejsou potřeba.
