# Image Intake Diagnostic Report

**Generated:** 2026-04-08 (v2 — post TOP-3 fix implementation)  
**Suite:** image-intake-diagnostic  
**Scope:** AI Photo / Image Intake — decision flow audit  
**Method:** Static code analysis + deterministic unit test harness (43 tests, 43 passed)  
**Report files:**  
- `docs/image-intake-diagnostic-report.md` (tento soubor)  
- `docs/image-intake-diagnostic-report.json` (strojově čitelná verze)

---

## Implementované fixy (v2)

| Fix | Soubor | Popis | Severity před | Severity po |
|---|---|---|---|---|
| **Fix 1** | `planner.ts → resolveOutputMode()` | `screenshot_client_communication` nyní dostane `client_message_update` PŘED binding check. Binding ovlivní jen akce (attach pouze pro bound klient), ne outputMode. | blocker | low ✅ |
| **Fix 2** | `planner.ts → buildActionPlanV1 ambiguous_needs_input case` | `create_internal_note` přidán jako safe fallback bez `contactId`. Poradce má vždy alespoň jedno tlačítko. | blocker / high | medium ✅ |
| **Fix 3** | `planner.ts → buildActionPlanV4 supporting_reference_set` | `createInternalNote` vždy přidán — i když je přítomen `attachDocumentToClient`. Attach-only výsledek eliminován. | high | low ✅ |

---

## Severity legend

| Severity | Meaning |
|---|---|
| **blocker** | Produktová feature nefunguje vůbec nebo generuje špatný výstup ve standardním use-case |
| **high** | Výrazná degradace UX nebo nesprávný decision v časté situaci |
| **medium** | Suboptimální chování, obchůzka existuje |
| **low** | Technický dluh, internalizované varování |

---

## Test case results

### A) IMAGE / DOCUMENT ROUTING

---

#### A01 — Single communication screenshot, no active client

| Pole | Hodnota |
|---|---|
| **caseId** | `COMM_NO_CLIENT_01` |
| **inputType** | `screenshot_client_communication` |
| **imageCount** | 1 |
| **hasActiveClientContext** | false |
| **expectedBehavior** | `client_message_update` s nabídkou "Uložit zprávu jako poznámku" (i bez klienta) |
| **actualBehavior** | ✅ **FIXED (Fix 1)** `client_message_update` — `create_internal_note` + `create_task` nabídnuty; `attach_document` správně vynechán (binding chybí) |
| **chosenLane** | `image_intake` |
| **classifierCategory** | `screenshot_client_communication` |
| **outputMode** | `client_message_update` |
| **bindingResult** | `insufficient_binding` |
| **reviewHandoffCandidate** | false |
| **proposedActions** | `create_internal_note`, `create_task` |
| **disabledActions** | `attach_document` (správně — bez klienta) |
| **disabledReasons** | `planClientMessageUpdate` přidává attach pouze pro `bound_client_confident` |
| **guardrailsTriggered** | G2 `BINDING_VIOLATION` → downgrade plánu; note a task jsou safe, write blocker pass |
| **routeDecisionReason** | `resolveOutputMode` → `screenshot_client_communication` → `client_message_update` (Fix 1: binding check přesunut ZA inputType) |
| **responseMapperPath** | `buildIntakeMessage` → case `client_message_update` |
| **genericFallbackUsed** | false |
| **rootCauseHypothesis** | ✅ Opraveno. Binding check byl před inputType check — nyní přesunut za. |
| **severity** | ~~blocker~~ → **low** ✅ |
| **recommendedFixArea** | — (implementováno) |

---

#### A02 — Single communication screenshot, with active client

| Pole | Hodnota |
|---|---|
| **caseId** | `COMM_WITH_CLIENT_02` |
| **inputType** | `screenshot_client_communication` |
| **imageCount** | 1 |
| **hasActiveClientContext** | true |
| **expectedBehavior** | `client_message_update` s nabídkou poznámky, úkolu a přiložení |
| **actualBehavior** | ✅ `client_message_update` — `create_internal_note` + `create_task` + `attach_document` |
| **outputMode** | `client_message_update` |
| **bindingResult** | `bound_client_confident` |
| **proposedActions** | `create_internal_note`, `create_task`, `attach_document` |
| **guardrailsTriggered** | žádné |
| **genericFallbackUsed** | false |
| **rootCauseHypothesis** | Funguje správně — ale závisí 100% na existenci aktivního klienta |
| **severity** | low |
| **recommendedFixArea** | — |

---

#### A03 — Single document-like image, no active client

