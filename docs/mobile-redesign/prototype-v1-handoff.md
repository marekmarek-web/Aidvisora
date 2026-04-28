# Prototype v1 → produkční implementace (handoff)

**Účel:** Jednotný dokument pro převod **vizuálního prototypu v1** na iterativní implementaci v existující mobilní vrstvě Aidvisory. Jedná se výhradně o **handoff návod** — neprodukční kód.

---

## Poznámka ke zdroji prototypu

Očekávaná lokace odkazu vizuální podoby:  
`docs/mobile-redesign/references/mobile-prototype-v1.tsx`.

**V době vytvoření tohoto dokumentu** tento soubor **v repozitáři nebyl přítomen** (adresář `docs/mobile-redesign/references/` prázdný / soubor nedodán). Sekce níže strukturují **pojmenované bloky** z produktové specifikace (TopNav, GlassBottomNav, obrazovka Dashboard, Tasks, kalendář, AI Review fronta, task edit sheet, new activity sheet, drawer) a jejich mapování na kód **Aidvisora**. Po zkopírování skutečného prototypu do repa **doplň přímé odkazy na JSX komponenty** (řádkové rozsahy) a zkontroluj názvosloví prototyp ↔ názvy v této tabulce.

**Externí RTF bundle** (`Redesign mobile.rtfd`): slouží jako vizuální reference mimo Cursor; neduplikovat jej do produkční appky ani ho neimportovat.

---

## 1. Co z prototypu brát jako produkční design pattern

Implementovat jen **vzory chování a vizuální hierarchie**:

- **Komponovaný layout**: horní vrstva (bez desktop breadcrumbů) + scrollovatelný obsah + bezpečné dolní odsazení vůči spodní navigaci / FAB.
- **„Glass“ / airy spodní navigace**: poloprůhledné pozadí, silnější odlišení aktivní položky, centrální plus akce jako primární CTA nad tab barem konzistentně se [mobile foundation](../../apps/web/src/app/shared/mobile-ui/primitives.tsx).
- **Karty KPI / Hero**: výrazný první blok (datum / pozdravení), měřítka jako **jednotlivé dlaždice** (ne široká tabulka), konzistence s **`MobileKpiCard` / `MetricCard`** ([primitives](../../apps/web/src/app/shared/mobile-ui/primitives.tsx)).
- **„Priority“ seznam jako karty řádků**: titulek, meta řádek, stavové badge, tap target ≥ 44 px → přes **`MobileListItem`**.
- **Task edit / Nová aktivita v bottom sheet**: drag handle, zaoblené horní rohy, záhlaví, scrollovatelný formulář, volitelný **sticky footer** (`footer` prop u `BottomSheet` v primitives).
- **Kalendář týden / měsíc**: pásový pohled jako primární (ne desktop měsíc na šířku tabulky listem); synchronizovat stavy s URL kde už produkční kód něco ukládá do query (`router.replace`).
- **AI Review fronta**: filtr řádek + karty položek, zachovat existující dataflow do detailu wizardu `[id]`.
- **Side drawer jako jediné sekundární menu** (bez duplikování celého webového sidebaru).

Stylově držet [masterplan](masterplan.md) — světlé pozadí, námořní modř primární, violet/indigo akcenty; žádné tabulové layouty jako primární pattern na mobilu.

---

## 2. Co se nesmí kopírovat přímo do produkce

| Oblast | Proč |
|--------|------|
| **PhoneShell / iPhone rámeček / StatusBar** | Marketingový / demo wrap; produkční host je `MobilePortalClient` + `MobileAppShell` — žádný duplicitní „telefon“. |
| **Mock data / hardcoded řádky** | Riziko driftu od DB; použít existující **server actions** a stejné zdroje jako dnes jednotlivé screeny. |
| **„Fake routing“ přepínáním `useState(screen)`** | Produkt používá **Next.js `usePathname` / `router.push`** a `route-helpers` — navigace musí zůstat URL-pravdivá ([MobilePortalClient](../../apps/web/src/app/portal/mobile/MobilePortalClient.tsx), [route-helpers](../../apps/web/src/app/portal/mobile/route-helpers.ts)). |
| **Vlastní `PATH` prefix proměnných pro SVG / ikony mimo lucide-react** pokud jen demo | Konzistence: **Lucide / existující `AiAssistantBrandIcon`**, neduplikovat sadu ikon z prototypu bez design review. |
| **Lokální fake mutations (`setTasks` jen v paměti)** | Musí vést přes **`@/app/actions/*`** jako dnes (`tasks`, `calendar`, …). |
| **`<style>` s `@keyframes` uvnitř komponent** jako jediný zdročný styl systému | Globální tokeny už v **`globals.css` / theme** ([globals.css](../../apps/web/src/app/globals.css)); animace jen přes Tailwind přípustné utility nebo sdílené CSS vrstvy — ne inline keyframes kopie z prototypu. |

