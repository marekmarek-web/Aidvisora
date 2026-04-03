# Agent entrypoints

Stručný seznam míst, kde má smysl **začít číst kód** při typických úkolech. Cílem je snížit náhodné procházení celého stromu.

## Vždy zkontrolovat

| Kontext | Cesta |
|---------|--------|
| Root skripty a workspace | `package.json`, `pnpm-workspace.yaml` |
| CI | `.github/workflows/ci.yml` |
| Lint (web) | `apps/web/eslint.config.mjs`, `apps/web/package.json` (`lint`, `lint:report`) |

## Podle tématu

### Autentizace a session

- `apps/web/src/lib/auth/` (a související middleware / layout guardy podle route).

### Klientský portál

- `apps/web/src/app/client/` — stránky a layout.
- `apps/web/src/lib/client-portal/` — session bundle, routing notifikací, mobile SPA cesty.

### Smlouvy a AI review

- `apps/web/src/lib/ai-review/`, `apps/web/src/lib/ai/` (publish bridge, quality gates).
- Akce: `apps/web/src/app/actions/contract-review.ts` a okolní `actions/`.

### Dokumenty a zpracování

- `apps/web/src/lib/documents/` včetně `processing/`.

### Databáze

- `packages/db` — schéma, migrace (`migrations/` nebo ekvivalent dle struktury balíčku).

### Observability (Phase 6H)

- `apps/web/src/lib/observability/portal-sentry.ts` — notification, request reply, attachment, publish guard, auth guard failures.
- `apps/web/src/lib/observability/contract-review-sentry.ts` — AI review apply + payment gate.
- `apps/web/src/lib/observability/assistant-sentry.ts` — AI assistant API errors.

### Regression testy

- `apps/web/src/lib/client-portal/__tests__/phase-6f-phase5-6-release-gate.test.ts` — 7 mandatory release scenarios.
- Run: `pnpm --filter web test:client-portal-phase5-6-regression`
- Run (observability only): `pnpm --filter web test:phase6h-observability`
- **F2 Wave B (assistant P0 gate):** `apps/web/src/lib/ai/__tests__/assistant-f2-wave-b-release-gate.test.ts` — únik do UI, drift klienta, partial failure, chybějící `execution_actions`, fingerprint duplicit.
- Run: `pnpm --filter web test:f2-wave-b-release-gate` (viz [release-checklist-f2-wave-b.md](./release-checklist-f2-wave-b.md))

## Dokumentace pro lidi

- [repo-map.md](./repo-map.md)
- [source-of-truth.md](./source-of-truth.md)
- [SOURCES-OF-TRUTH.md](./SOURCES-OF-TRUTH.md)
- [client-portal-flow.md](./client-portal-flow.md) — Phase 5/6 client portal end-to-end
- [ai-review-publish-flow.md](./ai-review-publish-flow.md) — AI review → CRM publish guard

## Lokální kořen projektu

Aktuální kanonický klon je u maintainera typicky pod `Developer/Aidvisora` (viz plány v repo); vždy upřednostni **lokální stav** před dohadem z veřejného GitHubu.