| Pole | Hodnota |
|---|---|
| **caseId** | `DOC_NO_CLIENT_03` |
| **inputType** | `photo_or_scan_document` |
| **imageCount** | 1 |
| **hasActiveClientContext** | false |
| **expectedBehavior** | `ambiguous_needs_input` s nabídkou minimálně "uložit bez klienta" |
| **actualBehavior** | ✅ **FIXED (Fix 2)** `ambiguous_needs_input` — `create_internal_note` nabídnuto jako safe fallback |
| **outputMode** | `ambiguous_needs_input` |
| **bindingResult** | `insufficient_binding` |
| **proposedActions** | `create_internal_note` (unlinked — bez contactId) |
| **disabledActions** | `attach_document` (správně) |
| **disabledReasons** | `planStructuredFactIntake` přidává `attach_document` pouze pro `bound_client_confident` |
| **guardrailsTriggered** | žádné |
| **genericFallbackUsed** | false |
| **rootCauseHypothesis** | ✅ Opraveno. `ambiguous_needs_input` nyní vždy zahrnuje `create_internal_note`. |
| **severity** | ~~high~~ → **medium** ✅ |
| **recommendedFixArea** | — (implementováno) |

---

#### A04 — Front+back identity document, no active client

| Pole | Hodnota |
|---|---|
| **caseId** | `IDENTITY_NO_CLIENT_04` |
| **inputType** | `photo_or_scan_document` |
| **imageCount** | 2 |
| **hasActiveClientContext** | false |
| **expectedBehavior** | `identity_contact_intake` — návrh nového kontaktu z dokladu |
| **actualBehavior** | `ambiguous_needs_input` z planner perspective; identity_contact_intake lze dosáhnout jen přes orchestrátor |
| **outputMode** | `ambiguous_needs_input` (planner) / `identity_contact_intake` (orchestrator — pokud multimodal extrahuje identitu a binding je bez session) |
| **bindingResult** | `insufficient_binding` |
| **proposedActions** | [] (z planner); `createContact` + `attachDocumentToClient` (z orchestrator identity override) |
| **guardrailsTriggered** | žádné |
| **routeDecisionReason** | `detectIdentityContactIntakeSignals` v orchestrátoru (step 12) přepisuje planner output PODMÍNĚNĚ — vyžaduje multimodal pass aby získal identity fakty |
| **responseMapperPath** | `buildIntakeMessage` → case `identity_contact_intake` → "Připravil jsem návrh nového klienta" |
| **genericFallbackUsed** | false |
| **rootCauseHypothesis** | Identity path funguje — ale ZÁVISÍ na multimodal pass (feature flag). Bez multimodalního průchodu jsou identity fakta prázdná → `detectIdentityContactIntakeSignals` vrátí false → planner zůstane na `ambiguous_needs_input`. |
| **severity** | **high** |
| **recommendedFixArea** | `image-intake-config.ts` + `feature-flag.ts`: zkontrolovat zda je multimodal povolen pro tenant; bez multimodalu se identity intake nikdy nespustí |

---

#### A05 — Front+back identity document, active client MISMATCH

| Pole | Hodnota |
|---|---|
| **caseId** | `IDENTITY_ACTIVE_MISMATCH_05` |
| **inputType** | `photo_or_scan_document` |
| **imageCount** | 2 |
| **hasActiveClientContext** | true |
| **activeClientName** | `Marek Marek` |
| **expectedBehavior** | Identity intake s upozorněním na mismatch; `suppressedActiveClientId` k dispozici pro CTA |
| **actualBehavior** | ✅ orchestrátor resetuje binding na `insufficient_binding` se `source: "identity_context_mismatch"` a zachová `suppressedActiveClientId` → response-mapper přidá CTA "Otevřít kartu klienta" |
| **outputMode** | `identity_contact_intake` (identity plan je postaven před mismatch check; mismatch jen resetuje clientBinding) |
| **bindingResult** | `insufficient_binding` (po mismatch reset), `suppressedActiveClientId: "client-marek"` |
| **guardrailsTriggered** | `BINDING_VIOLATION` je filtrována v response-mapperu pro identity mode |
| **routeDecisionReason** | `identityDocumentLikelyMatchesActiveContact` → `verdict === "mismatch"` → `clientBinding` reset |
| **responseMapperPath** | `buildIntakeMessage` → identity mode → routeMismatch=true → "Doklad vypadá na jinou osobu..." |
| **genericFallbackUsed** | false |
| **rootCauseHypothesis** | Logika funguje správně. Potenciální problém: `identityDocumentLikelyMatchesActiveContact` používá token overlap — může být nepřesné pro složená jména |
| **severity** | medium |
| **recommendedFixArea** | `identity-active-context-mismatch.ts` — zvážit normalizaci jmen (háčky, diakritika, pořadí tokenů) |

---

#### A06 — Front+back identity document, active client MATCHES

