# Release gate (F9) — Aidvisora web

Jednotná **regression brána** před releasem CRM / AI Review / portálu. Žádná vazba na konkrétní PDF nebo anchor dokument — testy jsou obecné scénáře a policy invarianty.

## Verdikt

| Stav | Podmínka |
|------|----------|
| **GREEN (release-ready pro tuto vrstvu)** | `pnpm test:f9-release-gate` končí exit code **0** z repo kořene nebo `apps/web`. |
| **RED (hard fail)** | Jakýkoli fail ve výše uvedeném příkazu. Release **ne**. |
| **YELLOW (soft warning)** | Volitelné kontroly níže — nesmí blokovat automaticky, ale měly by být vyřešeny před produkčním nasazením kritických změn. |

## Co spustit před releasem (pořadí)

1. **Povinné — hard fail**
   ```bash
   pnpm test:f9-release-gate
   ```
   Z kořene monorepa, nebo:
   ```bash
   cd apps/web && pnpm test:f9-release-gate
   ```

2. **Doporučené — kvalita kódu**
   ```bash
   pnpm --filter web lint
   ```
   ESLint chyby = typicky **hard fail** v CI; `--quiet` v `package.json` potlačuje warningy, ne errors.

3. **Doporučené — build**
   ```bash
   pnpm --filter web build
   ```

4. **Volitelné — soft warning / manuální hloubka**
   - Živý golden eval (nákladné, může volat API): `pnpm --filter web eval:golden-live`
   - Anchor debug (nákladné, může volat modely / dlouhý běh): `pnpm debug:anchors` nebo `pnpm debug:anchors:core` — **není** součástí `test:f9-release-gate`; spouští se před major releasem nebo při podezření na regresi v extrakci.
   - E2E: `pnpm --filter web test:e2e` (pokud je Playwright nakonfigurován v CI)

## Co gate pokrývá (mapování oblastí)

| Oblast | Primární soubory ve `test:f9-release-gate` |
|--------|---------------------------------------------|
| Final freeze + pending + supporting + mobile parity (F6–F8) | `phase-18-final-freeze-gate.test.ts` |
| Kvalita | `quality-gates.test.ts` |
| Lifecycle gates | `quality-gates-lifecycle.test.ts` |
| Sémantika dokumentu | `contract-semantic-understanding.test.ts` |
| Type mapper | `ai-review-type-mapper.test.ts` |
| Alias / normalizace polí | `extraction-field-alias-normalize.test.ts` |
| Extrakce — envelope parse / coerce | `envelope-parse-coerce.test.ts` |
| Apply před validace (extrakční gate před zápisem) | `pre-apply-validation.test.ts` |
| Platby (sync) | `phase-3-payment-sync-regression.test.ts` |
| Apply / idempotence / merge (F3) | `apply-contract-review-f3-slice12.test.ts`, `apply-contract-review-f3-slice345.test.ts` |
| Kontakt — completeness + pending | `contact-identity-completeness-guard.test.ts` |
| Smlouva — pending / supporting guard | `contract-pending-fields-guard.test.ts` |
| Provenance identity polí (F7 sdílená vrstva) | `contact-identity-field-provenance.test.ts` |
| Klientský portál / projekce | `phase-5-client-portal-bridge-regression.test.ts` |
| Prefill kontaktu ze review | `contact-wizard-prefill-from-ai-review.test.ts` |

## No-loss invarianty (nesmí se tichým způsobem ztratit)

Gate kontroluje **logikou v testech**, ne produkční DB:

- Provenance rozlišení (confirmed / auto_applied / pending / manual) na úrovni policy a UI logiky.
- Pending confirm nejde na pole s `manual_required` / `do_not_apply` tam, kde to testy zakazují.
- Supporting dokumenty mají guard proti plnému contract confirm toku.
- Apply vrstva: idempotence a merge policy pokryté F3 testy (ne end-to-end proti živé DB v této sadě).

## Blocker vs. warning (shrnutí)

| Typ | Příklad |
|-----|---------|
| **Hard fail** | `test:f9-release-gate` fail, `lint` error, `build` fail |
| **Soft warning** | `eval:golden-live` neproveden lokálně, E2E nepuštěné, anchor debug jen na vzorku |

---

*Poslední aktualizace: F9 — final regression suite + release readiness.*
