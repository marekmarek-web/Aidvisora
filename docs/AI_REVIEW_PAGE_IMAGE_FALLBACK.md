# AI Review page-image fallback — runbook

Feature flag: **`AI_REVIEW_PAGE_IMAGE_FALLBACK`** (boolean). Code default = **on**
(`process.env.AI_REVIEW_PAGE_IMAGE_FALLBACK !== "false"`). Set env to the literal
string `false` to disable. This runbook used to say "default off"; that was the
pre-2026-04 shipping default before the flag was flipped — keep the env pinned
to `true` in production so the behaviour is explicit.

Když je zapnutý, AI Review pipeline (`ai-review-pipeline-v2.ts`) po primární extrakci
zjistí required pole, která mají `value == null` nebo `confidence < 0.5`, rasterizuje
jejich `sourcePage` přes `pdfjs-dist` + `@napi-rs/canvas` a pošle cílený multimodal
dotaz na model. Rescue je capnuté na:

- **`confidence = 0.7`** (nikdy 1.0 — vždycky advisor review).
- **`MAX_RESCUES_PER_RUN = 6`** polí / dokument (cost control).
- Pouze PDF mimetype (`application/pdf`).

Každý rescued field má `sourceKind: "page_image_fallback"` + `evidenceTier: "recovered_from_image"` a
v UI dostane `ze snímku` badge.

## 1. Vercel CLI — zapnout na staging (Preview)

Preview env ve Vercelu drží všechny feature-branch deploye. Pro staging se typicky
používá právě `preview` scope nebo dedikovaná staging větev.

```bash
cd apps/web

vercel link          # jednou — vybrat správný projekt
vercel env pull .env.preview.local --environment=preview

vercel env add AI_REVIEW_PAGE_IMAGE_FALLBACK preview
# Po promptu zadat: true

vercel env ls --environment=preview | grep AI_REVIEW_PAGE_IMAGE_FALLBACK
```

Redeploy aktivní preview větve, aby se flag propsal:

```bash
vercel --prod=false       # nebo push prázdný commit do feature branche
```

## 2. Smoke test na staging

Minimum co ověřit po zapnutí:

1. Uploadnout **image-only PDF** (sken bez textové vrstvy) — musí projít jako dřív.
2. Uploadnout **Komisionářská smlouva scan.pdf** (anchor case).
3. V AI Review otevřít review → v pravém panelu klíčová pole (jméno, RČ, IBAN).
4. Pokud některé required pole dostalo hodnotu **až po fallbacku**, má mít:
   - Badge **`ze snímku`** vedle hodnoty.
   - Confidence pill **Střední** (cap 0.7 = 70 %).
5. V Sentru (filter `feature: ai_review_page_image_fallback`) se objeví breadcrumb
   `page_image_fallback_recovered` s `recoveredFieldKeys` + `failedAttempts`.
6. `extractionTrace.pageImageFallbackRecoveries` je v DB u review řádku (debug view).

### Decision gate před produkcí

Rescue zapínáme do produkce **pouze** pokud:

- Na 3+ reálných scanech doplní aspoň jedno required pole, které primární extrakce minula.
- Žádný halucinovaný IBAN / rodné číslo / jméno (porovnat proti originálu).
- Zvýšení p95 latency review pipelinu **< +8 s** (měřit `trace.reviewDecisionDurationMs`
  before/after).
- Žádný nový Sentry issue s `feature: ai_review_page_image_fallback` v posledních 24 h
  na staging provozu.

## 3. Production rollout

```bash
vercel env add AI_REVIEW_PAGE_IMAGE_FALLBACK production
# true

# Redeploy:
vercel --prod
```

**Rollback** (1 příkaz):

```bash
vercel env rm AI_REVIEW_PAGE_IMAGE_FALLBACK production
vercel --prod    # redeploy bez flagu, default off je bezpečný stav
```

Alternativně nastavit na `false` místo odstranění — efekt stejný.

## 4. Observability