| Pole | Hodnota |
|---|---|
| **caseId** | `IDENTITY_ACTIVE_MATCH_06` |
| **inputType** | `photo_or_scan_document` |
| **imageCount** | 2 |
| **hasActiveClientContext** | true |
| **expectedBehavior** | `identity_contact_intake` nebo upozornění, že doklad patří ke stávajícímu klientovi |
| **actualBehavior** | ✅ `identity_contact_intake` plán s `createContact` + `attachDocumentToClient`; G2 guardrail exemptován pro identity mode |
| **outputMode** | `identity_contact_intake` |
| **bindingResult** | `bound_client_confident` |
| **guardrailsTriggered** | žádné (G2 skips identity mode) |
| **genericFallbackUsed** | false |
| **rootCauseHypothesis** | Funguje správně. Ale pokud doklad patří ke stávajícímu klientovi (match), stále se navrhuje `createContact` — duplicitní klient? |
| **severity** | medium |
| **recommendedFixArea** | `orchestrator.ts` step 12-14: když match → nenavrhovat createContact, ale pouze attach k existujícímu klientovi |

---

#### A07 — Multi-image document set (supporting_reference_set)

| Pole | Hodnota |
|---|---|
| **caseId** | `MULTI_IMG_DOCSET_07` |
| **inputType** | `photo_or_scan_document` |
| **imageCount** | 4 |
| **hasActiveClientContext** | true |
| **expectedBehavior** | `supporting_reference_image` s nabídkou `attach_document` + `create_internal_note` |
| **actualBehavior** | ✅ **FIXED (Fix 3)** `supporting_reference_image` — `attach_document` + `create_internal_note` vždy přítomny |
| **outputMode** | `supporting_reference_image` |
| **documentSetResult** | `supporting_reference_set` |
| **proposedActions** | `attach_document`, `create_internal_note` |
| **guardrailsTriggered** | žádné |
| **genericFallbackUsed** | false |
| **rootCauseHypothesis** | ✅ Opraveno. V4 nyní vždy přidá `createInternalNote` — attach-only výsledek eliminován. |
| **severity** | ~~high~~ → **low** ✅ |
| **recommendedFixArea** | — (implementováno) |

---

#### A08 — Mixed set (communication screenshot + document image)

| Pole | Hodnota |
|---|---|
| **caseId** | `MIXED_SET_08` |
| **inputType** | `mixed_or_uncertain_image` |
| **imageCount** | 2 |
| **hasActiveClientContext** | true |
| **expectedBehavior** | Zpracování obou typů nebo alespoň ambiguous s nápovědou |
| **actualBehavior** | ✅ **PARTIALLY FIXED (Fix 2)** `ambiguous_needs_input` — nyní s `create_internal_note` fallback |
| **outputMode** | `ambiguous_needs_input` |
| **bindingResult** | `bound_client_confident` |
| **proposedActions** | `create_internal_note` |
| **guardrailsTriggered** | žádné |
| **routeDecisionReason** | `resolveOutputMode`: `mixed_or_uncertain_image` → stále `ambiguous_needs_input`; Fix 2 přidal note fallback |
| **genericFallbackUsed** | false |
| **rootCauseHypothesis** | `mixed_or_uncertain_image` s bound klientem dává jen poznámku — bez attach. Stitching by měl lépe rozdělit smíšené sady. Částečně vyřešeno — advisor má alespoň jednu akci. |
| **severity** | ~~high~~ → **medium** ✅ |
| **recommendedFixArea** | `planner.ts` → `resolveOutputMode`: `mixed_or_uncertain` + `bound_client_confident` → uvážit i `attach_document` jako safe default (další fáze) |

---

#### A09 — Low confidence classification (< 0.5)

| Pole | Hodnota |
|---|---|
| **caseId** | `LOW_CONFIDENCE_09` |
| **inputType** | `photo_or_scan_document` |
| **imageCount** | 1 |
| **confidence** | 0.42 |
| **hasActiveClientContext** | true |
| **expectedBehavior** | `ambiguous_needs_input` — správné chování |
| **actualBehavior** | ✅ `ambiguous_needs_input` |
| **outputMode** | `ambiguous_needs_input` |
| **guardrailsTriggered** | žádné |
| **genericFallbackUsed** | false |
| **rootCauseHypothesis** | Správné chování. Threshold 0.5 pro globální ambiguous je rozumný. |
| **severity** | low |
| **recommendedFixArea** | — |

---

#### A10 — Unsupported / unusable image

| Pole | Hodnota |
|---|---|
| **caseId** | `UNUSABLE_IMAGE_10` |
| **inputType** | `general_unusable_image` |
| **imageCount** | 1 |
| **expectedBehavior** | `no_action_archive_only` |
| **actualBehavior** | ✅ `no_action_archive_only` — nulové akce |
| **outputMode** | `no_action_archive_only` |
| **proposedActions** | [] |
| **responseMapperPath** | `buildIntakeMessage` → case `no_action_archive_only` → "Na obrázku jsem nenašel použitelné CRM informace." |
| **genericFallbackUsed** | false |
| **severity** | low |
| **recommendedFixArea** | — |

---

### B) CONTEXT / BINDING

---

#### B11 — Active client context wins correctly

| Pole | Hodnota |
|---|---|
| **caseId** | `ACTIVE_CLIENT_WINS_11` |
| **hasActiveClientContext** | true |
| **bindingResult** | `bound_client_confident` (source: `ui_context`) |
| **actualBehavior** | ✅ `client_message_update` s attach propozicí |
| **outputMode** | `client_message_update` |
| **severity** | low |

