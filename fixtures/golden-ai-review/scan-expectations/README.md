# Scan-subset expectations

Source of truth: [`../scan-subset.manifest.json`](../scan-subset.manifest.json).

Each JSON file in this folder pins the golden envelope for one scan anchor. File name = manifest `expectationFile` (e.g. `S01.json`).

## Schema

| Field | Type | Purpose |
|---|---|---|
| `id` | string | Must match a manifest entry id. |
| `anchor` | string | Must match manifest `anchor` path. |
| `documentTypeHint` | string | Expected `documentType` passed to the pipeline. |
| `description` | string | Failure-mode narrative for future maintainers. |
| `requiredFieldsMustRecover` | string[] | `extractedFields[key].value` must end up non-null, regardless of `evidenceTier`. |
| `fieldsThatMustNOTHallucinate` | string[] | If the source document does not contain this field, the pipeline must leave `value: null` (null-safety against hallucination on IBAN / RČ / IČO). |
| `maxRecoveredFromImageRatio` | number 0..1 | Upper bound of `#fields with evidenceTier ∈ { recovered_from_image, recovered_from_full_vision } / #fields with non-null value`. Signals that the primary path is still working on this anchor. |
| `minOverallConfidence` | number 0..1 | Lower bound of `envelope.overall.confidence` (or aggregated mean). |
| `expectedEvidenceTiersAllowed` | string[] | Whitelist — any field landing in a tier outside this set is a regression. |
| `expectedReviewWarningCodes` | string[] | Review warning codes that must appear on `reviewWarnings[]`. |
| `expectedFlags` | object | Sub-flags, e.g. `scanVisionFallbackActivated`, `publishableAsContract`. |
| `notes` | string[] | Free-form commentary. Do not put asserts here. |

## Current entries

- `S01.json` — Komisionářská smlouva scan.pdf (bundle scan / AML+FATCA).
- S02–S05 pending fixtures (see manifest); no expectation JSON needed until `status: live`.

## Adding a new anchor

1. Drop the PDF into `Test AI/` locally.
2. Add the entry to `scan-subset.manifest.json` with `status: "live"`.
3. Create `scan-expectations/S0X.json` using the schema above.
4. Run the baseline eval once locally: `GOLDEN_SCAN_EVAL=1 pnpm --filter web exec vitest run src/lib/ai/__tests__/golden-scan-subset.eval.test.ts`. Record the snapshot in the diff message.
