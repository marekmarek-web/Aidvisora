# Audit: investiční fondy ve Finanční analýze (stav před fondovou knihovnou)

Datum: 2026-04-05. Účel: jednorázový přehled před zavedením modulu `apps/web/src/lib/analyses/financial/fund-library/`.

> **Aktualizace po execute plánu (2026-04-05+):** Osobní FA `getDefaultInvestments()` vrací `[]` — nová analýza neinjektuje starý hardcoded seznam. `alternative` není v `FUND_DETAILS` / default investicích; legacy klíče řeší `legacy-fund-key-map.ts` + testy v `fund-library/__tests__/`. Historické řádky § 2–3 níže popisují stav *před* návaznou prací — pro současný deploy viz [`fund-library-deploy.md`](fund-library-deploy.md).

## 1. Kde je dnes „katalog“ fondů

| Zdroj | Popis |
|--------|--------|
| [`apps/web/src/lib/analyses/financial/constants.ts`](../apps/web/src/lib/analyses/financial/constants.ts) | `FUND_DETAILS` (factsheet-like texty, sazby, obrázky), `FUND_LOGOS` |
| [`apps/web/src/lib/analyses/financial/formatters.ts`](../apps/web/src/lib/analyses/financial/formatters.ts) | `PRODUCT_NAMES`, `getProductName()` — zkrácené názvy pro UI/grafy |

Žádný jiný centralizovaný registr product keys v projektu neexistuje; `InvestmentEntry.productKey` je volný `string` v [`types.ts`](../apps/web/src/lib/analyses/financial/types.ts).

## 2. Product keys v `FUND_DETAILS` / `FUND_LOGOS` (aktuální)

`creif`, `atris`, `penta`, `ishares`, `fidelity2040`, `conseq` *(legacy `constants.ts`; kanonická metadata v `fund-library` batch seeds — `alternative` v `FUND_DETAILS` už není)*

## 3. Default / seed investice (`productKey`)

| Soubor | Poznámka |
|--------|----------|
| [`financial/defaultState.ts`](../apps/web/src/lib/analyses/financial/defaultState.ts) | *Historicky:* více řádků včetně `alternative`. *Nyní:* prázdné `investments[]` + test `__tests__/defaultState.test.ts`. |
| [`company-fa/defaultState.ts`](../apps/web/src/lib/analyses/company-fa/defaultState.ts) | Výchozí řádky s kanonickým `ishares_core_msci_world` (viz soubor) |
| [`company-fa/importValidate.ts`](../apps/web/src/lib/analyses/company-fa/importValidate.ts) | stejné jako company default |

**Nekonzistence (vyřešeno pro nové osobní FA):** výchozí investice osobní FA jsou prázdné; firemní FA má explicitní seed řádky — sjednocení chování wizardu řeší fondová knihovna / produktové rozhodnutí.

## 4. Legacy klíče

| Klíč | Chování |
|------|---------|
| `imperial`, `algoimperial` | Při parsování uložené analýzy se **vyfiltrují** z `investments` v [`saveLoad.ts`](../apps/web/src/lib/analyses/financial/saveLoad.ts). V `FUND_DETAILS` už nejsou. |
| `alternative` | Z výchozího stavu **odstraněno**; při načtení uložených dat se vyfiltruje / nemapuje (viz `legacy-fund-key-map.ts`, `normalize-persisted-investment-entries`). |
| `world_etf` / `World ETF` | Alias → `ishares_core_msci_world` v `legacy-fund-key-map.ts` + testy. |

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

V `FUND_DETAILS` **stále nejsou** ETF nad rámec MSCI World jako samostatné product keys. Ve **fund-library** mají čtyři ETF (MSCI World, S&P 500, FTSE EM, Global Aggregate Bond) reálná data z Batch A seedu (`base-funds-batch-a.seed.ts`); viz [`docs/fund-library-batch-a-integration.md`](fund-library-batch-a-integration.md). Investika, Monetika, Efektika a NN trojice zůstávají placeholdery v `base-funds.ts`.

## 8. TODO — pozdější přepojení (mimo fázi 1)

1. Wizard (`StepStrategy`): seznam produktů ze knihovny + canonical `productKey` (nebo oddělený `variantKey`).
2. `constants.ts` / `formatters.ts`: buď generovat z knihovny, nebo thin adapter; odstranit duplicitní názvy.
3. Report sekce: resolvovat legacy klíč přes `mapLegacyFundKey` před lookupem v `FUND_DETAILS`, později přes data knihovny.
4. `fa-plan-items`: `itemKey` / `label` z canonical názvu nebo mapy.
5. Company FA: sjednotit default investice s osobní FA po rozhodnutí o `alternative`.
6. Migrace uložených JSON analýz: přepsat staré `productKey` na canonical (včetně `ishares` → `ishares_core_msci_world`).
7. **Teprve potom** bezpečně odstranit `alternative` z `defaultState` a `FUND_DETAILS` (ne dřív — riziko pro staré reporty a uložená data).

Fáze 1 **nemění** výše uvedené toky — pouze přidává audit a izolovaný modul `fund-library`.

## 9. Aktualizace: datová vrstva katalogu (2026-04-05+)

- **Centrální vstup:** [`apps/web/src/lib/analyses/financial/fund-library/index.ts`](../apps/web/src/lib/analyses/financial/fund-library/index.ts) (re-export z `@/lib/analyses/financial` přes [`financial/index.ts`](../apps/web/src/lib/analyses/financial/index.ts)).
- **Model:** `BaseFund` (včetně `baseFundKey`, `availability`, `planningRate`, `officialPerformance`, `factsheetUrl`, `factsheetAsOf`, `verifiedAt`, `assets`) + `FundVariant` (`variantKey` u variant nad stejným base).
- **Investiční `productKey` dál** v `InvestmentEntry` a defaultech viz § 2–3; zpětná kompatibilita: `mapLegacyFundKey` / `getBaseFundFromProductKey` vrací `null` / `undefined` pro `alternative` a AlgoImperial bez výjimky.
- **World ETF:** mezery v řetězci se normalizují (`World ETF` → `world_etf` → `ishares_core_msci_world`), viz `normalizeLegacyFundKeyInput` v [`legacy-fund-key-map.ts`](../apps/web/src/lib/analyses/financial/fund-library/legacy-fund-key-map.ts).
- **Helpery:** `getBaseFundByKey`, `getFundVariantByKey`, `getFundsByCategory`, `getFundsByAvailability`, `getBaseFundFromProductKey`, `getBaseFundsList`, `getVariantsForBaseFund`.
- **Natvrdo v aplikaci (beze změny této fáze):** `FUND_DETAILS` / `FUND_LOGOS`, `defaultState` investice, `StepStrategy` vazba na `"ishares"`, report sekce — přepojení až v další fázi.