---

#### B12 — Active client context downgraded (identity mismatch)

| Pole | Hodnota |
|---|---|
| **caseId** | `DOC_ACTIVE_MISMATCH_12` |
| **hasActiveClientContext** | true |
| **activeClientName** | `Marek Marek` |
| **bindingResult** | `insufficient_binding` (source: `identity_context_mismatch`) |
| **actualBehavior** | ✅ binding resetován; `suppressedActiveClientId` zachován pro CTA |
| **outputMode** | `ambiguous_needs_input` |
| **severity** | low |

---

#### B13 — Missing client context → ambiguous_needs_input

| Pole | Hodnota |
|---|---|
| **caseId** | `MISSING_CONTEXT_13` |
| **hasActiveClientContext** | false |
| **expectedBehavior** | `ambiguous_needs_input` + `suggestedNextStepItems` s `focus_composer` |
| **actualBehavior** | ✅ `ambiguous_needs_input`; response-mapper přidává `{kind: "focus_composer"}` |
| **outputMode** | `ambiguous_needs_input` |
| **responseMapperPath** | `mapImageIntakeToAssistantResponse` → `suggestedNextStepItems.push({label: "...", kind: "focus_composer"})` |
| **severity** | low |

---

#### B14 — Multiple client matches → ambiguous

| Pole | Hodnota |
|---|---|
| **caseId** | `MULTIPLE_CANDIDATES_14` |
| **bindingResult** | `multiple_candidates` |
| **actualBehavior** | ✅ `ambiguous_needs_input` — žádné write actions |
| **outputMode** | `ambiguous_needs_input` |
| **severity** | low |

---

#### B15 — Weak candidate → ambiguous

| Pole | Hodnota |
|---|---|
| **caseId** | `WEAK_CANDIDATE_15` |
| **bindingResult** | `weak_candidate` |
| **actualBehavior** | ✅ `ambiguous_needs_input` |
| **outputMode** | `ambiguous_needs_input` |
| **severity** | low |

---

#### B16 — Household ambiguous case

| Pole | Hodnota |
|---|---|
| **caseId** | `HOUSEHOLD_AMBIGUOUS_16` |
| **hasActiveClientContext** | true |
| **householdResult** | `household_ambiguous` |
| **expectedBehavior** | Plan upraven nebo upozornění na household ambiguitu |
| **actualBehavior** | Plan je `client_message_update` (neovlivněn); household stav přidán jen jako `suggestedNextSteps` varování v mapper |
| **outputMode** | `client_message_update` |
| **routeDecisionReason** | Household binding NEOVLIVŇUJE outputMode ani proposedActions — je pouze additivní kontext v response-mapperu |
| **rootCauseHypothesis** | Pokud je household_ambiguous, advisor dostane plán s jedním klientem bez explicitní indikace, že akce může být nesprávně přiřazena. Household warning je v `suggestedNextSteps` — snadno přehlédnutelné. |
| **severity** | medium |
| **recommendedFixArea** | `planner.ts` nebo `orchestrator.ts`: `household_ambiguous` by měl downgrade-ovat binding na `ambiguous_needs_input` stejně jako `multiple_candidates` |

---

#### B17 — Unknown client (source: none)

| Pole | Hodnota |
|---|---|
| **caseId** | `UNKNOWN_CLIENT_17` |
| **bindingResult** | `insufficient_binding` (source: `none`) |
| **actualBehavior** | ✅ `ambiguous_needs_input` |
| **severity** | low |

---

#### B18 — Multiple CRM matches

| Pole | Hodnota |
|---|---|
| **caseId** | `MULTIPLE_CRM_18` |
| **bindingResult** | `multiple_candidates` |
| **actualBehavior** | ✅ `ambiguous_needs_input`, žádné akce |
| **severity** | low |

---

### C) OUTPUT / ACTION PLANNING

---

#### C19 — Document image that should become note only

| Pole | Hodnota |
|---|---|
| **caseId** | `DOC_NOTE_ONLY_19` |
| **outputMode** | `supporting_reference_image` (přes documentSetResult=supporting_reference_set) |
| **actualBehavior** | ✅ **FIXED (Fix 3)** S bound klientem: `attachDocumentToClient` + `create_internal_note` vždy přítomny |
| **disabledActions** | — |
| **rootCauseHypothesis** | ✅ Opraveno. V4 nyní vždy přidá `createInternalNote`. |
| **severity** | ~~high~~ → **low** ✅ |

---

#### C20 — Document image → attach_to_client

| Pole | Hodnota |
|---|---|
| **caseId** | `DOC_ATTACH_20` |
| **outputMode** | `structured_image_fact_intake` |
| **actualBehavior** | ✅ `attach_document` + `create_internal_note` s bound klientem |
| **severity** | low |

---

#### C21 — Identity document → create-contact draft

