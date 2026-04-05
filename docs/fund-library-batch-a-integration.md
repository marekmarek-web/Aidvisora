# Batch A — integrace reálných dat do fondové knihovny

Datum: 2026-04-05.

## Co je v repozitáři

- **Surový seed** (beze změny faktů oproti přiloženému zdroji): [`apps/web/src/lib/analyses/financial/fund-library/base-funds-batch-a.seed.ts`](../apps/web/src/lib/analyses/financial/fund-library/base-funds-batch-a.seed.ts) — export `BATCH_A_SEED_ROWS`.
- **Mapování do `BaseFund`**: [`base-funds-batch-a.ts`](../apps/web/src/lib/analyses/financial/fund-library/base-funds-batch-a.ts) — `mapBatchASeedRowToBaseFund`, `BATCH_A_BASE_FUNDS`.
- **Sloučený katalog**: [`base-funds.ts`](../apps/web/src/lib/analyses/financial/fund-library/base-funds.ts) — `BASE_FUNDS` = Batch A + placeholdery.

## Canonical klíče (Batch A)

| Klíč | Produkt |
|------|---------|
| `ishares_core_msci_world` | iShares Core MSCI World |
| `ishares_core_sp_500` | iShares Core S&P 500 |
| `vanguard_ftse_emerging_markets` | Vanguard FTSE Emerging Markets |
| `ishares_core_global_aggregate_bond` | iShares Core Global Aggregate Bond |

## Legacy / aliasy (beze změny chování aplikace)

- V [`legacy-fund-key-map.ts`](../apps/web/src/lib/analyses/financial/fund-library/legacy-fund-key-map.ts) zůstává mapování `ishares`, `world_etf`, `msci_world` → `ishares_core_msci_world`.
- `alternative`, `algoimperial`, `imperial` zůstávají v **removed** sadě — nepřidáváno zpět.
- **Staré product keys v uložených analýzách** (`ishares`, `fidelity2040`, `conseq`, …) se v runtime stále nepřevádějí automaticky; převod přes `mapLegacyFundKey` je připraven pro další fázi.

## Asset cesty

- Seed uvádí cílové cesty (`/logos/funds/*.svg`, `/report-assets/funds/...`). Soubory nemusí v repu fyzicky být — katalog je jen drží jako řetězce.
- Helper [`resolveFundLogoPath`](../apps/web/src/lib/analyses/financial/fund-library/helpers.ts) vrací cestu nebo prázdný řetězec (žádný crash buildu).

## Kde data zatím „žijí“ jen v katalogu

- Investiční krok wizardu (`StepStrategy.tsx`) stále čte `FUND_DETAILS` / `FUND_LOGOS` z `financial/constants.ts`.
- HTML/PDF report (`report.ts`, sekce `portfolio`, `product-detail`, …) stále používá legacy `productKey` + `FUND_DETAILS`.
- `fa-plan-items.ts` ukládá raw `productKey` bez názvu z knihovny.

Další fáze: přepojení lookupů na `getBaseFundByKey(mapLegacyFundKey(...))` a migrace uložených klíčů.

## Pole v `BaseFund` (Batch A)

Naplněno ze seedu: `officialPerformance`, `planningRate`, `parameters`, `topHoldings`, `countries`, `sectors`, `sources` (včetně `landing_page`), `assetTodo`, `notes`, dále identifikátory a editoriální texty (`goal`, `strategy`, …).

`performance` (`FundPerformanceSnapshot` s numerickými výnosy) zůstává u Batch A `null` — numerická pole nejsou ve zdroji jako čísla.
