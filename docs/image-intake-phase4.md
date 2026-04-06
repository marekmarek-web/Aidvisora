# AI Photo / Image Intake — Fáze 4

## Status: DONE

Fáze 4 rozšiřuje image intake lane o produkčně realističtější orchestraci pro více obrázků,
bezpečnější case/opportunity binding a explicitní AI Review handoff boundary.

---

## Co bylo přidáno

### A) Multi-image session stitching v1 (`stitching.ts`)

Levná metadata-first agregace více obrázků v jednom intake requestu.

**Algoritmus (bez model callů):**
1. Exaktní duplikáty — content hash porovnání
2. Near-duplikáty — MIME + size ±5% + rozlišení ±30px
3. Type grouping — stejný inputType → `grouped_thread` (komunikace) nebo `grouped_related` (platby, dokumenty)
4. Vše ostatní → `standalone`

**Výstup:**
```
StitchedAssetGroup: { decision, assetIds, primaryAssetId, duplicateAssetIds, confidence, rationale }
MultiImageStitchingResult: { groups, standaloneAssetIds, duplicateAssetIds, hasGroupedAssets, stitchingConfidence }
```

**Cost guardrails:**
- Nulové model cally pro stitching
- `supporting_reference_image`, `general_unusable_image`, `mixed_or_uncertain_image` → vždy standalone
- Podpůrné obrázky se neslučují s komunikačními screenshoty
- `getPrimaryAssetIds()` vrací jen primární assety — duplikáty se neprocesují znovu → žádné duplicitní action proposals

**Feature flag:** `IMAGE_INTAKE_STITCHING_ENABLED=true`

---

### B) Case/opportunity binding v2 (`binding-v2.ts` rozšíření)

Rozšíření Phase 3 client bindingu o case/opportunity lookup.

**Priority chain:**
1. `session.lockedOpportunityId` → `bound_case_from_active_context` (konf. 0.95)
2. `request.activeOpportunityId` → `bound_case_from_active_context` (konf. 0.80)
3. Client-scoped DB lookup → dle počtu výsledků:
   - 0 výsledků → `unresolved_case`
   - 1 výsledek → `bound_case_from_strong_lookup` (konf. 0.70, s upozorněním na potvrzení)
   - 2+ výsledků → `multiple_case_candidates` (caseId = null, bez auto-picku)
4. Bez klienta → `unresolved_case`

**CaseBindingStateV2 enum:**
```
bound_case_from_active_context | bound_case_from_strong_lookup |
weak_case_candidate | multiple_case_candidates | unresolved_case
```

**Bezpečnostní pravidla:**
- Žádný silent auto-pick při více kandidátech
- Bez dostatečné evidence nevzniká confident case binding
- `toCaseBindingResult()` — backward-compatible adapter na legacy `CaseBindingResult`

---

### C) AI Review handoff boundary v1 (`review-handoff.ts`)

Explicitní, testovatelná hranice mezi image intake a AI Review.

**Jak to funguje:**
- `evaluateReviewHandoff()` analyzuje classifier + fact extraction výstup
- Detekuje signály: `contract_like_document`, `insurance_policy_attachment`, `multi_page_document_scan`, `formal_policy_document`, `dense_legal_text`
- Vrací `ReviewHandoffRecommendation` — recommendation, NIKOLIV akci

**Pevné výjimky (NEVER handoff):**
- `screenshot_client_communication` — komunikační screenshoty nesmí nikdy padnout do AI Review
- `screenshot_payment_details`
- `screenshot_bank_or_finance_info`
- `supporting_reference_image`
- `general_unusable_image`

**handoffReady vs recommended:**
- `recommended=true` = systém detekoval signály
- `handoffReady=true` = flag je ON + confidence ≥ 0.55 → advisor vidí jasné doporučení
- Bez `handoffReady` se obrázek zpracuje jako archive-only, ale bez skoků do AI Review

**Žádná automatická akce** — handoff je výhradně advisory output, ne přesměrování.

---

### D) Rollout hardening

Čtyři separátně ovladatelné feature flags:

| Flag | Env proměnná | Default | Co spustí |
|------|-------------|---------|-----------|
| Base | `IMAGE_INTAKE_ENABLED=true` | OFF | Celý image intake |
| Multimodal | `IMAGE_INTAKE_MULTIMODAL_ENABLED=true` | OFF | Vision API pass |
| Stitching | `IMAGE_INTAKE_STITCHING_ENABLED=true` | OFF | Multi-image grouping |
| Review Handoff | `IMAGE_INTAKE_REVIEW_HANDOFF_ENABLED=true` | OFF | Handoff recommendations |

`getImageIntakeFlagSummary()` vrací všechny čtyři stavy jako jeden trace-safe objekt.

---

### E) Action planning v3 (`planner.ts`)