| Pole | Hodnota |
|---|---|
| **caseId** | `IDENTITY_CREATE_CONTACT_21` |
| **outputMode** | `identity_contact_intake` |
| **actualBehavior** | ✅ `createContact` + `attachDocumentToClient` přes `buildIdentityContactIntakeActionPlan` |
| **executionPlanSummary** | `applyIdentityIntakeStepDependencies` nastaví `dependsOn` — attach čeká na createContact |
| **severity** | low |

---

#### C22 — Review-like doc → handoff candidate

| Pole | Hodnota |
|---|---|
| **caseId** | `REVIEW_HANDOFF_22` |
| **outputMode** | `no_action_archive_only` (pokud `handoffReady=true`) |
| **actualBehavior** | ✅ `no_action_archive_only` + note "Uložit jako orientační poznámku (AI Review doporučen)" + `AI_REVIEW_HANDOFF_RECOMMENDED` safety flag |
| **reviewHandoffCandidate** | true |
| **disabledActions** | vše kromě `createInternalNote` |
| **routeDecisionReason** | `buildActionPlanV3` → `handoffReady=true` → downgrade na `no_action_archive_only` |
| **rootCauseHypothesis** | AI Review handoff je ADVISORY ONLY — `decideLane()` v orchestrátoru vrací vždy `image_intake` (hardcoded). Advisor musí ručně odeslat do AI Review queue. |
| **severity** | medium |
| **recommendedFixArea** | Dokumentovat chování pro poradce; CTA pro "Odeslat do AI Review" by měla být explicitnější |

---

#### C23 — Action disabled when no binding (attach disabled)

| Pole | Hodnota |
|---|---|
| **caseId** | `ATTACH_DISABLED_23` |
| **outputMode** | `ambiguous_needs_input` |
| **disabledActions** | `attach_document` (správně) |
| **proposedActions** | `create_internal_note` (Fix 2) |
| **disabledReasons** | `planStructuredFactIntake` přidává attach jen pro `bound_client_confident`; note nyní vždy dostupná |
| **severity** | ~~blocker~~ → **medium** ✅ (Fix 2 přidal note fallback) |

---

#### C24 — Generic copilot fallback incorrectly used

| Pole | Hodnota |
|---|---|
| **caseId** | `GENERIC_FALLBACK_24` |
| **outputMode** | `client_message_update` (**FIXED** — Fix 1 eliminoval scénář kde comm screenshot padal do ambiguous) |
| **genericFallbackUsed** | false |
| **actualBehavior** | ✅ **FIXED (Fix 1)** `client_message_update` s note + task; žádné generické ambiguous pro communication screenshots |
| **rootCauseHypothesis** | ✅ Opraveno pro `screenshot_client_communication`. Pro ostatní typy (documents bez binding) je `ambiguous_needs_input` text stále technický — bude řešen v dalším fixu (`response-mapper.ts`). |
| **severity** | ~~high~~ → **medium** ✅ |
| **recommendedFixArea** | `response-mapper.ts` → `buildIntakeMessage` case `ambiguous_needs_input`: inputType-aware text (next fix) |

---

#### C25 — Response contains technical wording

| Pole | Hodnota |
|---|---|
| **caseId** | `TECHNICAL_WORDING_25` |
| **actualBehavior** | `whyThisAction` obsahuje "confidence 75%" a "ambiguous" — technický jazyk |
| **responseMapperPath** | `whyThisAction` → `previewPayload.summary` → zobrazeno poradci |
| **rootCauseHypothesis** | `planner.ts` → `whyThisAction()` funkce generuje interní technický text (confidence procenta, inputType kódy). Tento text se nezpracovává v `response-mapper.ts` před zobrazením. |
| **severity** | **high** |
| **recommendedFixArea** | `response-mapper.ts`: sanitizovat `whyThisAction` pro advisor-facing výstup; nebo `planner.ts`: oddělení technického a user-facing textu |

---

#### C26 — Advisor-facing response correct (identity mode)

| Pole | Hodnota |
|---|---|
| **caseId** | `ADVISOR_CORRECT_26` |
| **outputMode** | `identity_contact_intake` |
| **actualBehavior** | ✅ "Rozpoznán osobní doklad (občanka, pas nebo povolení k pobytu). Připravili jsme návrh nového klienta..." — správný advisor text |
| **severity** | low |

---

### D) COMPOSER / SEND BEHAVIOR

---

#### D27 — Paste 1 image

| Pole | Hodnota |
|---|---|
| **caseId** | `PASTE_1_IMG_27` |
| **actualBehavior** | ✅ 1 asset přijat, `truncated=false` |
| **severity** | low |

---

#### D28 — Paste 2 images

| Pole | Hodnota |
|---|---|
| **caseId** | `PASTE_2_IMG_28` |
| **actualBehavior** | ✅ 2 assets přijaty, `truncated=false` |
| **severity** | low |

---

#### D29 — Paste 5 images (> MAX_IMAGES_PER_INTAKE = 4)

