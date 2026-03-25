# CRM repair pass – changelog

Dokument shrnuje provedené opravy podle plánu „CRM repair pass (problém → příčina → oprava)“. U každého bodu: co bylo špatně, příčina, jak byla oprava provedena, změněné soubory.

---

## 1. Seznam opravených bodů

| # | Oblast | Stav |
|---|--------|------|
| 1.1 | Conseq – roky do důchodu, „věk 2005“, pluralizace | ✅ |
| 1.2 | Rozdělení fondů – názvy (CREIF, PENTA, ATRIS (Vklad), ETF World, Fidelity 2040, Conseq Globální) | ✅ |
| 1.3 | Přepis cíle na strategie – tlačítko „Přenést z cíle“ | ✅ |
| 1.4 | Dynamický+ – Celková FV při přepnutí profilu | ✅ |
| 1.5 | Grid produktů – loga společností (mapa + fallback) | ✅ |
| 2.1 | Zajištění – přejmenování stepu na „Zajištění“ | ✅ |
| 2.2 | Zajištění – odebrání Pojistíme.cz a HDI | ✅ |
| 2.3 | Step 3 při firmě – „FIRMA“ | ✅ |
| 3 | Převod do zápisků/úkolů – uživatelsky srozumitelné chyby | ✅ |
| 4 | Export PDF / tisk – jeden stav, try/catch, chybová hláška | ✅ |
| 5.1 | Pokrytí podle reference | ✅ (srovnáno s pokryti produktu.txt) |
| 5.2 | Segmenty – odstranění ZDRAV, NEM; sjednocení Majetek | ✅ |
| 5.3 | Partner po výběru segmentu – reset, empty stav | ✅ |
| 5.4 | Tlačítko PŘIDAT – submitError, zobrazení chyby | ✅ |
| 5.5 | Dead buttons v profilu klienta | ✅ (audit) |
| 5.6 | Loading a empty stavy v tabech | ✅ |
| 6 | FA děti – pole Sporty | ✅ |
| 7 | Sjednocení UI/UX databází (Kontakty jako vzor) | ✅ |
| 8 | Domácnosti – search a filtry | ✅ |
| 9 | Moje úkoly – Vytvořit úkol (flow ponechán) | ✅ |
| 10 | Nástěnka – KPI grid, Rychlé vstupy | ✅ |
| 11 | Audit dead buttonů | ✅ (proveden) |
| 12 | Výstup changelog | ✅ (tento dokument) |

---

## 2. Problém → příčina → oprava (vybrané)

### 1.1 Věk z birthDate, pluralizace roků
- **Problém:** „Do důchodu: 1 let (věk 2005)“; věk mohl být rokem narození.
- **Příčina:** Report používal `data.client.age`; pluralizace nebyla (1 rok / 2 roky / 5 let).
- **Oprava:** V reportu věk vždy z `getAgeFromBirthDate(data.client?.birthDate)`; v `formatters.ts` přidána `pluralizeYears(n)`; v StepStrategy zobrazení jen při platném věku a použití pluralizace.

### 1.2–1.5 Fondy, strategie, loga
- **1.2:** Názvy produktů srovnány s referencí: `PRODUCT_NAMES` (ETF World, Fidelity 2040), `getProductName(key, type)` vrací „ATRIS (Vklad)“ pro atris + lump.
- **1.3:** Přidáno tlačítko „Přenést z cíle (renta → ETF World měsíčně)“ – přenese první renta cíl do iShares měsíčně.
- **1.4:** V `setStrategyProfile` se při změně profilu nastaví všem investicím `annualRate` z `getProfileRate(profile)` a pak se volá `recalcInvestmentsFv()` – Celková FV se přepočte.
- **1.5:** V `constants.ts` přidána `FUND_LOGOS`; v StepStrategy u každé karty produktu logo (img) s fallbackem (zkratka 2 písmena).

