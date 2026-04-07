# AI Photo / Image Intake -- Faze 9

> Navazuje na [Fazi 8](image-intake-phase8.md) a [celkovy index](image-intake.md).

## Prezes

Faze 9 uzavruje "feature-rich production lane" a prevadi ji na "fully surfaced and operationally hardened production lane". Klicove zmeny:

1. Phase 8 moduly plne propojeny do orchestratoru a response-mapperu
2. Household ambiguity surfacovana v preview/confirm flow
3. Intent-assist cache perzistuje pres requesty a restarty (DB-backed)
4. Cleanup cron ma strukturovany audit log (start/complete/failed)
5. Document-set a lifecycle notes jsou v ImageIntakePreviewPayload

## A) Orchestrator + response-mapper integration hardening

### Nove pole v `ImageIntakeOrchestratorResult`

| Pole | Typ | Popis |
|---|---|---|
| `householdBinding` | `HouseholdBindingResult \| null` | Vysledek household lookup |
| `documentSetResult` | `DocumentMultiImageResult \| null` | Vysledek document-set evaluatoru |
| `lifecycleFeedback` | `HandoffLifecycleFeedback \| null` | Lifecycle stav handoffu (null pri intake; lookupovat after submit) |
| `intentAssistCacheStatus` | `IntentAssistCacheStatus \| null` | Cache status z posledniho assist cyklu |

### Nove pole v `ImageIntakePreviewPayload`

| Pole | Popis |
|---|---|
| `householdAmbiguityNote` | Non-null pro household_ambiguous / household_detected stavum. Take pridan do `warnings`. |
| `documentSetNote` | Preview text z `buildDocumentSetPreviewNote()` |
| `lifecycleStatusNote` | Lifecycle stav z `buildHandoffLifecycleNote()` (null pri intake) |
| `intentAssistCacheStatus` | Cache status pro ops visibility |

### `response-mapper.ts` -- nove sekce v `suggestedNextSteps`

- Household ambiguity / detected note (s varovnim prefixem pro `household_ambiguous`)
- Document set outcome note
- Lifecycle status note (pokud dostupna)

## B) Household preview surfacing

`resolveHouseholdBinding()` je volano z orchestratoru po `resolveClientBindingV2`.

- `household_ambiguous` stav je surfacovan jako warning v `previewPayload.warnings`
- Zadny silent auto-pick v orchestratoru -- ambiguity je validni outcome
- DB lookup je non-blocking; failure degrades gracefully (householdBinding = null)

## C) Persistent intent-assist cache v2

Novy soubor: `intent-assist-cache-persistence.ts`

| Funkce | Popis |
|---|---|
| `lookupIntentAssistCachePersistent(finding, facts, tenantId)` | In-process hit first, pak DB fallback |
| `storeIntentAssistCachePersistent(facts, finding, tenantId, userId)` | In-process store + async DB persist |

Storage: `ai_generations` table, `entityType = "image_intake_intent_assist_cache"`.

Cache states (rozsirene o):
- `cache_write_failed` -- DB write selhal, in-process store probehl

TTL: 30 minut (shodne s in-process cache).

`runIntentChangeAssist()` nyni pouziva persistent cache kdyz je `tenantId` k dispozici.

## D) Cleanup monitoring

Cron route `image-intake-cleanup` rozsirena:

- Loguje `image_intake_cleanup.started`, `.completed`, `.failed` pres `logAuditAction`
- Vymazava oba entity types: `image_intake_thread_artifact` + `image_intake_intent_assist_cache`
- Response obsahuje `deletedArtifacts`, `deletedCache`, `totalDeleted`, `durationMs`
- Import `lt` presunut z `drizzle-orm` na `"db"` (konzistentni s dalsimi soubory)

## E) Document-set + lifecycle surfacing

- `evaluateDocumentMultiImageSet()` volano z orchestratoru pro `grouped_related` skupiny
- Pokud `consolidated_document_facts`: `factBundle` je prepisano sloucenymi fakty
- Pokud `review_handoff_candidate`: zadne fakty nejsou sloucceny, handoff zustava kandidatem
- `documentSetNote` a `lifecycleStatusNote` jsou soucasti `ImageIntakePreviewPayload`

## Nove soubory

| Soubor | Popis |
|---|---|
| `src/lib/ai/image-intake/intent-assist-cache-persistence.ts` | DB-backed persistent cache v2 (C) |
| `src/lib/ai/__tests__/image-intake-phase9.test.ts` | Phase 9 testy (20) |
| `docs/image-intake-phase9.md` | Tato dokumentace |

## Upravene soubory

| Soubor | Zmena |
|---|---|
| `src/lib/ai/image-intake/types.ts` | Nova pole v ImageIntakePreviewPayload |
| `src/lib/ai/image-intake/orchestrator.ts` | Nova pole v OrchestratorResult; household/doc-set/cache wiring; Phase 9 imports |
| `src/lib/ai/image-intake/response-mapper.ts` | Household, doc-set, lifecycle v suggestedNextSteps |
| `src/lib/ai/image-intake/intent-change-assist.ts` | Persistent cache lookup/store |
| `src/app/api/cron/image-intake-cleanup/route.ts` | logAuditAction + deletedCache count |
| `apps/web/package.json` | test:image-intake rozsiren o phase9 |

## Test coverage

```bash
pnpm --filter web test:image-intake
```

- Phase 9: 20 testu
- Celkem image intake: 273 testu (phases 2-9)

Pokryto:
- Preview payload Phase 9 fields (4 testy)
- Persistent cache (7 testu) -- hit/miss/DB-fallback/write-failed/bypassed
- Lifecycle feedback no-polling safety (2 testy)
- Household ambiguity safety (3 testy)
- Document-set lane separation (2 testy)
- Text-only flow guardrail (1 test)

## Runtime cost guardrails

| Oblast | Guardrail |
|---|---|
| Persistent cache | In-process hit = zero DB read; DB fallback = 1 read; store = 1 write (async) |
| Household binding | 1 DB read; zadny model call |
| Document-set eval | Zero extra model calls; reuse existujicich fact bundles |
| Lifecycle surfacing | Zadny polling; single read on demand |
| Cleanup monitoring | logAuditAction = fire-and-forget; zadny request-time overhead |

## Co zustava na Fazi 10

- Lifecycle feedback lookup **napojeny na advisor confirm flow** (nyni helper na demand)
- Admin UI pro household ambiguity resolution flow
- Persistent cache **TTL cleanup** (stare DB zaznamy manualne nebo cron)
- Document-set outcomes **v execution plan** (nyni v preview only)
- Cron health checks / alerting integrace s externi observabilitou