| Pole | Hodnota |
|---|---|
| **caseId** | `PASTE_5_IMG_29` |
| **actualBehavior** | ✅ 4 assets přijaty, `truncated=true`; route-handler přidá warning "Nahráno více než 4 obrázky..." |
| **severity** | low |

---

#### D30 — Picker upload (no autosend)

| Pole | Hodnota |
|---|---|
| **caseId** | `PICKER_NO_AUTOSEND_30` |
| **actualBehavior** | ✅ všechny akce mají `requiresConfirmation=true` — žádné auto-execution |
| **guardrailsTriggered** | G5 (`PREVIEW_VIOLATION`) by se spustil, pokud by `requiresConfirmation=false` |
| **severity** | low |

---

#### D31 — Send with pending images only

| Pole | Hodnota |
|---|---|
| **caseId** | `SEND_PENDING_ONLY_31` |
| **actualBehavior** | ✅ všechny akce `requiresConfirmation=true`; pipeline runs, no auto-execute |
| **severity** | low |

---

#### D32 — Send with text + pending images

| Pole | Hodnota |
|---|---|
| **caseId** | `SEND_TEXT_IMG_32` |
| **actualBehavior** | ✅ `accompanyingText="smlouva..."` → `classifyByTextHints` → `photo_or_scan_document` via `DOCUMENT_TEXT_HINTS` regex |
| **severity** | low |

---

## Odpovědi na diagnostické otázky

### 1. Kdy a proč se document image rozhodne jen jako "uložit poznámku"?

Dokument se stane "note only" ve třech situacích:
- `general_unusable_image` → `no_action_archive_only` → žádná poznámka (prázdná odpověď)
- `supporting_reference_set` (multi-image) + **bez** bound klienta → `create_internal_note` fallback
- `handoffReady=true` (AI Review) → `buildActionPlanV3` → `no_action_archive_only` + pouze "Uložit jako orientační poznámku"

**Bug:** S bound klientem a `supporting_reference_set` dostane advisor jen `attach_document` — tlačítko "Uložit jako poznámku" chybí.

### 2. Kdy a proč je "Přiložit ke klientovi" disabled?

`attach_document` je navrhováno POUZE když `binding.state === "bound_client_confident" || binding.state === "bound_case_confident"`. Ve všech ostatních stavech (`insufficient_binding`, `weak_candidate`, `multiple_candidates`) není `attach_document` v plánu vůbec navrhováno.

**Technická příčina:** `planStructuredFactIntake()` (planner.ts:143-156) a `planClientMessageUpdate()` (planner.ts:114-127) přidávají attach pouze podmíněně.

### 3. Kdy a proč active client context přebije obsah dokladu?

Active client context přebíjí obsah dokladu ve `binding-v2.ts` → `bindFromSession()`:
1. `session.lockedClientId` → `bound_client_confident` (confidence 0.95) — nejvyšší priorita
2. `session.activeClientId` → `bound_client_confident` (confidence 0.80)
3. `request.activeClientId` (z UI) → `bound_client_confident` (confidence 0.70)

Až pak přichází CRM name matching z image signálů. Mismatch se kontroluje POZDĚ (orchestrátor step 14) — dokument je nejprve zpracován s nesprávným klientem.

### 4. Kdy a proč se identity document nechová jako create-contact draft?

Identity intake SELŽE ve třech scénářích:
1. **Multimodal disabled** → `detectIdentityContactIntakeSignals` dostane prázdné fakty → `false`
2. **DocumentSet=mixed/supporting/handoff** → funkce vrátí `false` (planner.ts:56-59)
3. **Confidence < 0.45** pro `id_doc_first_name` nebo `id_doc_last_name`

**Kritické:** bez multimodal pass (feature flag) identity intake NIKDY nefunguje.

### 5. Kdy a proč generic copilot fallback přebíjí specializovaný image/document flow?

Generic fallback (`routeAssistantMessageCanonical`) se spustí v `route.ts` pouze pokud:
- Není žádný image asset v requestu
- Pending resolution nedetekuje jméno klienta v textu (`looksLikeClientNameInput` → false)
- Pak padá do generic text routing

**Pokud image asset je přítomen** → vždy jde do image intake lane (ne generic fallback). Generic fallback tak NEPŘEBÍJÍ image flow za normálních okolností. ALE: zpráva z `ambiguous_needs_input` vypadá genericky a neadvisorsky — technický text bez kontextu inputType.

### 6. Kdy a proč se spouští ambiguous_needs_input?

`ambiguous_needs_input` se spustí v `resolveOutputMode` (planner.ts) při:
- `binding.state === "insufficient_binding"` (nejčastější)
- `binding.state === "multiple_candidates"` nebo `"weak_candidate"`
- `classification.inputType === "mixed_or_uncertain_image"`
- `classification.confidence < 0.5`
- `screenshot_client_communication` s `confidence < 0.65`
- `photo_or_scan_document` / payment / bank s `confidence < 0.60`

