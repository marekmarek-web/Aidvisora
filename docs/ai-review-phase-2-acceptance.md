# AI Review — Fáze 2 acceptance (PR checklist)

Před mergem změn dotýkajících se extrakce, aliasů, quality gates nebo advisor UI spusťte:

```bash
cd apps/web && pnpm test:ai-review-phase2-regression
```

Skript pokrývá:

- **2F fixtures** — `phase-2-review-regression.test.ts` (datumy, modelace vs finální smlouva, platby s čárkou, mapování UI, advisor brief).
- **Legacy modelace** — `legacy-insurance-proposal-envelope.test.ts`.
- **Quality gates** — `quality-gates.test.ts` (včetně platby z `extractedFields` bez `debug.*`).
- **Investment backtest** — `investment.backtest.test.ts` (kalkulačka).
- **Sentry (assistant)** — `assistant-sentry.test.ts`.

Volitelně celý balík asistenta:

```bash
cd apps/web && pnpm test:assistant-regression
```