| Signal | Kde | Co znamená |
|--------|-----|-----------|
| `breadcrumb ai_review.page_image_fallback` | Sentry | Rescue se spustil pro N polí (attemptedCount), M recovered. |
| `page_image_fallback_recovered` reason | `trace.reasons` | Aspoň 1 pole bylo doplněno přes fallback. |
| `trace.pageImageFallbackRecoveries: string[]` | DB review řádek | Seznam field keys doplněných přes rescue. |
| `trace.pageImageFallbackFailures: number` | DB review řádek | Počet polí, kde rescue call padl (rate limit / parse fail). |
| `capturePageImageFallbackError` | Sentry issue | **Celý fallback blok throwl** (pdfjs init fail, fatal error). Ne per-field. |
| `trace.warnings: ["page_image_fallback_error:..."]` | DB review řádek | Stejná cesta jako výše, duplikát pro runbook. |

## 5. Náklady

Odhad na 1 scan s 3 missing required fields:

- 3× rasterizace stránky (pdfjs server-side) ≈ 200 ms/stránku.
- 3× OpenAI multimodal call (`createResponseStructuredWithImage`) ≈ $0.01 / call × 3 = **~$0.03 / doc**.
- Hard cap `MAX_RESCUES_PER_RUN = 6` → **max $0.06 / doc**.

Pro 100 scanů/den = max **$6/den** dodatečných nákladů. Pro 1000 scanů/den by stálo
zvážit zúžení `MAX_RESCUES_PER_RUN` nebo zvýšit práh `confidence < 0.3` místo `< 0.5`.

## 6. Vision-fallback gate (Wave 1.3)

Od Wave 1.3 Premium Scan Closeout máme jednotnou decision vrstvu nad rescue +
full-vision — modul
[`apps/web/src/lib/ai/vision-fallback-gate.ts`](../apps/web/src/lib/ai/vision-fallback-gate.ts).
Gate je **pure** (bez side-effects, bez network) a dnes běží v **permissive
módu** — pouze emituje Sentry breadcrumb, nemění control flow, nikdy neblokuje
publish.

### Co gate reportuje

Per AI Review run, breadcrumb category `ai_review.vision_fallback_gate`:

| Pole | Význam |
|---|---|
| `runRescue` | Mirror dnešní rescue podmínky (env flag + PDF k dispozici). |
| `runFullVision` | Mirror dnešní full-vision podmínky (scan-vision branch active). |
| `reasons` | Proč rescue/full-vision běžel / neběžel. |
| `recoveredRatio` | `#fields v recovered_from_image/recovered_from_full_vision / #fields s hodnotou`. |
| `criticalFieldsFromVision` | IBAN / accountNumber / personalId / policyAmount / contractNumber pokud landly v recovered tieru. |
| `publishBlockReasons` | Heuristika, která BY blokovala publish v enforce módu (permissive ji jen loguje). |
| `hardBlockPublish` | V 1.3 VŽDY `false`. |

Sentry level:
- `info` — gate OK (žádné block reasons).
- `warning` — `publishBlockReasons.length > 0` (kritické pole z vision, nebo recoveredRatio > 0.5, nebo scan + low confidence). Ještě to nic neblokuje.
- `error` — `hardBlockPublish === true` (Wave 5).

### Env flag

**`AI_REVIEW_VISION_FALLBACK_GATE_ENFORCE`** — viz sekce 10 (Wave 5) níže.
Flag je nyní skutečně napojený do gate i do `apply-contract-review.ts`, ale
default je **OFF**. Nenastavovat v produkci, dokud není hotový W1.3 observation
burn (24–48 h Sentry data).

### Co sledovat v 24–48 h observation window

Cíl — získat baseline pro Wave 5 enforcement rozhodnutí:

1. Jaká frekvence scanů má `publishBlockReasons.length > 0`? (= co by W5 zablokoval.)
2. Jaká frekvence má kritické pole z visionu? (= blast radius IBAN/RČ bloku.)
3. Recovered ratio distribution — dá se > 0.5 threshold přiblížit, nebo je to
   signál, že primární text path u scanů nedělá skoro nic?
4. Korelace `low_confidence_scan` s reálnou halucinací (spot-check advisor review).

