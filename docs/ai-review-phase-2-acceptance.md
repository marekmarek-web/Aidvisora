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

---

## Fáze 3 — platební sync, publish bridge, Sentry

Po změnách v `payment-field-contract`, `draft-actions` (regenerace platby), `apply-contract-review`, advisor `paymentSyncPreview` nebo `contract-review` server actions spusťte:

```bash
cd apps/web && pnpm test:ai-review-phase3-regression
```

Skript pokrývá:

- **3F payment sync** — `phase-3-payment-sync-regression.test.ts` (finální smlouva, úpravy účtu/VS v raw payloadu, modelace, dedicated payment instruction, `resolvePaymentSetupClientVisibility`).
- **Quality gates** — `quality-gates.test.ts` (platby z `extractedFields`, payment_instructions route).
- **Investment backtest** — `investment.backtest.test.ts`.
- **Sentry (assistant)** — `assistant-sentry.test.ts`.
- **Sentry (contract review apply / payment gate)** — `contract-review-sentry.test.ts`.

Při selhání zápisu do CRM nebo blokaci gate se do Sentry posílají breadcrumbs / `captureMessage` (`contract-review-sentry.ts`, volání z `applyContractReviewDrafts`).