**Obecně:** prototyp dodává **vizuální cílový stav**; produkční kód **lepí** jeho vzhled na existující stromy komponent a data.

---

## 3. Mapování prototyp → existující produkční komponenty

| Prototyp (logický název) | Produční cílová komponenta / soubor |
|--------------------------|-------------------------------------|
| **TopNav** | **`MobileHeader` / alias `MobileTopBar`** ([primitives](../../apps/web/src/app/shared/mobile-ui/primitives.tsx)); sloty levé / pravé akce odpovídají dnešnímu `MobilePortalClient`. |
| **GlassBottomNav** | **`MobileBottomNav`** + **`centerFab`** (+ **`FloatingActionButton`** kde jsou FABy mimo centrální prvek) — viz `MobilePortalClient`. |
| **NewActivitySheet** | **`BottomSheet`** nebo **`MobileActionSheet`** (= alias na `BottomSheet`) s obsahem formuláře aktivit; použít **`footer`** pro primární CTA kde dává smysl ([primitives](../../apps/web/src/app/shared/mobile-ui/primitives.tsx)). |
| **TaskEditSheet** | **`BottomSheet`** (sticky obsah jako u task wizardu už v **`MobilePortalClient`** pro task create — stejný vzor rozšířit na úpravu / detail). |
| **PriorityItem** | **`MobileListItem`** (+ optional `leading`/`trailing`; variant `compact` / `roomy`). |
| **KPI blocks / Hero metriky** | **`MobileKpiCard`** (= alias **`MetricCard`**) a/nebo složené **`MobileCard`** řádky. |
| **SideDrawer** | **`MobileSideDrawer`** ([MobileSideDrawer.tsx](../../apps/web/src/app/shared/mobile-ui/MobileSideDrawer.tsx)). |
| **Page shell / rozložení šířky** | **`MobilePageLayout`** v [MobileLayouts.tsx](../../apps/web/src/app/shared/mobile-ui/MobileLayouts.tsx); scroll v **`MobileScreen`**. |

**Globální host:** **`MobilePortalClient`** řeší klasifikaci tras, základní FABy, navigaci ([MobilePortalClient](../../apps/web/src/app/portal/mobile/MobilePortalClient.tsx)) — nesahat na paralelní shell.

---

## 4. Screen breakdown (náhled funkcí vs. prototyp)

### 4.1 Dashboard (`/portal/today`)

- **Obsah prototypu (očekávaně):** hero / pozdrav, řádek KPI, seznam priorit / nadcházející.
- **Produkce:** [DashboardScreen.tsx](../../apps/web/src/app/portal/mobile/screens/DashboardScreen.tsx), data už z actions (`dashboard`, service engine, meeting notes, FA list, …).

### 4.2 Tasks (`/portal/tasks`)

- Tab nebo sama route; filtry, seznam řádků, akce dokončit / odklad.
- **Produkce:** [TasksScreen.tsx](../../apps/web/src/app/portal/mobile/screens/TasksScreen.tsx), akce `@/app/actions/tasks`.

### 4.3 Calendar (`/portal/calendar`)

- Týden / měsíc, rozlišení view state (často query).
- **Produkce:** [CalendarScreen.tsx](../../apps/web/src/app/portal/mobile/screens/calendar/) + sdílené calendar komponenty v `portal/calendar/` dle vstupů.

### 4.4 AI Review — fronta (`/portal/contracts/review`)

- Seznam review položek, navigace na detail `[id]`.
- **Produkce:** [ContractsReviewScreen.tsx](../../apps/web/src/app/portal/mobile/screens/ContractsReviewScreen.tsx) (+ detailová stránka nad existující logikou).

---