### Rollback

Gate nemá rollback flag — je pure a defaultně permissive. Odstranění se dělá
reverzí PR, který ho integroval. Runtime rollback není potřeba (žádné
publish-breaking chování v 1.3).

---

## 7. Unified multimodal input builder (Wave 2)

Modul [`apps/web/src/lib/ai/unified-multimodal-input.ts`](../apps/web/src/lib/ai/unified-multimodal-input.ts)
sjednocuje tři dosud oddělené multimodal cesty:

| Mode | Legacy caller | Použití |
|---|---|---|
| `hybrid_pdf_file` | `createResponseWithFile` | Text-first PDF + prompt. |
| `single_page_rescue` | `createResponseStructuredWithImage` | Rescue chybějících polí. |
| `multi_page_vision` | `createResponseStructuredWithImages` | Full-doc vision, boundary detect (W4.B), vision-primary (W3). |

**Env flag:** `AI_REVIEW_UNIFIED_INPUT_BUILDER` — default `false`. Když zapnutý,
`page-image-fallback.ts` routuje rescue + full-vision cesty přes builder místo
přímých `createResponseStructured*` volání. Chování je funkčně ekvivalentní;
flag existuje, aby bylo možné na stagingu 24 h porovnat `trace.pageImageFallbackRecoveries`
před a po flipu.

**Sentry:** builder emituje `ai_review.unified_extraction` breadcrumb (level
`info` na úspěch, `warning` na chybu) **pouze když je flag on** — vypnutý stav
nedělá žádné nové telemetrie.

**Rollback:** flipnout `AI_REVIEW_UNIFIED_INPUT_BUILDER=false`. Builder je
side-effect-free; zbytek kódu spadne zpět na legacy direct calls.

---

## 8. Vision-primary shadow pass (Wave 3)

Modul [`apps/web/src/lib/ai/vision-primary-extraction.ts`](../apps/web/src/lib/ai/vision-primary-extraction.ts).

**Problém:** u scanů je dnes text-first + rescue suboptimální. Vision-first
(rasterizace → multi_page_vision) má nižší hallucination rate, ale flip primacy
v pipeline je nebezpečný — rozbiju text-first integrace.

**Tento PR ships shadow mode:** když je flag on a inputMode ∈ {scanned_pdf,
mixed_pdf, image_document}, pipeline spustí vision-primary paralelně s
text-first a zapíše výsledek na `trace.visionPrimaryShadow` (field count +
field keys + pagesUsed + durationMs + errorCode). Primary výstup pipeline se
NEMĚNÍ.

**Env flag:** `AI_REVIEW_VISION_PRIMARY_FOR_SCAN` — default `false`.

**Co observovat před flipem primacy:**
1. Kolik % scanů vůbec dojde do shadow (ran=true vs skippedReason).
2. `fieldCount` shadow vs. `totalFieldsWithValue` v primary envelope — shadow
   by měl být ≥ 80 % primary, aby flip dával smysl.
3. Field-key overlap s `extractedFields` v primary — klíčová pole
   (`iban`, `personalId`, `contractNumber`) musí být v shadow přítomná.
4. Durační overhead — shadow běží sériově za inputMode detekcí, takže je to
   čistá latence navíc.

**Sentry:** `ai_review.vision_primary` breadcrumb (info na úspěch, warning na
provider error).

**Rollback:** flipnout na `false`. Shadow-pass pak short-circuituje na
`skippedReason="flag_off"` bez nákladu.

---

## 9. AML/FATCA dedicated extraction + vision boundary detection (Wave 4)

### 9.A AML/FATCA LLM extrakce

Dnes je AML/FATCA detekce jen heuristická (`runAmlHeuristicDetection`).
Wave 4.A přidává dedicated narrow-section LLM pass
(`runAmlFatcaSectionExtractionPass` v
[`subdocument-extraction-orchestrator.ts`](../apps/web/src/lib/ai/subdocument-extraction-orchestrator.ts))
s rozšířeným schema: `pepFlag`, `pepReason`, `usPerson`, `taxResidencies[]`,
`beneficialOwners[]`, `sourceOfFunds`, `purpose`.

