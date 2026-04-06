# AI Review — Fáze 1 release gate (golden korpus)

**Strojový vstup:** [`fixtures/golden-ai-review/scenarios.manifest.json`](../fixtures/golden-ai-review/scenarios.manifest.json) (`corpusDocuments` C001–C029, `scenarios` G01–G12).  
**Schéma:** `apps/web/src/lib/ai/__tests__/golden-dataset-manifest.test.ts`.

---

## A) Gold set (ID dokumentů v korpusu)

Všechny řádky **`corpusDocuments[].id`**: **C001–C029** (29 souborů; seznam souborů v inventáři: [ai-review-assistant-phase-1-corpus-inventory.md](./ai-review-assistant-phase-1-corpus-inventory.md)).

Agregační scénáře: **G01–G12** (G10–G12 pouze assistant flow, bez `referenceFile`).

---

## B) Expected truth (co gate kontroluje z manifestu)

U každého korpusového řádku musí platit (viz test):

- `expectedFamily` (mapa z `familyBucket` na rodinu pro routing)
- `expectedPrimaryType`
- `expectedOutputMode` — jeden z: `structured_product_document`, `signature_ready_proposal`, `modelation_or_precontract`, `reference_or_supporting_document`
- `expectedPublishability` — shoda s `publishable`
- `expectedSensitivity` — `standard` | `high_sensitivity` | `mixed_sensitive`
- `expectedClientBindingType` — odkud brát klienta (blok pojistník/žadatel vs hlavička instituce)
- `expectedCoreFields` — minimální množina polí pro daný typ (bez zbytečné duplicity jména)
- `expectedActionsAllowed` / `expectedActionsForbidden` (zakázané musí odpovídat `expectedForbiddenActions`)
- `expectedNotesForAdvisor` — kopie / text z `corpusNote`
- u **`reference_or_supporting_document`**: povinné `expectedFallbackBehavior` (shrnutí, účel, další krok, `noProductPublishPayload: true`)

**Doménová pravidla (golden):** návrh smlouvy může být podpis-ready; modelace je hodnotná ale ne auto-publish jako finální smlouva; supporting dokumenty nejsou vynuceny do smluvních kolonek produktu.

---

## C) Matice: `expectedFamily` × `expectedOutputMode`

|  | structured_product_document | signature_ready_proposal | modelation_or_precontract | reference_or_supporting_document |
|--|----------------------------|--------------------------|---------------------------|----------------------------------|
| **life_insurance** | C002, C027 | C008–C015, C017, C026 | C003, C007 | — |
| **investment** | C004, C005, C018, C021, C022, C029 | — | — | — |
| **consumer_credit** | C019 | — | — | — |
| **mortgage** | C024 | C001 | — | — |
| **leasing** | C025 | — | — | — |
| **compliance** | — | — | — | C006, C016, C020, C023, C028 |

---

## D) Blocker dokumenty (riziko prázdného clone / CI)

- **Chybějící fyzický soubor:** jakýkoli `referenceFile`, který na stanici neexistuje — pipeline / live eval pro ten řádek nelze spustit. Typicky uváděno: **C027** (`Hanna Havdan GČP.pdf`) a většina PDF mimo git.
- **Není v gitu:** většina `Test AI/` v čistém clone; `gitTracked: false` v manifestu je očekávané. Pro CI bez lokálního korpusu je **blocker** jakýkoli test závislý na přítomnosti všech PDF.

---

## E) Mezery v korpusu (doplnit v dalších iteracích)

V aktuálním gold setu **nejsou** jako samostatné řádky typicky tyto **supporting** PDF (zůstávají jako gap pro Fázi 2+):

- výplatní páska  
- výpis z účtu (bank statement)  
- lékařská zpráva  
- hlášení pojistné události  
- samostatný consent mimo AML balík  

**Neživotní POV/HAV/majetek** jsou částečně pokryty C010–C012, C026; samostatné „čisté“ pojistky mimo sérii `Navrh_pojistne_smlouvy` lze stále doplnit.

---

## F) Měření postupu (Fáze 2+)

- **Routing:** shoda `expectedFamily` / `expectedPrimaryType` / `expectedOutputMode` s výstupem klasifikace (live eval už částečně měří family/type/publish).  
- **Extrakce:** postupné napojení polí z `expectedCoreFields` na deterministické nebo LLM evaly.  
- **Publish safety:** stávající harness (`golden-ai-review-harness.test.ts`) + manifest `phase3_acceptance` u vybraných G scénářů.

---

## SQL migrace

Žádné.

```sql
-- Žádný nový skript.
```