**Klíčová asymetrie:** binding check (řádky 61-67) je PŘED inputType check (řádky 77-89) — binding chyba přebije vše.

### 7. Kdy a proč se spouští review_handoff_candidate?

`evaluateReviewHandoff()` (review-handoff.ts) doporučí handoff když classifier detekuje signály:
- `contract_like_document`
- `multi_page_document_scan`
- `formal_policy_document`
- `dense_legal_text`
- `insurance_policy_attachment`

`handoffReady=true` nastane jen pokud je **feature flag `isImageIntakeReviewHandoffEnabledForUser`** zapnutý. Bez flagu je handoff jen `recommended=true` + safety flag — plán se nedowngraduje.

### 8. Jaké guardraily blokují write-ready flow?

- **G2 (BINDING_VIOLATION):** write-ready plán bez `bound_client_confident` → downgrade na `ambiguous_needs_input`
- **G4 (ACTION_VIOLATION):** intent mimo `IMAGE_INTAKE_ALLOWED_INTENTS` → stripped
- **G5 (PREVIEW_VIOLATION):** write actions bez `requiresConfirmation=true` → forced to true

G1 a G3 jsou informativní (violation string), nespouštějí downgrade.

### 9. Které response texty jsou produktově špatně?

| Mode | Problematický text | Důvod |
|---|---|---|
| `ambiguous_needs_input` | "Obrázek jsem přijal, ale potřebuji doplnění. Nepodařilo se mi bezpečně identifikovat klienta. Typ vstupu není jednoznačný." | Technický, nezohledňuje inputType |
| `structured_image_fact_intake` | "Rozpoznal jsem obrázek s dokumentem (confidence 78%)" | Procenta nepatří do advisor UI |
| `no_action_archive_only` | "Na obrázku jsem nenašel použitelné CRM informace. Obrázek lze archivovat, ale navrhovat žádnou CRM akci nemám." | Nikdy nenabídne co DĚLAT, jen co NEJDE |
| `whyThisAction` | "Vstup je nejasný (confidence 75%) nebo klient není jistě identifikován" | Technický debug text viditelný v preview |

### 10. Které konkrétní komponenty/funkce rozhodují o finálním user-facing výstupu?

```
API route.ts
  └─ handleImageIntakeFromChatRoute()      [route-handler.ts]
       └─ processImageIntake()             [orchestrator.ts]
            ├─ classifyBatch()             [classifier.ts]          → inputType, confidence
            ├─ resolveClientBindingV2()    [binding-v2.ts]          → binding state
            ├─ buildActionPlanV4()         [planner.ts]             → outputMode, actions
            │    └─ resolveOutputMode()    [planner.ts:53-90]       ← KLÍČOVÉ rozhodnutí
            ├─ detectIdentityContactIntakeSignals() [identity-contact-intake.ts]
            ├─ buildIdentityContactIntakeActionPlan() [planner.ts]  ← identity override
            └─ enforceImageIntakeGuardrails()  [guardrails.ts]      ← safety check
       └─ mapImageIntakeToAssistantResponse() [response-mapper.ts]
            └─ buildIntakeMessage()        [response-mapper.ts:27]  ← FINÁLNÍ ZPRÁVA
```

---

## Executive Summary

### Stav po implementaci TOP 3 fixů

| | Před | Po |
|---|---|---|
| **Blockers** | 2 | 0 ✅ |
| **High** | 7 | 4 |
| **Medium** | 5 | 6 |
| **Low** | 18 | 22 |

### 5 největších root causes (aktualizováno)

1. ~~**Binding-first routing v `resolveOutputMode`**~~ → ✅ **OPRAVENO (Fix 1)**

2. **Identity intake závisí na multimodal feature flagu:** bez multimodal pass jsou identity fakta prázdná → `detectIdentityContactIntakeSignals` vrátí false → identity doklady se nikdy nezpracují jako create-contact draft. Feature flag je tenant-level — pokud není explicitně zapnut, funkce neexistuje.

3. ~~**`ambiguous_needs_input` = zero akce**~~ → ✅ **OPRAVENO (Fix 2)** — `create_internal_note` vždy k dispozici

4. **Technický text v advisor UI:** `whyThisAction` obsahuje "confidence 75%", "mixed_or_uncertain_image" — interní debug jazyk zobrazený v `previewPayload.summary`. `buildIntakeMessage` pro `ambiguous_needs_input` nerozlišuje inputType.

5. ~~**`supporting_reference_set` + bound klient = ztracená note akce**~~ → ✅ **OPRAVENO (Fix 3)**

### 5 nejkritičtějších blockerů (aktualizováno)

1. ~~**[BLOCKER] Komunikační screenshot bez klienta → nulové akce** (A01, C23)~~ → ✅ VYŘEŠENO
2. ~~**[BLOCKER] Dokument bez klienta → nulové akce** (A03)~~ → ✅ VYŘEŠENO (note fallback)
3. **[HIGH] Identity intake závisí na multimodal flag** (A04): doklady totožnosti nespustí create-contact flow, pokud tenant nemá multimodal
4. **[HIGH] Mixed/uncertain image + bound klient = jen note** (A08): smíšená sada obrázků s aktivním klientem dostane jen poznámku, ne attach
5. **[HIGH] Technický text v advisor UI** (C25): `whyThisAction` obsahuje confidence % a inputType kódy