### 2 Zajištění
- Step přejmenován na „Zajištění“ v `STEP_TITLES` a StepIncomeProtection.
- Z `INSURANCE_COMPANIES_CS` odstraněny „HDI pojišťovna“ a „Pojistíme.cz“.
- Při `includeCompany` je krok 3 v `getStepTitles` nastaven na „FIRMA“.

### 3–4 Převod zápisků/úkolů, PDF tisk
- Handlery převodu zachytávají chybu a nastavují jen uživatelsky srozumitelnou zprávu (bez raw error).
- Tisk řízen jedním stavem `printPayload`; `buildReportHTML` v try/catch; při chybě `printError`; efekt pro tisk nad `printPayload`.

### 5.2–5.6 Profil klienta
- Segmenty ZDRAV a NEM odstraněny z DB schématu a `segment-labels.ts`.
- Při změně segmentu v ContractsSection se resetují partner/product a volá se `setPickerValue`; v ProductPicker empty stav „Žádní partneři pro tento segment“.
- V ContractsSection přidán `submitError` a zobrazení chyby nad formulářem.
- Dead buttons: audit; empty/loading stavy v komponentách ověřeny.

### 6 FA děti – Sporty
- V `ChildEntry` přidáno `sports?: string`; v store při `addChild` se vytváří dítě s `sports: ""`; v StepClientInfo přidán input „Sporty“.

### 7 Sjednocení UI/UX databází
- **Analýzy:** Nový `AnalysesPageClient` – header (název + počet), search bar, primární akce „Nová analýza“, seznam uložených analýz (stejný vzor jako Kontakty).
- **Mindmap:** List view má header s počtem, search (mapy/klienti/domácnosti), tlačítko „Nová mapa“; filtrování přes `filteredMaps`, `filteredContacts`, `filteredHouseholds`.
- **Kalkulačky:** Stejný kontejner a styl nadpisu (max-w-[1600px], h1 + popis).

### 8–9 Domácnosti, Moje úkoly
- Domácnosti: search/filter bar vždy zobrazen; „Žádné výsledky“ při prázdném filtru.
- Moje úkoly: flow (scroll na formulář + odeslání tlačítkem „Vytvořit“) ponechán; createError zobrazen.

### 10 Nástěnka
- Přidán blok „Rychlé vstupy“ s odkazy: Nový klient (/portal/contacts/new), Nový úkol, Finanční analýza, Kalendář. KPI karty a widgety (Dnešní schůzky, Po termínu, Pipeline, Výročí, Servis, Poslední aktivita) a „Dnešní priority“ již existovaly.

### 11 Audit dead buttonů
- Proveden průchod formulářů a hlavních CTA v portálu; formuláře mají `onSubmit` napojené na akce. Žádné zjištěné tlačítko bez handleru v kritických flow.

---

## 3. Změněné soubory (souhrn)

**FA – logika a konstanty**
- `apps/web/src/lib/analyses/financial/report.ts`
- `apps/web/src/lib/analyses/financial/formatters.ts`
- `apps/web/src/lib/analyses/financial/incomeProtection.ts`
- `apps/web/src/lib/analyses/financial/constants.ts`
- `apps/web/src/lib/analyses/financial/store.ts`
- `apps/web/src/lib/analyses/financial/types.ts`
- `apps/web/src/lib/analyses/financial/defaultState.ts` (případně jen formatters/constants)

**FA – komponenty kroků**
- `apps/web/src/app/portal/analyses/financial/components/steps/StepStrategy.tsx`
- `apps/web/src/app/portal/analyses/financial/components/steps/StepSummary.tsx`
- `apps/web/src/app/portal/analyses/financial/components/steps/StepClientInfo.tsx`
- `apps/web/src/app/portal/analyses/financial/components/steps/StepIncomeProtection.tsx`

**FA – layout**
- `apps/web/src/app/portal/analyses/financial/components/FinancialAnalysisLayout.tsx`

