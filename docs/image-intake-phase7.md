# AI Photo / Image Intake — Phase 7

**Status:** Production (Phase 7)
**Scope:** Cross-session persistence, combined pass multi-image, intent-change model assist, AI Review queue integration, admin/runtime controls, TTL/config hardening

---

## What was implemented in Phase 7

### A) Cross-session persistence adapter v1

**Files:** `cross-session-persistence.ts`, `cross-session-reconstruction.ts`

DB-backed persistence for cross-session thread artifacts. Reuses existing `ai_generations` table:
- `entityType = "image_intake_thread_artifact"`
- `entityId = "<tenantId>:<clientId>"`
- `outputText = JSON serialized artifact array`

No new DB migration required.

Operations:
- `persistArtifactsToDb()` — writes artifact array to DB (upsert pattern)
- `loadArtifactsFromDb()` — loads on request warm-up for client
- `clearArtifactsFromDb()` — for testing/reset
- `mergePersistedArtifacts()` — merges DB artifacts into in-process store

Safety:
- All DB ops are non-throwing — failure degrades to in-process only
- Gated by `IMAGE_INTAKE_CROSS_SESSION_PERSISTENCE_ENABLED` / config key
- TTL enforced on load (`crossSessionTtlMs` from config)
- Load → merge → reconstruct all happen in same request

---

### B) Combined pass multi-image input support v1

**Files:** `openai.ts`, `multimodal.ts`, `combined-multimodal-execution.ts`

`createResponseStructuredWithImages()` — new OpenAI function sending N image URLs as `input_image` content blocks in a single request. Hard cap max 5.

`runMultiImageCombinedPass()` — wrapper that:
- Caps imageUrls to `maxImages` (default 3, configurable)
- Single URL → delegates to `runCombinedMultimodalPass` (no change)
- Multiple URLs → sends all as separate `input_image` blocks in one call
- Falls back to single-URL primary pass on failure

`executeBatchMultimodalStrategy()` updated to use `runMultiImageCombinedPass` instead of single-URL path.

Cost: N related images → 1 vision call (not N calls). Hard cap: `combinedPassMaxImages` from config.

---

### C) Optional intent-change model assist v1

**File:** `intent-change-assist.ts`

Escalation path: called only when `detectIntentChange()` returns `status === "ambiguous"` AND:
- `intentAssistEnabled` config is true
- `finding.confidence < intentAssistThreshold` (default 0.45)
- Prior AND current facts both exist

Uses `createResponseStructured()` (text-only, no image — facts already extracted):
- Focused prompt with prior vs current state summary
- Returns `IntentChangeFinding` or null
- Returns null when flag off / not ambiguous / insufficient data
- Max 1 assist call per thread (called once in orchestrator)
- If model is still ambiguous with low confidence → returns original finding

Cost: +1 text-only model call, only for genuinely ambiguous threads.

---

### D) AI Review queue integration v1

**File:** `handoff-queue-integration.ts`

`submitToAiReviewQueue()` — submits prepared handoff payload into `contractUploadReviews` table:
- Calls `createContractReview()` from `review-queue-repository.ts`
- `processingStatus = "uploaded"` (triggers existing AI Review pipeline)
- Stores handoff payload in `extractedPayload` jsonb
- Writes `clientMatchCandidates` if client is known
- Writes audit record via `logAudit()`

Status mapping: `submitted | skipped_no_payload | skipped_flag_disabled | skipped_tenant_feature_disabled | skipped_no_confirm | failed` (`skipped_tenant_feature_disabled` = tenant nemá `image_intake_enabled` nebo `image_intake_handoff_queue` v admin přepínačích.)

Lane safety:
- Image intake does NOT run AI Review pipeline
- Queue entry triggers existing pipeline via normal processing flow
- Lane separation preserved — intake submits, AI Review processes independently

---

### E) Rollout admin/runtime controls v1

**File:** `apps/web/src/lib/admin/feature-flags.ts`

Added 5 image-intake flags to `FEATURE_FLAGS`:
- `image_intake_enabled` — main enable
- `image_intake_combined_multimodal` — combined multi-image pass
- `image_intake_intent_assist` — model assist for ambiguous intent
- `image_intake_handoff_queue` — queue submit enable
- `image_intake_cross_session_persistence` — persistence enable

`getImageIntakeAdminFlags(tenantId)` — returns all flags state for a tenant.
`setFeatureOverride(code, tenantId, enabled)` — existing admin mechanism.

**Runtime AND:** For production paths, orchestrator and `submitToAiReviewQueue` pass `tenantId`. Per-user gates in `feature-flag.ts` AND with `isFeatureEnabled` for the corresponding codes (master `image_intake_enabled` plus sub-flag where applicable). Intent assist additionally requires `image_intake_intent_assist` when `tenantId` is passed to `runIntentChangeAssist`. See the rollout matrix in [`docs/image-intake.md`](image-intake.md).

Existing admin API `GET /api/admin/feature-flags` returns all flags including image-intake flags.

---

### F) TTL/config hardening

**File:** `image-intake-config.ts`

Central config module replacing all hardcoded limits:

| Config key | Env var | Default | Range |
|------------|---------|---------|-------|
| `cross_session_ttl_hours` | `IMAGE_INTAKE_CROSS_SESSION_TTL_HOURS` | 72 | 1–168 |
| `cross_session_max_artifacts` | `IMAGE_INTAKE_CROSS_SESSION_MAX_ARTIFACTS` | 20 | 1–100 |
| `combined_pass_max_images` | `IMAGE_INTAKE_COMBINED_PASS_MAX_IMAGES` | 3 | 2–5 |
| `intent_assist_confidence_threshold` | `IMAGE_INTAKE_INTENT_ASSIST_THRESHOLD` | 0.45 | 0.1–0.9 |
| `intent_assist_enabled` | `IMAGE_INTAKE_INTENT_ASSIST_ENABLED` | false | bool |
| `cross_session_persistence_enabled` | `IMAGE_INTAKE_CROSS_SESSION_PERSISTENCE_ENABLED` | false | bool |
| `handoff_queue_submit_enabled` | `IMAGE_INTAKE_HANDOFF_QUEUE_SUBMIT_ENABLED` | false | bool |

Priority: runtime override → env var → safe default.
Validation: min/max enforced, invalid values fallback to default.
`getImageIntakeConfigSummary()` — full audit trace of all keys with source.

---

## Files changed

### New files
- `apps/web/src/lib/ai/image-intake/image-intake-config.ts`
- `apps/web/src/lib/ai/image-intake/cross-session-persistence.ts`
- `apps/web/src/lib/ai/image-intake/intent-change-assist.ts`
- `apps/web/src/lib/ai/image-intake/handoff-queue-integration.ts`
- `apps/web/src/lib/ai/__tests__/image-intake-phase7.test.ts`
- `docs/image-intake-phase7.md`

### Modified files
- `apps/web/src/lib/openai.ts` — `createResponseStructuredWithImages()` added
- `apps/web/src/lib/ai/image-intake/multimodal.ts` — `runMultiImageCombinedPass()` added
- `apps/web/src/lib/ai/image-intake/combined-multimodal-execution.ts` — uses `runMultiImageCombinedPass`, config-driven max
- `apps/web/src/lib/ai/image-intake/cross-session-reconstruction.ts` — uses config instead of hardcoded constants, `mergePersistedArtifacts()` added
- `apps/web/src/lib/ai/image-intake/orchestrator.ts` — Phase 7 wiring (DB load, intent assist, async persist)
- `apps/web/src/lib/ai/image-intake/index.ts` — Phase 7 exports
- `apps/web/src/lib/admin/feature-flags.ts` — 5 image-intake flags + `getImageIntakeAdminFlags()`
- `apps/web/src/lib/ai/__tests__/image-intake-phase6.test.ts` — updated mocks for `runMultiImageCombinedPass`

---

## Cost guardrails

| Rule | Enforcement |
|------|-------------|
| Multi-image combined pass: max 1 vision call | `runMultiImageCombinedPass` single call, `combinedPassMaxImages` cap |
| Combined pass max N images | `combinedPassMaxImages` (default 3, max 5) |
| Intent assist: only for ambiguous eligible threads | `status === "ambiguous"` + `confidence < threshold` check |
| Intent assist: max 1 call per thread | Called once in orchestrator, not looped |
| Cross-session persistence: zero model calls | Pure DB read/write, no AI calls |
| Queue submit: zero model calls | Audit + DB insert only |
| Config read: zero DB queries | Env vars + in-process overrides |

---

## Test coverage (Phase 7)

**File:** `image-intake-phase7.test.ts` — includes config, multi-image pass, persistence, intent assist, queue integration, admin flags, tenant AND gates, guardrails.

Sections (indicative):
- Config hardening (6 tests)
- Multi-image combined pass (5 tests)
- Cross-session persistence adapter (4 tests)
- Optional intent-change model assist (6 tests)
- AI Review queue integration (7 tests: includes tenant skip path)
- Admin rollout controls (3 tests)
- Tenant AND env gates (3 tests)
- Golden dataset guardrails Phase 7 (7 tests): GD7-1 through GD7-7

Run all phase tests: `pnpm --filter web test:image-intake` (see [`docs/image-intake.md`](image-intake.md)).

---

## What remains for Phase 8

1. **AI Review queue status polling** — Phase 7 submits but doesn't track status. Phase 8 should add `accepted/processing/done` status polling.
2. **Cross-session multi-client** — currently single client scope. Phase 8 could handle household/team scenarios.
3. **Intent assist model caching** — Phase 7 calls model per ambiguous thread. Phase 8 could cache results for same fact hash.
4. **Admin UI for config overrides** — Phase 7 adds flags to admin API, but no UI to set `cross_session_ttl_hours` etc. Phase 8 UI form.
5. **Multi-image pass for non-communication types** — Phase 7 focuses on `screenshot_client_communication`. Phase 8 could extend to document sets.
6. **Cross-session artifact cleanup** — Phase 7 TTL filters on read. Phase 8 could add scheduled DB cleanup for stale rows.
