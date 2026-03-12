# Kalkulačky – přestavba na interní CRM režim (Aidvisora)

## 1. Co bylo odstraněno z webové/prodejní vrstvy

- **CalculatorHero** – velký gradientový hero s titulkem, podtitulkem a badge na všech čtyřech kalkulačkách.
- **Sekce `bg-[#EAF3FF] pt-28 pb-[280px]`** – landing-page obal; odstraněn, obsah je v jednotném shellu.
- **CalculatorCtaBlock** – CTA bloky („Chcete návrh?“, „Chci nezávaznou nabídku“ atd.) na Life, Mortgage, Pension, Investment.
- **CalculatorFaqSection** – FAQ sekce na Life a Investment.
- **LifeCtaCards, PensionCtaCards, MortgageCtaCards, InvestmentCtaSection** – křížové odkazy na jiné kalkulačky a webové CTA.
- **Contact modály a jejich otevírání** – `LifeContactModal`, `MortgageContactModal`, `PensionContactModal`, `InvestmentContactModal` a veškerý state/handlery (`modalOpen`, `onCtaPrimary`, `onCtaClick`, `onCtaCheck`, `onCtaProposal`, `onRequestOffer`).
- **Tlačítka CTA v result panelech** – v CRM režimu se do panelů nepředávají CTA handlery, takže tlačítka („Chci řešení na míru“, „Chci investiční plán“, „Chci nezávaznou nabídku“, „Chci tento plán nastavit“) se nevykreslují.
- **CalculatorInfoCard** – dlouhé informační texty na všech kalkulačkách; odstraněny, popis je v subtitle headeru.
- **MortgageBankOffers – tlačítko „Chci nabídku“** – v CRM režimu se `onRequestOffer` nepředává, tlačítko se nevykresluje (tabulka nabídek zůstává).
- **Prodejní copy** – texty typu „Telefon je volitelný“, „Kliknutím získáte nezávaznou konzultaci“, „rád vám pomohu“ atd. odstraněny nebo nejsou zobrazeny.

## 2. Co zůstalo jako jádro kalkulaček

- **Všechna výpočetní logika** v `apps/web/src/lib/calculators/` – beze změny (engines, backtest, formatters, constants, config).
- **Input panely** – LifeInputPanel, MortgageInputPanel, PensionInputPanel, InvestmentInputPanel; MortgageProductSwitcher, MortgageTabSwitcher; InvestmentStrategySwitcher (přesunut z hero do těla stránky).
- **Results panely** – LifeResultsPanel, PensionResultsPanel, MortgageResultsPanel, InvestmentResultsPanel (bez CTA tlačítek v CRM režimu).
- **Grafy** – LifeRiskChart; InvestmentGrowthChart, InvestmentAllocationChart, InvestmentBacktestChart.
- **MortgageBankOffers** – tabulka nabídek bank; tlačítko „Chci nabídku“ jen když je předán `onRequestOffer` (v CRM režimu není).
- **Validace vstupů, popisky, footnote u výsledků** (např. „Výpočet je orientační“, „Výpočet předpokládá 7 % p.a.“) – ponechány.

## 3. Jak byly kalkulačky sjednoceny do Aidvisora stylu

- **Shell** – `CalculatorPageShell` používá stejný kontejner jako portál: `max-w-[1600px] mx-auto space-y-6 p-4 sm:p-6` (ekvivalent ListPageShell).
- **Header** – nová komponenta `CalculatorPageHeader`: h1 `text-2xl md:text-3xl font-bold text-slate-900`, volitelný subtitle `text-sm text-slate-500` (žádný gradient, žádný hero).
- **Pozadí** – odstraněno `bg-[#EAF3FF]`; stránky používají běžnou content oblast portálu.
- **Layout** – na všech kalkulačkách: header → grid (vstupy vlevo, výsledky vpravo) → grafy/dodatečné výstupy; kompaktní, bez dlouhého scrollu.
- **MortgageBankOffers** – karty nabídek: `rounded-[var(--wp-radius-sm)] border border-slate-200 shadow-sm`, nadpisy `text-slate-900`.
- **Investment backtest** – obalení karty: `rounded-[var(--wp-radius-sm)] border border-slate-200 shadow-sm`.
- **Mobile** – zachován floating result panel dole u Life, Mortgage, Pension (bez CTA).

## 4. Shared změny pro CRM/internal mode

- **CalculatorPageHeader.tsx** (nový) – CRM styl headeru pro kalkulačky (title + optional subtitle).
- **CalculatorPageShell.tsx** – výchozí `maxWidth="max-w-[1600px]"`, třídy `space-y-6 p-4 sm:p-6` pro sjednocení s portálem.
- **LifeResultsPanel** – `onCtaPrimary` a `onCtaCheck` optional; bez nich se nevykreslují CTA tlačítka ani text „Kliknutím získáte nezávaznou konzultaci“.
- **InvestmentResultsPanel** – `onCtaClick` optional; bez něj se nevykresluje CTA a související footnote.
- **MortgageResultsPanel** – `onCtaClick` optional; bez něj se nevykresluje CTA.
- **MortgageBankOffers** – `onRequestOffer` optional; bez něj se nevykresluje tlačítko „Chci nabídku“.
- **PensionResultsPanel** – `onCtaPrimary` optional; bez něj se nevykresluje tlačítko „Chci tento plán nastavit“.

Komponenty CalculatorCtaBlock, CalculatorFaqSection, *ContactModal, *CtaCards, InvestmentCtaSection, InvestmentFaqSection zůstaly v repozitáři (pro případný budoucí web mode), v kalkulačkách se již nevolají.

## 5. Seznam vytvořených / změněných souborů

**Vytvořeno:**
- `apps/web/src/app/portal/calculators/_components/core/CalculatorPageHeader.tsx`
- `docs/CHANGELOG-calculators-crm-mode.md`

**Upraveno:**
- `apps/web/src/app/portal/calculators/_components/core/CalculatorPageShell.tsx`
- `apps/web/src/app/portal/calculators/_components/life/LifeCalculatorPage.tsx`
- `apps/web/src/app/portal/calculators/_components/life/LifeResultsPanel.tsx`
- `apps/web/src/app/portal/calculators/_components/investment/InvestmentCalculatorPage.tsx`
- `apps/web/src/app/portal/calculators/_components/investment/InvestmentResultsPanel.tsx`
- `apps/web/src/app/portal/calculators/_components/mortgage/MortgageCalculatorPage.tsx`
- `apps/web/src/app/portal/calculators/_components/mortgage/MortgageResultsPanel.tsx`
- `apps/web/src/app/portal/calculators/_components/mortgage/MortgageBankOffers.tsx`
- `apps/web/src/app/portal/calculators/_components/pension/PensionCalculatorPage.tsx`
- `apps/web/src/app/portal/calculators/_components/pension/PensionResultsPanel.tsx`

**Neměněno (logika):**
- `apps/web/src/lib/calculators/**` – výpočty, formatters, config, engines, backtest, charts.

## 6. Potvrzení zachování logiky

- V `lib/calculators/` nebyl měněn žádný soubor.
- Vstupy a výstupy (state, result, projection, offers) zůstaly stejné.
- Změny jsou pouze v UI: odstranění hero/FAQ/CTA/contact modálů, nový header a shell, volitelné CTA v panelech a v MortgageBankOffers.
