# AI Review page-image fallback — runbook

Feature flag: **`AI_REVIEW_PAGE_IMAGE_FALLBACK`** (boolean, default **off**).

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
