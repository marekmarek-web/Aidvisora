# Release checklist — F2 (Wave B, opravný plán)

Krátký checklist před releasem související s **release gates** a regresemi z F2. Plné pokrytí asistenta zůstává v `pnpm --filter web test:assistant-regression`.

## Asistent (AI)

- [ ] `pnpm --filter web test:f2-wave-b-release-gate` — P0: sanitizer, drift klienta, partial failure, degradovaný ledger, fingerprint
- [ ] `pnpm --filter web test:assistant-regression` — Phase 3 gate + replay + H7 + sanitizer + Sentry

## AI review

- [ ] `pnpm --filter web test:ai-review-phase4-regression` (nebo novější fáze dle aktivní větve)

## Klientský portál

- [ ] `pnpm --filter web test:client-portal-phase5-6-regression`

## Smlouvy / publish

- [ ] Dokumentovat / ověřit manuálně publish flow dle `docs/ai-review-publish-flow.md` po větších změnách v `contract-review` akcích

## Databáze

- [ ] Na prostředích s asistentem musí existovat tabulka `execution_actions` (migrace `packages/db/migrations/add_execution_actions.sql`). Bez ní běží zápisy v degradovaném režimu (bez idempotence v DB).