Výstup se připojuje **additivně** na `envelope.amlFatcaExtraction` — nemění
`publishHints` / `reviewWarnings` (ty už heuristická cesta obsluhuje).

**Env flag:** `AI_REVIEW_AML_FATCA_EXTRACT` — default `false`. Flag zapnout až
na stagingu s real AML bundlem (např. S03 z golden scan subsetu, jakmile bude
anonymizovaný).

### 9.B Vision boundary detection

Modul [`apps/web/src/lib/ai/detect-document-boundaries-vision.ts`](../apps/web/src/lib/ai/detect-document-boundaries-vision.ts).
Poslouží pro multi-doc scany: pošle prvních N stran do `multi_page_vision`
režimu builderu a dostane zpět `{ startPage, endPage, documentType }[]` hranice
subdokumentů. Pure function, nikdy nethrowí.

**Env flag:** `AI_REVIEW_VISION_BOUNDARY_DETECT` — default `false`. Minimum
`pageCount >= 3`, cap `maxPages=8`.

**Pipeline integrace:** boundary výsledek se po volání zapíše na
`trace.visionBoundaryDetection`. Konzumace (split envelope per subdokument)
je další iterace — zatím je to diagnostika.

**Sentry:** `ai_review.vision_boundary_detect` breadcrumb.

---

## 10. Publish safety enforcement (Wave 5)

Modul [`apps/web/src/lib/ai/apply-vision-gate-publish-block.ts`](../apps/web/src/lib/ai/apply-vision-gate-publish-block.ts) — pure
helper zapojený do [`apply-contract-review.ts`](../apps/web/src/lib/ai/apply-contract-review.ts).

**Env flag:** `AI_REVIEW_VISION_FALLBACK_GATE_ENFORCE`.

Chování:

| Flag | Gate `publishBlockReasons` | Výsledek apply |
|---|---|---|
| OFF (default) | any | Sentry `capturePublishGuardFailure` + pokračuje. |
| OFF | none | no-op. |
| ON | `critical_field_recovered_from_image` nebo `hardBlockPublish=true` | Sentry signal + `{ ok: false, error }` — advisor musí hodnotu potvrdit ručně. |
| ON | none | no-op. |

Zapnutí flagu současně flipne `enforceMode: true` v gate volání uvnitř
pipeline (`ai-review-pipeline-v2.ts`), takže `hardBlockPublish` přestane být
hardcoded `false`.

**Prerequisites před flipem:**
1. W1.3 observation burn proběhl (24–48 h produkční data `ai_review.vision_fallback_gate`).
2. `% runů s publishBlockReasons > 0` je << 10 % (jinak zablokujeme běžný traffic).
3. Advisor UI má clear error message a umožňuje re-edit pole → re-apply.

**Rollback:** `AI_REVIEW_VISION_FALLBACK_GATE_ENFORCE=false`.

---

## 11. Flag matrix — cheatsheet

| Flag | Wave | Default | Zapnout když |
|---|---|---|---|
| `AI_REVIEW_PAGE_IMAGE_FALLBACK` | baseline | **on** | (pinovat `true` v prod) |
| `AI_REVIEW_UNIFIED_INPUT_BUILDER` | W2 | off | Staging canary, po 24 h bez diffu → prod. |
| `AI_REVIEW_VISION_PRIMARY_FOR_SCAN` | W3 | off | Shadow-mode opt-in pro měření. |
| `AI_REVIEW_AML_FATCA_EXTRACT` | W4.A | off | Staging s live AML bundlem. |
| `AI_REVIEW_VISION_BOUNDARY_DETECT` | W4.B | off | Staging s multi-doc scan bundlem. |
| `AI_REVIEW_VISION_FALLBACK_GATE_ENFORCE` | W5 | off | **Nikdy** před W1.3 observation. |
| `GOLDEN_SCAN_EVAL` | dev | off | Lokální `GOLDEN_SCAN_EVAL=1 vitest` pro baseline report. |
