# AI Photo / Image Intake — Phase 1: Foundation

## Co je AI Photo / Image Intake

Samostatná capability AI asistenta pro zpracování obrazových vstupů (fotky, mobilní scany, screenshoty komunikace, platební / bankovní screenshoty, obecné obrázky).

**Není** to rozšíření AI Review (PDF/smluvní pipeline).  
**Není** to druhý AI asistent ani paralelní write engine.

## Jak se liší od AI Review

| Aspekt | AI Review | Image Intake |
|--------|-----------|--------------|
| Vstup | PDF / dokumenty | fotky, screenshoty, mobilní scany |
| Cíl | hluboká dokumentová analýza + extraction | operativní pochopení vstupu → CRM next step |
| Pipeline | `contract-understanding-pipeline` / V2 pipeline | `image-intake/orchestrator` |
| LLM routing | `routing.category: "ai_review"` | budoucí routing přes image intake lane |
| Write engine | vlastní draft actions → apply flow | **reuse** canonical action surface |

## Lane entrypoint

```
apps/web/src/lib/ai/image-intake/
├── types.ts          # Všechny doménové typy, enums, kontrakty
├── preflight.ts      # Levná validace, kvalita, dedupe
├── guardrails.ts     # Bezpečnostní pravidla lane
├── orchestrator.ts   # Orchestrace + preview mapper
└── index.ts          # Public API barrel
```

Hlavní entrypoint: `processImageIntake(request, session)` v `orchestrator.ts`.

## Input types (taxonomie vstupů)

| Typ | Popis |
|-----|-------|
| `screenshot_client_communication` | WhatsApp, SMS, Messenger, e-mail screenshoty |
| `photo_or_scan_document` | mobilní scan, fotka papíru |
| `screenshot_payment_details` | QR, platební pokyny, účty |
| `screenshot_bank_or_finance_info` | bankovní transakce, zůstatky |
| `supporting_reference_image` | referenční screenshoty, ceníky, podklady |
| `general_unusable_image` | nerelevantní, nepoužitelné obrázky |
| `mixed_or_uncertain_image` | kombinované / nejasné vstupy |

## Output modes

| Mode | Popis |
|------|-------|
| `client_message_update` | klientská komunikace → task / note / reply |
| `structured_image_fact_intake` | platba / banka / scan → strukturovaná fakta |
| `supporting_reference_image` | reference / podklad → attach / archive |
| `ambiguous_needs_input` | nejasné → žádost o upřesnění |
| `no_action_archive_only` | nepoužitelné → jen archiv |

## Hard guardrails (vynucené vždy)

1. **LANE_VIOLATION** — screenshot klientské komunikace NESMÍ být routován do AI Review
2. **BINDING_VIOLATION** — write-ready plán BEZ jistého klienta je blokován → downgrade na `ambiguous_needs_input`
3. **STRUCTURE_VIOLATION** — supporting/reference image NESMÍ být tlačen do strukturovaných akčních polí
4. **ACTION_VIOLATION** — image intake smí navrhovat jen povolené kanonické intenty (NE AI Review akce)
5. **PREVIEW_VIOLATION** — veškeré write akce MUSÍ projít preview/confirm flow

## Co je hotové v této fázi

- [x] Všechny doménové typy a kontrakty (`types.ts`)
- [x] 7 input types, 5 output modes, 3 lane decisions, 4 binding states
- [x] Evidence model, fact bundle placeholder, action plan contract
- [x] Preflight: MIME validace, size limit, quality heuristika, dedup hash
- [x] Guardrails: 5 tvrdých bezpečnostních pravidel s automatickým downgrade
- [x] Orchestrátor s plným pipeline skeleton (stub classifikace/extraction pro Phase 2)
- [x] Preview mapper → reuse existujících `StepPreviewItem` a `ExecutionPlan`
- [x] Client/case binding z session kontextu
- [x] Trace model pro audit / replay
- [x] 49 unit testů pokrývajících typy, preflight, guardrails a orchestraci
- [x] Dokumentace

## Co je záměrně odloženo do dalších fází

### Fáze 2 — Classifier + router
- Model-based klasifikace obrázků (nahradí Phase 1 stub)
- Routing decision s reálnou confidence
- Integration do chat route API (`/api/ai/assistant/chat`)

### Fáze 3 — Multimodal extraction
- Multimodal LLM extraction faktů z obrázků
- Evidence-backed fact model s confidence
- Normalizace dat (datum, částka, účet, telefon)

### Fáze 4 — Client binding engine
- CRM lookup matching pro signály z obrázku
- Candidate ranking a conflict UI

### Fáze 5 — Action planner
- Model-based action planning
- Reply drafting
- Output mode intelligence

### Fáze 6 — Preview / confirm UI integrace
- Image intake preview card v draweru
- Editability rules
- Confirm handlers

### Fáze 7 — Multi-image stitching
- Thread reconstruction z více screenshotů
- Cross-image dedup a merge

### Fáze 8 — Golden dataset + evals
- Produkční golden dataset
- Replay harness
- Release gate

## Reuse strategie

| Existující systém | Jak image intake reusuje |
|-------------------|--------------------------|
| Assistant orchestration | `processImageIntake` vrací `ExecutionPlan` kompatibilní s `executePlan` |
| Canonical action surface | `IMAGE_INTAKE_ALLOWED_INTENTS` + `IMAGE_INTAKE_ALLOWED_WRITE_ACTIONS` |
| Preview/confirm flow | `mapToPreviewItems` → `StepPreviewItem[]` |
| Write adapters | žádný nový write engine — reuse `assistant-write-adapters` |
| Session/context | reuse `AssistantSession`, `lockAssistantClient` |
| Context safety | kompatibilní s `verifyWriteContextSafety` |
| Telemetry | připraveno pro `logAssistantTelemetry` rozšíření |

## Architektonická rozhodnutí

1. **Žádný nový write engine** — image intake produkuje `ExecutionPlan`, který jde přes existující `executePlan` + write adapters
2. **Žádná mini AI Review** — image lane nikdy nespustí contract understanding pipeline
3. **Safe defaults** — bez klassifikátoru (Phase 1) je výchozí output `ambiguous_needs_input`
4. **Guardrails first** — bezpečnostní pravidla jsou zavedena PŘED tím, než existuje skutečný classifikátor
