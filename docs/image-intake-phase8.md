# AI Photo / Image Intake — Fáze 8

> Navazuje na [Fázi 7](image-intake-phase7.md) a [celkový index](image-intake.md).

## Přehled

Fáze 8 posouvá image intake lane z "operationally hardened" na "production lane with lifecycle visibility, cache efficiency a wider real-world coverage".

## Deliverables

### A) Handoff lifecycle feedback (`handoff-lifecycle.ts`)

Po `submitToAiReviewQueue()` lze volat `getHandoffLifecycleFeedback(reviewRowId, tenantId)`.

| Lifecycle stav | Popis |
|---|---|
| `prepared` | Payload postaven, ještě neodeslán |
| `submitted` | Řádek vytvořen v contractUploadReviews (uploaded) |
| `queued` | Pracovník zařadil do fronty (scan_pending_ocr) |
| `processing` | AI pipeline zpracovává |
| `done` | Hotovo (extracted / review_required) |
| `failed` | Pipeline selhala |
| `unavailable` | Status nelze zjistit — safe degradace |
| `unknown` | reviewRowId není k dispozici |

- `suggestRefresh: true` pouze pro přechodné stavy (submitted/queued/processing)
- Single DB read per explicitní volání — žádný agresivní polling
- `isFeatureEnabled("image_intake_enabled")` gate

Pomocné funkce:
- `buildHandoffLifecycleNote(feedback)` — krátký text pro preview
- `buildPreparedHandoffFeedback()` — stub pro pre-submit krok

### B) Intent-assist result cache (`intent-assist-cache.ts`)

In-process LRU cache pro výsledky `runIntentChangeAssist()`.

| Stav | Popis |
|---|---|
| `cache_hit` | Platný záznam — model call přeskočen |
| `cache_miss` | Žádný záznam — caller zavolá model |
| `cache_stale` | Expirovaný (TTL 30 min) — treat as miss |
| `cache_bypassed` | Caching disabled (non-ambiguous finding nebo prázdné fakty) |

Parametry:
- TTL: 30 minut
- Max entries: 200 (LRU eviction)
- Cache key: deterministický djb2 hash top-8 fact:value párů

Integrace v `intent-change-assist.ts`:
- `lookupIntentAssistCache()` před model callem
- `storeIntentAssistCache()` po úspěšném model callu

### C) Admin UI (`/portal/admin/image-intake`)

Nová admin stránka s tabs:
- **Feature flags** — toggle/reset tenant feature flags (vyžaduje global_admin)
- **Runtime config** — přehled config hodnot s source (override/env/default), boolean toggles
- **Cache** — intent-assist cache statistiky

Server actions: `apps/web/src/app/actions/admin-image-intake.ts`
- `getImageIntakeAdminState()` — read
- `setImageIntakeFeatureFlag(flagCode, enabled)` — mutate + audit
- `clearImageIntakeFeatureFlag(flagCode)` — reset + audit
- `setImageIntakeConfigValue(key, value)` — mutate + audit
- `clearImageIntakeConfigValue(key)` — reset + audit

Všechny mutace jsou auditovány přes `logConfigChange`.

### D) Document multi-image set intake (`document-set-intake.ts`)

Rozšíření pro document-like multi-image scénáře.

| Rozhodnutí | Podmínky |
|---|---|
| `consolidated_document_facts` | Všechny `photo_or_scan_document`, confidence ≥ 0.6, žádný review signal |
| `review_handoff_candidate` | `looks_like_contract=true` nalezeno v fact bundle |
| `supporting_reference_set` | Všechny `supporting_reference_image` |
| `mixed_document_set` | Přítomen `screenshot_client_communication` nebo různé typy |
| `insufficient_for_merge` | Confidence < 0.6 nebo prázdné fact bundles |

Safety pravidla:
- `screenshot_client_communication` nikdy nesmíchán s document assets
- Review-like dokumenty zůstávají jako handoff kandidáti — žádný tichý review v intake lane
- Supporting/reference images nikdy sloučeny do document setu

### E) Cross-session DB cleanup (`/api/cron/image-intake-cleanup`)