## 5. Fázová implementace (Phase 2A–2E)

Fáze navazují na **„foundation hotová“** ([primitives](../../apps/web/src/app/shared/mobile-ui/primitives.tsx)); každá fáze = samostatný feature řez, minimalizovat regrese.

### Phase 2A — Dashboard visual rewrite

| Položka | Popis |
|--------|------|
| **Cílové soubory** | [`DashboardScreen.tsx`](../../apps/web/src/app/portal/mobile/screens/DashboardScreen.tsx); případně drobně sdílené widgety jen pokud neduplikuje desktop; tokeny už v **`globals.css`**. |
| **Z prototypu** | hierarchie bloků Hero → KPI řádek → priority list; proporce kart, typografie „premium“, oddělení sekcí. |
| **Nepoužít** | PhoneShell, mock řádky, fake state místo props z rodiče. |
| **Datové zdroje** | Stávající props / volání **`getDashboardKpis`**, **`getServiceRecommendations…`**, atd. jako dnes — jen přemapovat na nové JSX. |
| **Interakce** | odkazy / tlačítka musí držet **`router.push`** stejně jako dosud; FAB skrze **`MobilePortalClient`** kde už existuje. |
| **Loading / empty / error** | Použít **`MobileLoadingState`**, **`MobileEmptyState`**, **`MobileErrorState`** / **`ErrorState`**. |
| **Acceptance** | Desktop `/portal/today` beze změny; mobilní přehled legibilní na 390–430 px; bez horizontálních tabulek; žádná nová business logika. |

---

### Phase 2B — Tasks visual rewrite + Task edit bottom sheet