Rozšiřuje v2 o handoff recommendation:
- Pokud `reviewHandoff.handoffReady = true`, downgráduje output mode na `no_action_archive_only`
- Přidá safety flag `AI_REVIEW_HANDOFF_RECOMMENDED: ...`
- Vytvoří jednu `create_internal_note` akci s handoff explainability payload
- Komunikační screenshoty nejsou nikdy downgradovány (lane separation garantována)

---

### F) Response mapper enrichment

`response-mapper.ts` nově obsahuje:
- Stitching summary v `suggestedNextSteps` (duplicitní suppression, thread grouping info)
- Case binding v2 warning při `multiple_case_candidates` nebo `weak_case_candidate`
- Handoff-specific zpráva při `no_action_archive_only` s handoff doporučením

---

## Nové soubory

| Soubor | Popis |
|--------|-------|
| `image-intake/stitching.ts` | Multi-image stitching v1 |
| `image-intake/review-handoff.ts` | AI Review handoff boundary v1 |
| `__tests__/image-intake-phase4.test.ts` | Phase 4 testy (39 test cases) |
| `docs/image-intake-phase4.md` | Tato dokumentace |

## Upravené soubory

| Soubor | Co se změnilo |
|--------|--------------|
| `image-intake/feature-flag.ts` | +stitching flag, +handoff flag, `getImageIntakeFlagSummary()` |
| `image-intake/types.ts` | +Phase 4 typy (stitching, case binding v2, handoff) |
| `image-intake/binding-v2.ts` | +case/opportunity binding v2 (DB lookup, toCaseBindingResult) |
| `image-intake/orchestrator.ts` | Wire Phase 4 (stitching, case binding v2, handoff) |
| `image-intake/planner.ts` | +`buildActionPlanV3` |
| `image-intake/response-mapper.ts` | Stitching summary + case binding warnings + handoff messaging |
| `image-intake/index.ts` | Exporty nových Phase 4 modulů |
| `__tests__/image-intake-phase3.test.ts` | +db mock (server-only fix) |

---

## Cost guardrails

1. **Stitching: nulové model cally** — čistá hash + metadata heuristika
2. **Duplikáty jsou odstraněny před classifier/multimodal passem** — žádné duplicate vision cally
3. **Handoff detection reusuje classification + extraction output** — žádný nový model call
4. **Case binding: max 1 DB query** (LIMIT 5) — žádný rekurzivní lookup
5. **Text-only flow nedotčen** — stitching se volá jen pro multi-image requesty s image intake flagem ON
6. **Handoff je advisory** — AI Review workflow se nespouští ani nenásobí cally

---

## Test pokrytí — Phase 4

### Stitching guardrails (13 tests)
- Exaktní duplikáty potlačeny ✓
- Near-duplikáty (size+resolution similarity) ✓
- Různé MIME typy nejsou near-duplicate ✓
- Komunikační screenshoty → grouped_thread ✓
- Platební screenshoty → grouped_related ✓
- Různé typy → standalone (neslučovat) ✓
- Supporting/reference → vždy standalone ✓
- Unrelated → standalone (nespojovat) ✓
- Duplicate assets: žádné duplicate action proposals ✓

### Case binding v2 (7 tests)
- Active session context → bound_from_active_context ✓
- UI context (activeOpportunityId) → bound ✓
- Bez klienta → unresolved ✓
- Prázdný DB lookup → unresolved ✓
- 1 DB výsledek → bound_from_strong_lookup ✓
- 2+ DB výsledků → multiple_case_candidates (no auto-pick) ✓
- Bez dostatečné evidence → confidence 0 ✓

### AI Review handoff (8 tests)
- Contract-like document → recommended ✓
- Communication screenshot → NEVER handoff ✓
- Payment screenshot → NEVER handoff ✓
- Unusable image → NEVER handoff ✓
- Supporting reference → NEVER handoff ✓
- Flag OFF → handoffReady=false i při signálech ✓
- Orientation summary v preview ✓
- Null classification → no handoff ✓

### Golden dataset guardrails (6 tests)
- GD1: Unrelated images neslučovat ✓
- GD2: Duplicate images → žádné duplicate proposals ✓
- GD3: Review-like doc → ne client_message_update ✓
- GD4: Communication screenshot → ne AI Review ✓
- GD5: Bez evidence → žádný confident case binding ✓
- GD6: Multiple candidates → žádný auto-pick ✓

---

## Co zůstává do Fáze 5

1. **Long-thread conversation reconstruction** — vícedenní sled konverzací, ne jen batch-level stitching
2. **Advanced case/opportunity signal extraction** — explicitní jméno příležitosti v obrazci
3. **Auto-attach workflow** — po potvrzení advisora
4. **AI Review handoff payload contract** — strukturovaný předávací paket do AI Review lane
5. **Per-user allowlist rollout** — user-level (ne jen env-level) gating
6. **Eval replay harness expansion** — golden dataset pro Phase 4 scénáře s reálnými fixtures
7. **Batch multimodal optimization** — grouped_thread set zpracovat v jednom multimodal callu
8. **Mixed upload UX** — advisory pre-screen UI ("najdu 2 různé typy obrázků, chcete zpracovat separátně?")
