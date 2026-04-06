# Mobilní finanční analýza — plán parity s webem

Tento dokument navazuje na stabilizaci mobilního portálu (jeden mount route, bez duplicitního `FinancialAnalysisPage`). Cíl: uživatelsky srovnat průvodce FA na telefonu s desktopovým `/portal/analyses/financial`.

## Současný stav

- Mobil používá [`FinancialAnalysisWizardScreen`](../src/app/portal/mobile/screens/FinancialAnalysisWizardScreen.tsx) → sdílený [`FinancialAnalysisLayout`](../src/app/portal/analyses/financial/components/FinancialAnalysisLayout.tsx) se stejným Zustand store jako web.
- Layout je optimalizovaný pro široký viewport (centrovaný titulek, velké odsazení, spodní patička kroků), nad globálním [`MobileHeader`](../src/app/shared/mobile-ui/primitives.tsx) — vzniká dvojitá „hlavička“ a plýtvání vertikálním místem.

## Směry implementace (zvolit jeden)

### A) Responzivní jeden layout

- Upravit `FinancialAnalysisLayout` a `FinancialAnalysisStepper` / toolbar tak, aby na `max-width` typu telefonu:
  - skryly nebo zmenšily horní nadpis „Finanční analýza“, pokud už běží v mobilním shell headeru;
  - zúžily `max-w-6xl` kontejnery a zmenšily `padding` / `mb`;
  - patičku „Zpět / Další“ udělaly sticky v rámci **jednoho** scrollovacího kontejneru (`MobileScreen`), ne celostránkově.
- **Plus:** jeden kódový tok, méně divergence.
- **Mínus:** riziko regrese desktopu při špatných breakpointech.

### B) Dedikovaný mobilní fullscreen flow

- Nový wrapper např. `MobileFinancialAnalysisShell`, který:
  - nepřidává vlastní H1, spoléhá na `MobileHeader` (dynamický title z route meta);
  - dává `FinancialAnalysisLayout` do `flex-1 min-h-0 overflow-y-auto` bez duplicitního vnějšího paddingu;
  - volitelně zjednoduší stepper na kompaktní variantu (jen čísla / progress).
- Sdílené zůstanou kroky (`StepClientInfo`, …) a store.
- **Plus:** čistší UX na malém displeji bez křehkých desktop breakpointů.
- **Mínus:** dva vstupní layouty k udržování.

## Kroky (epic)

1. **Audit vertikálního toku** — změřit výšku header + stepper + karta kroku na iPhone 14/15 safe area.
2. **Rozhodnutí A vs B** — produkt/architektura.
3. **Implementace** — podle zvolené varianty; E2E smoke: otevřít existující analýzu, projít krok, uložit, export ze Shrnutí.
4. **QA** — Capacitor iOS + Android, klávesnice u textových polí.

## Související soubory

- [`FinancialAnalysisWizardScreen.tsx`](../src/app/portal/mobile/screens/FinancialAnalysisWizardScreen.tsx)
- [`FinancialAnalysisLayout.tsx`](../src/app/portal/analyses/financial/components/FinancialAnalysisLayout.tsx)
- [`FinancialAnalysisStepper.tsx`](../src/app/portal/analyses/financial/components/FinancialAnalysisStepper.tsx)
- [`primitives.tsx`](../src/app/shared/mobile-ui/primitives.tsx) — `MobileAppShell`, `MobileScreen`