| Položka | Popis |
|--------|------|
| **Cílové soubory** | [`TasksScreen.tsx`](../../apps/web/src/app/portal/mobile/screens/TasksScreen.tsx); úpravy listu řádků na **`MobileListItem`** tam kde dává smysl; **task edit**: rozšířit existující `BottomSheet` flow v **`MobilePortalClient`** **nebo** izolovaná komponenta volaná stejným action patternem jako create — **bez duplikace server logiky**. |
| **Z prototypu** | vizuální styl řádku priority; sheet layout (handle, záhlaví, footer CTA). |
| **Nepoužít** | lokální setState místo `updateTask` / actions; nové mock pole úkolů. |
| **Datové zdroje** | `getTasksList`, `getTasksCounts`, `updateTask`, `completeTask`, … (**actions/tasks**). |
| **Interakce** | zachovat filtry jako dnes (chips/kontrakt už ve screenu); edit sheet po potvrzení volá server action. |
| **Loading / empty / error** | skeleton při filtrování; empty copy interní („žádné úkoly v tomto filtru"); error přes **`ErrorState`**. |
| **Acceptance** | Úkoly dokončitelné jako dnes; bottom sheet přístupný (focus trap existuje ve `BottomSheet`); desktop tasks page nedotčen. |

---

### Phase 2C — Calendar visual rewrite + New activity bottom sheet

| Položka | Popis |
|--------|------|
| **Cílové soubory** | [`CalendarScreen.tsx`](../../apps/web/src/app/portal/mobile/screens/calendar/CalendarScreen.tsx), případné dílčí soubory ve stejné složce (`CalendarEventDetail`, …); **`BottomSheet`** pro „nová aktivita“ pokud už není řešeno odkazem. |
| **Z prototypu** | proporce měsíční / týdenní dlažnice; FAB / entry do „nová aktivita”; sheet layout. |
| **Nepoužít** | hardcoded události; přepínání měsíců jen ve state bez sync na URL pokud už produkce URL používá — **nezhoršit deep link**. |
| **Datové zdroje** | existující calendar actions / kontext používaný obrazovkou (beze změny kontraktů). |
| **Interakce** | tap na buňku / událost = stejná navigace nebo sheet jako dnes; nová aktivita = stejné API jako po vytvoření z webu. |
| **Loading / empty / error** | placeholders pro načítání měsíce; prázdny kalendář s copy; chybu brát z propagovaných errors. |
| **Acceptance** | Kalendář použitelný v terénu na výšku telefonu; žádné desktop-only tabulky; desktop calendar route beze změny chování. |

---

### Phase 2D — AI Review queue visual rewrite

| Položka | Popis |
|--------|------|
| **Cílové soubory** | [`ContractsReviewScreen.tsx`](../../apps/web/src/app/portal/mobile/screens/ContractsReviewScreen.tsx). |
| **Z prototypu** | hierarchie filtrování, karty řádků jako list; konzistence s barvami AI brand ([`AiAssistantBrandIcon`](../../apps/web/src/app/components/AiAssistantBrandIcon.tsx) kde sedí). |
| **Nepoužít** | mock review IDs; paralelní načítací vrstva mimo `@/lib/ai-review` kontrakty; přeskakovat existující `contract-review` actions. |
| **Datové zdroje** | stávající načítání fronty (**actions** používané screenem **nezměněné funkcionalitou** pokud stačí restyle). |
| **Interakce** | tap → `/portal/contracts/review/[id]` jak dnes. |
| **Loading / empty / error** | skeleton / empty state („žádné položky k review"); error řádek lidsky (**ne raw stack trace**). |
| **Acceptance** | Wizard detailu neduplikovat — jen fronta mobilní vizuály; wizard logika v `apps/web/src/app/portal/contracts/review/[id]/page.tsx` beze změny business pravidel (soubor existující route). |

---

### Phase 2E — Polish nav / drawer / akce podle prototypu

| Položka | Popis |
|--------|------|
| **Cílové soubory** | [`MobilePortalClient.tsx`](../../apps/web/src/app/portal/mobile/MobilePortalClient.tsx) (**jen rozložení/klasifikace FAB / header slotů pokud nutné**), [`MobileSideDrawer.tsx`](../../apps/web/src/app/shared/mobile-ui/MobileSideDrawer.tsx), [`primitives`](../../apps/web/src/app/shared/mobile-ui/primitives.tsx) při drobných token úpravách. |
| **Z prototypu** | mikroprostředí (mezerování sekcí draweru), sjednocení FAB vs. centrální +, kontrast aktivní záložky. |
| **Nepoužít** | měnit strukturu odkazů ve draweru způsobem rozbitým vůči [route klasifikaci](../../apps/web/src/app/portal/mobile/route-helpers.ts) (web-only / unsupported routes). |
| **Datové zdroje** | žádná nová — badge počty už z existujících hooků/action patternů v `MobilePortalClient`. |
| **Interakce** | HW zpět / ESC u sheetů už v primitives — ověřit regresní chování. |
| **Acceptance** | Navigace nekoliduje se scroll oblastí; drawer zavíratelný; žádná změna desktop `PortalShell`. |

---

## 7. Desktop UI — nesmí se měnit

Pro **Phase 2A–2E** platí:** žádné úpravy `PortalShell`, `PortalSidebar`, desktopové layouty `page.tsx` u stejných funkcí jen kvůli mobilu.**

Mobil má izolovanou vrstvu v **`portal/mobile`** a **`MobilePortalClient`** při zapnutém mobile UI případně vlastní výběr obrazovky — desktop routing a layout zůstanou oddělené.

---

## 8. Business logika / API / databáze

**Nepřepisovat** ani **nevymýšlet paralelní** mutace ani schémata jen kvůli prototypu. Veškeré nové vizuální chování musí používat **existující server actions, typy z `@/app/actions/*`**, a existující RLS/bezpečnostní model Supabase **beze změny kontraktu**, pokud není výslovně schválená samostatná technická úloha.

**SQL migrace** pro tyto vizuální fáze obvykle **nejsou potřeba** — pokud by vznikla potřeba ukládání preference zobrazení (např. default kalendář view), řeší se samostatným návrhem a migrací explicitně pojmenovanou mimo „handoff jen UI“.

---

## Rychlý checklist před začátkem kódování fáze

- [ ] Prototyp **`mobile-prototype-v1.tsx`** je v repu — konkrétní sekce nakřížovat s tabulkami výše.
- [ ] Ověřen **feature flag mobilní UI** (`MOBILE_UI_V1_*`).
- [ ] Otestováno na **šířce 390 a 430 px** + bezpečný spodní okraj u FAB / nav.
- [ ] Lint / typecheck pro dotčené soubory (projektové `tsc` může mít známý dluh mimo změněné soubory).

---

*Tento dokument nahrazuje ad-hoc copy z RTF; RTF zůstává vizuální referencí nad rámec repozitáře.*
