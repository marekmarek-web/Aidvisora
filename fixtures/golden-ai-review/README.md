# Golden dataset — AI Review + AI asistent

**Manifest:** [`scenarios.manifest.json`](./scenarios.manifest.json) — **verze 3** (`scenarios` G01–G12 včetně phase2/3 acceptance kde platí, `corpusDocuments` **C001–C029**). Fáze 1 doplňuje golden truth: `expectedOutputMode`, `expectedFamily`, `expectedCoreFields`, `expectedActionsAllowed` / `expectedActionsForbidden`, `expectedFallbackBehavior`, atd.

Binární PDF často **nejsou v gitu**; drž je lokálně ve stejné cestě jako `referenceFile`.

## Soubory

| Soubor | Účel |
|--------|-----|
| `scenarios.manifest.json` | Zdroj pravdy: scénáře + korpus + golden pole. |
| `regenerate-manifest.cjs` | **Jen** přepočítá `gitTracked` přes `git ls-files -- Test AI/`; **nemění** verzi manifestu ani phase2/3 pole. Spuštění z kořene monorepa: `node fixtures/golden-ai-review/regenerate-manifest.cjs` |
| `docs/ai-review-assistant-phase-1-corpus-inventory.md` | Lidská tabulka C001–C029. |
| `docs/ai-review-assistant-phase-1-corpus-buckets.md` | `familyBucket` + minimální výstupy + golden core fields. |
| `docs/ai-review-phase1-release-gate.md` | Release gate skeleton (pokrytí, blockery, mezery). |

## Jak přidat nebo změnit PDF

1. Ulož soubor do `Test AI/`.  
2. Uprav přímo **`scenarios.manifest.json`** (řádek v `corpusDocuments` + případně `scenarios[].coversCorpusIds`).  
3. Spusť `node fixtures/golden-ai-review/regenerate-manifest.cjs` pro aktualizaci `gitTracked`.  
4. Aktualizuj [ai-review-assistant-phase-1-corpus-inventory.md](../../docs/ai-review-assistant-phase-1-corpus-inventory.md) a [ai-review-phase1-release-gate.md](../../docs/ai-review-phase1-release-gate.md).  
5. Uprav `EXPECTED_CORPUS_COUNT` v `apps/web/src/lib/ai/__tests__/golden-dataset-manifest.test.ts`, pokud přibývá ID.

**Nepoužívej** starý vzor „přepsat celý manifest ze skriptu“ — `regenerate-manifest.cjs` už nesmí generovat manifest od nuly (ztráta v3).

## Eval

- Schéma manifestu: `pnpm --filter web exec vitest run src/lib/ai/__tests__/golden-dataset-manifest.test.ts`  
- Live pipeline: viz `golden-dataset-live-pipeline.eval.test.ts` a env `GOLDEN_LIVE_EVAL=1`.