Denní cron (3:00 UTC) mazající stale `ai_generations` řádky:
- `entityType = "image_intake_thread_artifact"`
- `createdAt < NOW() - cross_session_ttl_hours`

Přidán do `vercel.json`. Vyžaduje `CRON_SECRET` bearer.
Přeskočí, pokud `crossSessionPersistenceEnabled = false`.

### F) Household / multi-client scope (`binding-household.ts`)

Adapter pro lookup household kontextu k resolved clientId.

| Stav | Podmínky |
|---|---|
| `single_client` | Household má jen jednoho člena nebo žádný |
| `no_household` | Client není v žádném household |
| `household_detected` | Household s více členy, aktivní kontext určil prioritu |
| `household_ambiguous` | Více členů, žádný jasný aktivní kontext — advisor musí upřesnit |

Safety pravidla:
- Aktivní kontext (lockedClientId/activeClientId) vždy wins
- Žádný silent auto-pick v household_ambiguous scénáři
- Jeden DB read na request; žádný model call

## Nové soubory

| Soubor | Popis |
|---|---|
| `src/lib/ai/image-intake/handoff-lifecycle.ts` | Lifecycle status adapter (A) |
| `src/lib/ai/image-intake/intent-assist-cache.ts` | Intent-assist LRU cache (B) |
| `src/lib/ai/image-intake/document-set-intake.ts` | Document multi-image expansion (D) |
| `src/lib/ai/image-intake/binding-household.ts` | Household binding scope (F) |
| `src/app/api/cron/image-intake-cleanup/route.ts` | DB cleanup cron (E) |
| `src/app/actions/admin-image-intake.ts` | Admin server actions (C) |
| `src/app/portal/admin/image-intake/page.tsx` | Admin UI page (C) |
| `src/lib/ai/__tests__/image-intake-phase8.test.ts` | Phase 8 testy (24) |

## Upravené soubory

| Soubor | Popis |
|---|---|
| `src/lib/ai/image-intake/types.ts` | Nové typy (HandoffLifecycleFeedback, IntentAssistCacheResult, HouseholdBindingResult, DocumentMultiImageResult) |
| `src/lib/ai/image-intake/intent-change-assist.ts` | Napojení na intent-assist cache |
| `apps/web/package.json` | test:image-intake rozšířen o phase8 |
| `vercel.json` | Cron pro cleanup (3:00 UTC) |

## Test coverage (Fáze 8)

```bash
pnpm --filter web test:image-intake
```

- Phase 8: 24 testů
- Celkem image intake: 253 testů (phases 2–8)

Pokryto:
- ✓ Handoff lifecycle feedback (8 testů) — mapping, degradace, no polling spam
- ✓ Intent-assist cache (7 testů) — hit/miss/stale/bypassed/key generation
- ✓ Document multi-image set (5 testů) — všechny decisions, no silent AI Review
- ✓ Cross-session cleanup config (2 testy) — TTL validace
- ✓ Text-only flow guardrail (1 test)

## Runtime cost guardrails

| Oblast | Guardrail |
|---|---|
| Lifecycle lookup | Single DB read per explicitní volání; žádný polling loop |
| Intent-assist cache | Model call přeskočen na cache_hit; 30min TTL |
| Document intake | Zero extra model calls — reuse existujících fact bundles |
| Household binding | Single DB read; žádný model call |
| DB cleanup | Batch DELETE jednou denně; scope omezen na entityType |
| Admin UI | Zero request-time overhead — read config z memory |

## Co zůstává na Fázi 9

- Household binding **integrace do orchestratoru** (v8 jde jen o lookup adapter)
- Document multi-image path **integrace do orchestratoru** (v8 je standalone evaluator)
- Lifecycle feedback **napojení do response-mapper / preview** (v8 je helper funkce)
- Household household_ambiguous **surfaced do preview/confirm flow** (v8 jen computing)
- Intent-assist cache **persistence přes requesty** (v8 je in-process; reset na restart)
- Admin UI **plný CRUD** (v8 je read + boolean/flag toggles)
- Cron cleanup **monitoring / alerting** na high delete counts
