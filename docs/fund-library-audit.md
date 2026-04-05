# Audit: investiční fondy ve Finanční analýze (stav před fondovou knihovnou)

Datum: 2026-04-05. Účel: jednorázový přehled před zavedením modulu `apps/web/src/lib/analyses/financial/fund-library/`.

## 1. Kde je dnes „katalog“ fondů

| Zdroj | Popis |
|--------|--------|
| [`apps/web/src/lib/analyses/financial/constants.ts`](../apps/web/src/lib/analyses/financial/constants.ts) | `FUND_DETAILS` (factsheet-like texty, sazby, obrázky), `FUND_LOGOS` |
| [`apps/web/src/lib/analyses/financial/formatters.ts`](../apps/web/src/lib/analyses/financial/formatters.ts) | `PRODUCT_NAMES`, `getProductName()` — zkrácené názvy pro UI/grafy |

Žádný jiný centralizovaný registr product keys v projektu neexistuje; `InvestmentEntry.productKey` je volný `string` v [`types.ts`](../apps/web/src/lib/analyses/financial/types.ts).

## 2. Product keys v `FUND_DETAILS` / `FUND_LOGOS` (aktuální)

`creif`, `atris`, `penta`, `ishares`, `alternative`, `fidelity2040`, `conseq`

## 3. Default / seed investice (`productKey`)

| Soubor | Poznámka |
|--------|----------|
| [`financial/defaultState.ts`](../apps/web/src/lib/analyses/financial/defaultState.ts) | 9 řádků včetně `alternative` |
| [`company-fa/defaultState.ts`](../apps/web/src/lib/analyses/company-fa/defaultState.ts) | 8 řádků, **bez** `alternative` |
| [`company-fa/importValidate.ts`](../apps/web/src/lib/analyses/company-fa/importValidate.ts) | stejné jako company default |

**Nekonzistence:** osobní FA má navíc `alternative`, firemní ne — při budoucí unifikaci klíčů sjednotit.

## 4. Legacy klíče

| Klíč | Chování |
|------|---------|
| `imperial`, `algoimperial` | Při parsování uložené analýzy se **vyfiltrují** z `investments` v [`saveLoad.ts`](../apps/web/src/lib/analyses/financial/saveLoad.ts). V `FUND_DETAILS` už nejsou. |
| `alternative` | Stále v `defaultState`, `FUND_DETAILS`, `PRODUCT_NAMES` — aktivní produkt v nových analýzách, dokud ho nepřepojíme/migrujeme. |
| `world_etf` | V kódu **není** explicitně; očekává se jako budoucí alias → canonical `ishares_core_msci_world` (viz `legacy-fund-key-map.ts`). |

## 5. Nekonzistence názvů (příklad)

- `FUND_DETAILS.ishares.name`: **iShares Core MSCI World**
- `PRODUCT_NAMES.ishares`: **iShares MSCI World ETF**

Cíl: po přepojení jeden `displayName` z fondové knihovny (canonical: jednotně Core MSCI World).

## 6. Soubory používající fondy / `productKey` / report

### Report HTML / sekce

- [`financial/report.ts`](../apps/web/src/lib/analyses/financial/report.ts) — tabulka investic, loga, product cards
- [`financial/report/helpers.ts`](../apps/web/src/lib/analyses/financial/report/helpers.ts) — `getProductDisplayName`
- [`financial/report/sections/portfolio.ts`](../apps/web/src/lib/analyses/financial/report/sections/portfolio.ts)
- [`financial/report/sections/product-detail.ts`](../apps/web/src/lib/analyses/financial/report/sections/product-detail.ts)
- [`financial/report/sections/sidebar.ts`](../apps/web/src/lib/analyses/financial/report/sections/sidebar.ts)
- [`financial/report/sections/company-portfolio.ts`](../apps/web/src/lib/analyses/financial/report/sections/company-portfolio.ts)
- [`financial/report/sections/goals.ts`](../apps/web/src/lib/analyses/financial/report/sections/goals.ts), [`projection.ts`](../apps/web/src/lib/analyses/financial/report/sections/projection.ts), [`print-and-interactive.ts`](../apps/web/src/lib/analyses/financial/report/print-and-interactive.ts) — agregace `investments` (nepřímo závislé na `productKey` pro výpočty)

### Wizard / UI

- [`StepStrategy.tsx`](../apps/web/src/app/portal/analyses/financial/components/steps/StepStrategy.tsx) — `FUND_DETAILS`, `FUND_LOGOS`, hardcoded vazba cíle na `"ishares"` + `monthly`

### Store / data

- [`financial/store.ts`](../apps/web/src/lib/analyses/financial/store.ts) — `updateInvestment(productKey, …)`
- [`financial/saveLoad.ts`](../apps/web/src/lib/analyses/financial/saveLoad.ts) — load + filtr legacy
- [`financial/charts.ts`](../apps/web/src/lib/analyses/financial/charts.ts) — `getProductName` pro labely

### Firemní analýza / výstupy

- [`StepCompanyBenefitsRisks.tsx`](../apps/web/src/app/portal/analyses/company/components/steps/StepCompanyBenefitsRisks.tsx) — zobrazení `productKey`
- [`CompanyAnalysisShell.tsx`](../apps/web/src/app/portal/analyses/company/components/CompanyAnalysisShell.tsx) — zobrazení `productKey`
- [`buildCompanyReportHTML.ts`](../apps/web/src/lib/analyses/output/buildCompanyReportHTML.ts) — escape `productKey` v tabulce

### CRM / plán

- [`fa-plan-items.ts`](../apps/web/src/app/actions/fa-plan-items.ts) — `itemKey` a `label` = raw `productKey` (bez lidského názvu)

## 7. Chybějící fondy oproti canonical v1 (15 base)

V `FUND_DETAILS` **nejsou**: iShares Core S&P 500, Vanguard FTSE Emerging Markets, iShares Core Global Aggregate Bond, Investika realitní, Monetika, Efektika, NN (tři profily). Ty jsou zatím jen placeholdery ve `fund-library/base-funds.ts`.

## 8. TODO — pozdější přepojení (mimo fázi 1)

1. Wizard (`StepStrategy`): seznam produktů ze knihovny + canonical `productKey` (nebo oddělený `variantKey`).
2. `constants.ts` / `formatters.ts`: buď generovat z knihovny, nebo thin adapter; odstranit duplicitní názvy.
3. Report sekce: resolvovat legacy klíč přes `mapLegacyFundKey` před lookupem v `FUND_DETAILS`, později přes data knihovny.
4. `fa-plan-items`: `itemKey` / `label` z canonical názvu nebo mapy.
5. Company FA: sjednotit default investice s osobní FA po rozhodnutí o `alternative`.
6. Migrace uložených JSON analýz: přepsat staré `productKey` na canonical (včetně `ishares` → `ishares_core_msci_world`).
7. **Teprve potom** bezpečně odstranit `alternative` z `defaultState` a `FUND_DETAILS` (ne dřív — riziko pro staré reporty a uložená data).

Fáze 1 **nemění** výše uvedené toky — pouze přidává audit a izolovaný modul `fund-library`.
