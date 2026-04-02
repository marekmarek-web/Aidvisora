# Fáze 0–1: Audit entrypointů a mapa kanonického toku (Aidvisora)

Tento dokument plní **Fázi 0** (repo audit / mapa rozhodovacích a write cest) a **Fázi 1** (kanonický orchestration pipeline oproti souborům v repu) z master plánu `master_plan_faze2_hardening_evals_9f6c2e1a.plan.md`. Neřeší ještě Fázi 2B+ (context safety hardening, idempotence napříč všemi cestami).

## Fáze 0 — Entrypointy a persistence

### HTTP API (poradce)

| Route | Účel |
|-------|------|
| `POST /api/ai/assistant/chat` | Hlavní chat orchestrace (legacy vs canonical), SSE volitelně `?stream=1`. Soubor: `apps/web/src/app/api/ai/assistant/chat/route.ts`. |
| `POST /api/ai/assistant/draft-email` | Samostatný návrh e-mailu. |
| `GET/POST …/dashboard-summary` | Shrnutí dashboardu (související read-only tok). |
| `POST /api/ai/client-assistant/chat` | Samostatná cesta pro klientského asistenta (jiný produktový surface). |

### Klient → server payload

- Tělo: `message`, `sessionId`, `activeContext`, `channel`, `orchestration` / `useCanonicalOrchestration`.
- Korelace (Fáze 2A): klient může poslat `x-trace-id` nebo se použije `x-request-id` / nový UUID; odpověď obsahuje `x-trace-id` a `x-assistant-run-id`.

### In-memory session

- `apps/web/src/lib/ai/assistant-session.ts` — `getOrCreateSession`, TTL mapa, context lock (`lockedClientId`, …).

### DB persistence konverzace

- Tabulky: `assistant_conversations`, `assistant_messages` (schema v `packages/db/src/schema/assistant-conversations.ts`).
- Repository: `apps/web/src/lib/ai/assistant-conversation-repository.ts` — hydratace locku, `loadResumableExecutionPlanSnapshot`, append zpráv.

### Write a audit dnes

- Canonical writes: `apps/web/src/lib/ai/assistant-execution-engine.ts` + `execution_actions` ledger (`packages/db/src/schema/execution-actions.ts`).
- Legacy mortgage bundle: `apps/web/src/lib/ai/assistant-crm-writes.ts`.
- Paralelní AI actions: `apps/web/src/lib/ai/actions/action-executors.ts` (mimo hlavní chat route, ale relevantní pro budoucí sjednocení).
- Centrální audit: `apps/web/src/lib/audit.ts` → `audit_log`.

### UI surfaces

- Web drawer: `apps/web/src/app/portal/AiAssistantDrawer.tsx`.
- Mobile: `apps/web/src/app/portal/mobile/screens/AiAssistantChatScreen.tsx`.
- HTTP klient: `apps/web/src/lib/ai/assistant-chat-client.ts`.

## Fáze 1 — Kanonický tok (canonical pipeline)

Následující posloupnost platí pro `orchestration: "canonical"` v `route.ts` → `routeAssistantMessageCanonical` v `assistant-tool-router.ts`.

```text
1. POST /api/ai/assistant/chat
2. runWithAssistantRunStore(traceId, assistantRunId, …)     [2A telemetry kontext]
3. Hydratace DB: locked client, channel, mode
4. loadResumableExecutionPlanSnapshot → session.lastExecutionPlan (resume)
5. routeAssistantMessageCanonical(message, session, activeContext)
   a) Pokud plán awaiting_confirmation:
      - "ano" → confirmAllSteps → executePlan → verified response
      - "ne" → zrušení plánu
   b) updateSessionContext + lock z activeClientId
   c) extractCanonicalIntent(message)
   d) READ_ONLY intent → fallback routeAssistantMessage (legacy chat/tools)
   e) resolveEntities(tenantId, intent, session)
   f) Hypo mortgage bundle větev → executeMortgageDealAndFollowUpTask (verified CRM)
   g) buildExecutionPlan →
      - 0 kroků → fallback legacy chat
      - má requires_confirmation → návrh + session.lastExecutionPlan
      - jinak confirmAllSteps + executePlan + verified result
6. Sestavení executionState / contextState v route
7. upsertConversationFromSession + appendConversationMessage (user + assistant)
8. logAudit assistant.conversation_message (+ trace IDs v meta)
```

### Legacy tok (`orchestration: "legacy"`)

`routeAssistantMessage`: `extractAssistantIntent` → případně mortgage CRM write → jinak LLM + `[TOOL:…]` orchestrace v jedné odpovědi.

## Mezery vůči cíli Fáze 2 (celku)

- Dvě write cesty (mortgage bundle vs `execution_actions` + adapters) zatím nejsou plně sjednocené.
- Telemetry Fáze 2A pokrývá hlavní milníky; per-step tool volání v legacy větvi nejsou jednotně instrumentovaná.
- Další fáze master plánu (2B–2H) doplní context safety, idempotenci všude, verified UI contract a release gate.

## Související implementace Fáze 2A

- `apps/web/src/lib/ai/assistant-run-context.ts` — AsyncLocalStorage kontext běhu.
- `apps/web/src/lib/ai/assistant-telemetry.ts` — `assistant.*` audit akce bez PII a bez raw promptu.
