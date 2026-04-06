# AI Assistant Stage 5 Acceptance

Date: 2026-04-02

## Backtest run

Command:

```sh
cd apps/web && npx vitest run src/lib/ai/__tests__/assistant-evals.test.ts src/lib/ai/__tests__/assistant-mortgage-scenario.test.ts src/lib/ai/__tests__/assistant-persistence.test.ts
```

Result:

- `3/3` test files passed
- `26/26` tests passed

## Acceptance gate

### Phase 7: conversation persistence and cross-channel safety

Status: accepted for the current implemented assistant slice.

Closed:

- Conversation state is persisted in `assistant_conversations` and `assistant_messages`.
- The latest resumable `executionPlanSnapshot` is restored back into session on chat hydrate.
- `lockedContactId` is restored via `lockAssistantClient()`, which also restores `activeClientId`.
- API response carries `contextState` and `executionState` for client awareness and warning UX.

Residual limits:

- Only the active persisted execution plan snapshot is resumed; there is no broader execution ledger reconciliation.
- Conversation persistence is sufficient for current canonical flow, not a full replacement for the larger rebuild plan's execution trail ambitions.

### Phase 8: web/mobile parity and confirmation-first UX

Status: accepted for the current implemented assistant slice.

Closed:

- Web drawer and mobile both render `executionState` and `contextState`.
- Web drawer and mobile both expose explicit confirmation CTA for `awaiting_confirmation` via `Ano` / `Ne`.
- Mobile suggested actions are now interactive instead of passive badges.
- Mobile entity references support navigation for `contact`, `client`, `task`, `review`, and `opportunity`.

Residual limits:

- There is still no shared presentational component for the execution state badge/cards.
- The stale-state problem is mitigated operationally by rendering only the latest assistant turn's confirmation CTA, but there is still no explicit `responseKind` or `isCurrentPlanResponse` contract.
- Editable pre-confirmation action cards and richer partial-failure UI from the original rebuild vision are still outside current scope.

### Phase 9: evals and regressions

Status: accepted for the current targeted assistant backtest, not for the full original rebuild scope.

Closed:

- Eval suite is green for the current targeted assistant packages.
- Mortgage write regression remains green.
- Persistence helper coverage exists for execution-plan snapshot normalization and resumable-state gating.
- Existing evals still cover permission and safety basics already present in `assistant-evals.test.ts`.

Out of current scope:

- Document attach -> classify -> review -> publish end-to-end scenarios from the rebuild plan.
- Client portal request/message/notification orchestration scenarios from the rebuild plan.
- Explicit idempotence regression for repeated canonical prompts.
- Partial failure and rollback reporting coverage at the broader rebuild-plan level.
- Full role/permission matrix for every new canonical write action envisioned by the rebuild plan.

## Review against the original rebuild plan

Explicitly closed from the Stage 5 acceptance perspective:

- Phase 7 goals needed for persisted resume and cross-channel context safety in the current implementation slice.
- Phase 8 goals needed for confirmation-first UX parity between drawer and mobile in the current implementation slice.
- Phase 9 minimal acceptance gate that the current targeted assistant suites are green.

Explicitly still outside scope versus `ai_poradensky_asistent_rebuild_acf207f0.plan.md`:

- Phase 5 document assistant and portfolio publish workflow as a complete assistant orchestration surface.
- Phase 6 client portal bridge, requests, messages, and notification workflow as a complete assistant orchestration surface.
- The broader rebuild-plan ambition around unified `execution_actions` ledger and full audit-backed orchestration.
- Product playbooks beyond the currently implemented flows.

## Conclusion

Stage 5 is accepted for the implemented consolidation scope of phases 7-9.

The broader rebuild plan is not fully complete; the remaining gaps are mainly the larger document, portal, and execution-ledger surfaces that were not part of this consolidation pass.