**Profil klienta, smlouvy, segmenty**
- `packages/db/src/schema/contracts.ts`
- `apps/web/src/app/lib/segment-labels.ts`
- `apps/web/src/app/dashboard/contacts/[id]/ContractsSection.tsx`
- `apps/web/src/app/components/aidvisora/ProductPicker.tsx`

**Databázové přehledy (UI)**
- `apps/web/src/app/portal/analyses/page.tsx`
- `apps/web/src/app/portal/analyses/AnalysesPageClient.tsx` (nový)
- `apps/web/src/app/portal/mindmap/page.tsx`
- `apps/web/src/app/portal/calculators/page.tsx`

**Domácnosti, nástěnka**
- `apps/web/src/app/portal/households/HouseholdListClient.tsx`
- `apps/web/src/app/portal/today/DashboardEditable.tsx`

---

## 4. Co se propisuje do jiných modulů

- **Produkce:** Žádná přímá změna; segmenty bez ZDRAV/NEM mohou ovlivnit filtry/agregace, pokud se používaly.
- **Zápisky / Úkoly:** Převod z FA volá `createTask` / `createMeetingNote`; chybové hlášky jsou uživatelsky srozumitelné; po úspěchu lze rozšířit o toast nebo přesměrování.
- **Report PDF:** Tisk a export používají `buildReportHTML` a jeden tiskový stav; případné další exporty (např. e-mail) mohou využít stejný payload.

---

## 5. Backend / TODO

- **DB:** Schéma `contracts` – odstraněny segmenty ZDRAV, NEM z enumu; migrace podle použitého ORM.
- **5.1 Pokrytí (backtest):** Widget srovnán s referencí `pokryti produktu.txt`: Úvěry bez „Americké hypotéky“ (odstraněno ze zdroje v segment-hierarchy); single položky zobrazují „Nastavit“ při stavu none; rotace none → in_progress → done zachována.
- **Loga fondů:** `FUND_LOGOS` odkazuje na `/images/funds/*.svg`; obrázky je potřeba doplnit do `public/images/funds/` nebo upravit cesty/CDN.
- **Produkce za měsíc / nábory na nástěnce:** Plán zmiňuje tyto KPI; aktuálně nebyly přidány do `getDashboardKpis` – připraveno pro budoucí rozšíření.

---

## 6. Kde bylo sjednoceno UI/UX

- **Kontakty:** Vzor – header (název + počet), filtry/taby, search, akce vpravo, tabulka/seznam.
- **Finanční analýzy:** Stejný vzor – header „Finanční analýzy“ + počet, search „Hledat podle klienta“, akce „Nová analýza“, seznam uložených analýz.
- **Mindmap (list):** Header „Mindmap“ + počet, search přes mapy/klienty/domácnosti, akce „Nová mapa“, tři sekce (Libovolné mapy, Klienti, Domácnosti).
- **Kalkulačky:** Stejný kontejner (max-w-[1600px], padding) a styl nadpisu (h1 + popis).
- **Nástěnka:** KPI karty + nový blok „Rychlé vstupy“ (touch-friendly, min-h 44px); zbytek layoutu beze změny.

---

## 7. Změny v datových strukturách, enumech, mapách

- **Segmenty smluv:** Odebrány hodnoty ZDRAV a NEM z `contractSegments` a z `SEGMENT_LABELS` v `packages/db` a z `segment-labels.ts` v aplikaci.
- **FA – typy:** `ChildEntry` rozšířen o `sports?: string`.
- **FA – formátování:** `getProductName(key, type?)` – volitelný druh pro „ATRIS (Vklad)“; nová `pluralizeYears(n)`; export `getAgeFromBirthDate` z incomeProtection.
- **FA – konstanty:** `FUND_LOGOS: Record<string, string>`; `STEP_TITLES` a `getStepTitles(includeCompany)` – krok 3 při firmě = „FIRMA“; `INSURANCE_COMPANIES_CS` bez HDI a Pojistíme.cz.
- **FA – store:** `setStrategyProfile` nastavuje všem investicím `annualRate` podle `getProfileRate(profile)` a volá `recalcInvestmentsFv()`.