### 5 nejrychlejších zbývajících fixů s největším dopadem

1. ~~`planner.ts` → `resolveOutputMode`~~ ✅ DONE

2. ~~`planner.ts` → `buildActionPlanV1` ambiguous fallback~~ ✅ DONE

3. ~~`planner.ts` → `buildActionPlanV4` supporting_reference_set note~~ ✅ DONE

4. **`response-mapper.ts` → `buildIntakeMessage` case `ambiguous_needs_input`: inputType-aware text** — "Screenshot komunikace přijat — zadejte klienta pro uložení" místo generické technické zprávy. Žádné logic changes.

5. **`planner.ts` → `whyThisAction()`: odstranit "confidence X%"** — sanitizovat nebo oddělit technický a advisor-facing text.

---

## Root cause matrix

| Symptom | Root cause | Files / funkce | Severity | Status |
|---|---|---|---|---|
| ~~Komunikační screenshot bez klienta = nulové akce~~ | ~~Binding check fires before inputType in resolveOutputMode~~ | `planner.ts` | ~~blocker~~ | ✅ FIXED (Fix 1) |
| ~~Dokument bez klienta = nulové akce~~ | ~~`ambiguous_needs_input` case má prázdné recommendedActions~~ | `planner.ts` | ~~blocker~~ | ✅ FIXED (Fix 2) |
| ~~Note action chybí pro supporting_reference_set s bound klientem~~ | ~~V4 filtruje na attachDocumentToClient only~~ | `planner.ts` | ~~high~~ | ✅ FIXED (Fix 3) |
| Identity doklady → žádný create-contact | Identity intake závisí na multimodal pass (feature flag) | `orchestrator.ts:712-724`, `feature-flag.ts` | **high** | open |
| Technický text v UI ("confidence 75%") | `whyThisAction()` generuje debug text; mapper ho nezpracovává | `planner.ts:192-207`, `response-mapper.ts:99-111` | **high** | open |
| Mixed image set s bound klientem = jen note | `mixed_or_uncertain_image` → ambiguous; note dostupná (Fix 2), attach chybí | `planner.ts:69` | **medium** | partial |
| Household ambiguous neovlivní outputMode | Household stav přidán pouze jako additive warning, ne binding downgrade | `orchestrator.ts:654-667`, `response-mapper.ts:273-283` | medium | open |
| Review handoff je advisory bez explicitního CTA | `decideLane()` hardcoded na `image_intake`; handoff = soft recommendation | `orchestrator.ts:108-115`, `review-handoff.ts` | medium | open |
| Komunikační screenshot confidence threshold 0.65 | Prahová hodnota může být příliš vysoká pro reálné screenshoty | `planner.ts:65` | medium | open |
| Identity draft bez mismatch check navrhuje createContact na stávajícím klientovi | Match verdict → stále navrhuje createContact místo attach-only | `orchestrator.ts:727-761` | medium | open |

---

## Recommended fix order

1. ~~**`planner.ts` → `resolveOutputMode`**~~ ✅ IMPLEMENTOVÁNO (Fix 1)
2. ~~**`planner.ts` → `buildActionPlanV1` ambiguous fallback**~~ ✅ IMPLEMENTOVÁNO (Fix 2)
3. ~~**`planner.ts` → `buildActionPlanV4` supporting_reference_set note**~~ ✅ IMPLEMENTOVÁNO (Fix 3)
4. **`response-mapper.ts` → `buildIntakeMessage`:** inputType-aware text pro `ambiguous_needs_input` místo generické zprávy
5. **`planner.ts` → `whyThisAction()`:** odstranit "confidence X%" z advisor-facing textu; nebo `response-mapper.ts`: sanitize před display
6. **`feature-flag.ts` + ops:** ověřit multimodal enablement pro production tenants; dokumentovat dependency identity intake → multimodal
7. **`orchestrator.ts`:** `household_ambiguous` → zvážit downgrade binding na `weak_candidate` nebo přidat explicit ambiguity gate
8. **`orchestrator.ts` → klient/identity match path:** pokud `identityDocumentLikelyMatchesActiveContact` → match, nahradit `createContact` za attach-only plán
9. **Zkontrolovat confidence thresholds (0.65 pro comm, 0.60 pro doc):** zvážit lowering nebo model-calibration pass
10. **UI/UX:** přidat explicitní CTA "Odeslat do AI Review" do response-mapperu pro handoff mode

---

*Diagnostická sada: `apps/web/src/lib/ai/__tests__/image-intake-diagnostic.test.ts` — 43 testů, 43 passed*  
*Verze: v2 — po implementaci TOP 3 fixů (2026-04-08)*
