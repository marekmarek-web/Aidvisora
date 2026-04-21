# Extraction schemas — source of truth (FL-2.5)

**Verze:** v1 · platnost od 2026-04-21 · maintainer: Marek
**Interní dokument.** Cíl: sjednotit, která schémata platí pro AI extrakci
dokumentů a v jakém pořadí v nich dělat změny.

## TL;DR

1. **Kanonický envelope: `DocumentReviewEnvelope`** v
   `apps/web/src/lib/ai/document-review-types.ts`. Všechny nové integrace AI
   Review pipeline (`ai-review-pipeline-v2`, `apply-contract-review`, UI
   extraction panels, golden fixtures) si schéma táhnou odsud.
2. **Pravidla per document type:** `document-schema-registry.ts` →
   `DocumentSchemaDefinition` + `buildSchemaPrompt()`.
3. **Router:** `document-schema-router.ts` mapuje
   `ContractDocumentType → DocumentSchemaDefinition`.
4. **Veřejné API:** `extraction-schemas-by-type.ts` — používá se všude:
   - `buildExtractionPrompt(type, …)` — prompt pro LLM
   - `validateExtractionByType(raw, type)` — validace / safeParse envelope
   - `wrapExtractionPromptWithDocumentText(…)` — druhý průchod z OCR textu

## Co NENÍ „source of truth"

Soubor `extraction-schemas.ts` je **legacy / compatibility shim**:

- `validateContactExtraction()` — CRM „chytré vložení kontaktů" z volného
  textu e-mailu, NEpoužívá envelope — je to standalone util pro flat
  kontakty. Nezaniká, ale nepatří do AI Review světa.
- `extractedContractSchema` + typ `ExtractedContractSchema` — flat view.
  Dnes už jen `lib/portfolio/from-document-extraction.ts` (mapování
  uloženého extract JSON → portfolio attributes). Nerozšiřujeme ho; nové
  integrace čtou envelope.

## Jak přidat nový typ dokumentu / pole

1. Upravit `DocumentReviewEnvelope` v `document-review-types.ts` jen tehdy,
   pokud jde o **nový cross-cutting typ pole**. Zde se musí zachovat
   backwards compat — přidávej jen `z.optional()`.
2. Pro **per-doctype fields** přidat rule do
   `document-schema-registry.ts` (sekce `contractSchemas` / `proposal` /
   ostatní typy).
3. Rozšířit `document-schema-router.ts`, pokud se přidává nový
   `ContractDocumentType`.
4. Přidat **golden fixture** do `apps/web/src/lib/ai/__tests__/fixtures`
   a registrovat v `golden-extraction-fixtures.test.ts`.
5. Pokud se pole propisuje do CRM → rozšířit mapper v
   `apps/web/src/lib/ai-review/mappers.ts`.
6. Pokud se pole propisuje do client portálu → rozšířit projekci v
   `apps/web/src/app/actions/client-proposal.ts` (nebo v appropriate
   klientské action).

## Anti-patterny (merge → reject)

- **Nové imports z `extraction-schemas.ts` v AI review pipeline.** Místo
  toho použij `extraction-schemas-by-type.ts`.
- **Nové volno-formové typy extrahovaných polí** bez zdroje v
  `documentReviewEnvelopeSchema`. UI by pak nedokázala zobrazit / validovat.
- **Paralelní Zod schema copy** pro jeden doctype (v AI classifieru vs.
  v mapperu vs. v UI). Vždy prochází přes envelope + registry.

## Test gate

Před release:

- `pnpm vitest --run apps/web/src/lib/ai/__tests__/golden-extraction-fixtures.test.ts`
- `pnpm vitest --run apps/web/src/lib/ai-review/__tests__/mappers`
- `pnpm vitest --run apps/web/src/lib/ai/__tests__/extraction-field-alias`

Pokud některý z nich failí kvůli schema diffu, uprav **nejdřív** fixture,
potom release.

## Related

- `docs/ai/document-review-envelope.md` — detaily envelope.
- `docs/ai/ai-review-pipeline-v2.md` — jak pipeline drží envelope live.
- `apps/web/src/lib/ai/extraction-schemas-by-type.ts` — veřejné API.
