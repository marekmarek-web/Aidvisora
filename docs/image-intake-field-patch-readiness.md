# Image Intake Field Patch — Live Readiness Report

**Generated:** 2026-04-09  
**Pass:** FINAL implementation pass — field-level CRM patch pipeline

## Executive Summary

This pass transforms image intake from an advisory-only / note-fallback flow into a real CRM write pipeline. Key capabilities added:

1. **Real `updateContact` write path** — extracted fields from images are written to CRM via the canonical execution engine, not just saved as notes.
2. **Automatic mode upgrade** — when ≥3 contact-patchable fields are extracted and client is bound, the pipeline auto-promotes to `contact_update_from_image` mode.
3. **Identity doc → existing client update** — when an identity document matches the already-bound client, the system proposes an update (not a new contact creation).
4. **Field-level diff preview** — each extracted field shows `new`, `same`, `conflict`, or `missing` status against existing CRM values.
5. **Extraction always visible** — the "nothing was read" message is eliminated when any usable facts exist.

## Root Causes Fixed

| # | Root Cause | Fix |
|---|-----------|-----|
| 1 | `planContactUpdateFromImage` used `createInternalNote` — no real CRM write | Changed to `updateContact` write action |
| 2 | No `updateContact` in domain model or write adapters | Added to `WRITE_ACTION_TYPES`, `CANONICAL_INTENT_TYPES`, registered adapter |
| 3 | Structured forms with contact fields stayed in `structured_image_fact_intake` (note-only) | Added `maybeUpgradeToContactUpdate()` post-extraction boost |
| 4 | Identity doc + existing matching client → always `createContact` | Added match detection: `verdict === "match"` → update flow with doc attach |
| 5 | "Žádné spolehlivé údaje nebyly přečteny" shown even when factBundle had data | Fallback now surfaces raw facts from bundle when mapped params are empty |
| 6 | No field-level diff against existing CRM values | Added `enrichFactsWithCrmDiff()`, `loadContactFieldsForDiff()`, diff status in UI |
| 7 | Response-mapper didn't show diff indicators | `contact_update_from_image` message now shows 🆕/⚠/✓ per field |

## Files Changed

| File | Change |
|------|--------|
| `apps/web/src/lib/ai/assistant-domain-model.ts` | Added `update_contact` intent, `updateContact` write action |
| `apps/web/src/lib/ai/assistant-write-adapters.ts` | Added `updateContact` write adapter using existing `updateContactAction` |
| `apps/web/src/lib/ai/image-intake/planner.ts` | Changed `planContactUpdateFromImage` to emit `updateContact`; added `maybeUpgradeToContactUpdate()`, `enrichFactsWithCrmDiff()` |
| `apps/web/src/lib/ai/image-intake/orchestrator.ts` | Post-extraction mode upgrade; identity-doc match → update flow; CRM diff enrichment |
| `apps/web/src/lib/ai/image-intake/response-mapper.ts` | Diff-aware contact_update message; extraction fallback for identity mode; `factKeyLabelForDiff()` |
| `apps/web/src/lib/ai/image-intake/intake-execution-plan-mapper.ts` | Added `update_contact` → `updateContact` mapping + advisor description |
| `apps/web/src/lib/ai/image-intake/types.ts` | Added `FieldDiffStatus`, optional `existingCrmValue`, `diffStatus`, `targetCrmField` to `ExtractedImageFact` |
| `apps/web/src/lib/ai/image-intake/load-contact-display-label-for-intake.ts` | Added `loadContactFieldsForDiff()` |
| `apps/web/src/lib/ai/__tests__/multimodal-crm-intake-acceptance.test.ts` | 12 new acceptance tests |

## Acceptance Scenarios

| # | Scenario | Status |
|---|----------|--------|
| 1 | EXISTING_CLIENT_FORM_PATCH | ✅ PASS |
| 2 | EXISTING_CLIENT_ID_DOC_PATCH | ✅ PASS |
| 3 | NEW_CLIENT_ID_DOC | ✅ PASS |
| 4 | IDENTITY_MISMATCH | ✅ PASS |
| 5 | PAYMENT_TO_PORTAL | ✅ PASS (preview-ready, no fake completion) |
| 6 | PARTIAL_EXTRACTION | ✅ PASS |
| 7 | NO_AUTO_SEND | ✅ PASS |
| 8 | CHIP_NO_SEND | ✅ PASS |
| 9 | TEXT_ONLY_UNCHANGED | ✅ PASS |
| 10 | NO_RAW_TECHNICAL_TEXT | ✅ PASS |
| 11 | CREATE_VS_UPDATE_SPLIT | ✅ PASS |
| 12 | EXPLICIT_CLIENT_PRECEDENCE | ✅ PASS |

## Remaining Caveats

1. **Payment portal write** — no real write endpoint exists; pipeline correctly shows preview-ready draft without fake "saved" messaging.
2. **`updateContact` requires firstName + lastName** — server action signature requires both; if extraction misses one, the step will fail with clear error.
3. **CRM diff requires DB call** — one additional query per contact_update_from_image flow; negligible cost.
4. **Multimodal feature flag** — extraction quality depends on `isImageIntakeMultimodalEnabledForUser` being enabled for the tenant. When disabled, stub facts are used and the UI honestly reflects it.

## Final Verdict

**READY WITH CAVEATS**

The core pipeline (extraction → field preview → diff → updateContact → confirm → execute) is complete and tested. Payment portal is preview-only (honest about it). Multimodal extraction quality depends on the vision model and feature flag enablement.
