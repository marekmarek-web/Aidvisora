# Team Overview — implementační poznámky (stabilizace)

Tento dokument doplňuje `docs/team-overview-masterplan.md` o **aktuální technickou strukturu** po stabilizační fázi (komponenty, helpery, výběr člena, filtry, pool/unit).

## Rozdělení UI do komponent

Adresář: `apps/web/src/app/portal/team-overview/components/`

| Komponenta | Role |
|------------|------|
| `TeamOverviewBriefing` | Horní briefing + KPI karty v prvním foldu |
| `TeamOverviewAttentionSection` | Signály + coaching (nebo „Váš kontext“ pro `scope === me`) |
| `TeamOverviewCareerSummarySection` | Kariérní přehled týmu (větve, štítky, top attention) |
| `TeamOverviewPoolSplitSection` | Rozdělení poolů Beplan / Premium Brokers + poznámky k jednotkám |
| `TeamOverviewAdaptationSection` | Adaptace / nováčci |
| `TeamOverviewPeopleFiltersBar` | Vyhledávání, segment, řazení výkonu, počet „zobrazeno z celku“ |
| `TeamOverviewMembersTable` | Tabulka + mobilní karty členů |
| `TeamOverviewKpiDetailSection` | CRM metriky — doplňující mřížka |
| `TeamOverviewPerformanceTrendSection` | Sloupcový trend jednotek |
| `TeamOverviewAiTeamSummarySection` + `TeamOverviewAiFeedbackBlocks` | AI shrnutí, zpětná vazba, follow-up |
| `TeamOverviewFullAlertsSection` | Kompletní výpis signálů |
| `TeamOverviewTrendIndicator` | Šipky trendu u KPI |

Orchestrace zůstává v `TeamOverviewView.tsx` (stav, refresh, URL, AI akce).

## Sdílené helpery a jednotné formátování

| Soubor | Obsah |
|--------|--------|
| `apps/web/src/lib/team-overview-format.ts` | `formatTeamOverviewProduction`, `TEAM_OVERVIEW_UNITS_COLUMN_SUBTITLE`, `poolCardUnitsFootnote`, `poolProgramLabel`, `poolUnitsLineLabel`, re-export CRM poznámek |
| `apps/web/src/lib/team-overview-members.ts` | `sortTeamMembersForOverview`, `getVisibleTeamMembers` (segment + search), `isSelectedMemberInScope`, `isSelectedInFilteredList` |
| `apps/web/src/lib/team-overview-career-badges.ts` | CSS třídy pro kariérní štítky v tabulce |
| `apps/web/src/lib/team-overview-page-model.ts` | `buildTeamOverviewPageModel`, `memberMatchesPeopleSegment` — briefing, pool split, coaching, rhythm vstupy |

**Pool / BJ vs BJS:** žádné ruční opakování v blocích — texty pro pool karty jdou z `poolCardUnitsFootnote` / `poolProgramLabel` / `poolUnitsLineLabel`. Sloupec jednotek v tabulce používá `TEAM_OVERVIEW_UNITS_COLUMN_SUBTITLE`.

## Scope v URL a parita přehled ↔ detail

- **`defaultLandingScopeForRole`** (`team-hierarchy-types.ts`): výchozí scope při prvním načtení (Director/Admin = `full`, Manager = `my_team`, Advisor/Viewer = `me`). Liší se od `resolveScopeForRole(role, undefined)`, které u Director dává `my_team` — proto nelze u detailu člena spoléhat jen na „prázdný“ scope.
- **`team-overview/page.tsx`** čte `?scope=` a předává `resolveScopeForRole(auth, scopeParam ?? landing)` do snapshotu.
- **`TeamOverviewView`:** `syncTeamOverviewUrl` zapisuje `scope` do query; odkazy na detail a strom obsahují `period` + `scope`.
- **`[userId]/page.tsx`:** `getTeamMemberDetail(userId, { period, scope: requestedScope })` kde `requestedScope` = `?scope=` nebo `defaultLandingScopeForRole` — shodná viditelnost jako na přehledu.

## Selected member flow

1. Výběr: `selectMember(userId)` aktualizuje stav a URL (`?member=` přes `syncTeamOverviewUrl`).
2. **Mimo scope:** při změně `members` (např. jiný rozsah) pokud `selectedUserId` už není v seznamu členů, výběr se **zruší** (`useEffect` + `isSelectedMemberInScope`).
3. **Mimo filtr tabulky:** výběr zůstane; v `TeamOverviewSelectedMemberPanel` se zobrazí `outsideFilter`, pokud je člen v rozsahu, ale ne v `visibleMembers` (segment / search).
4. Detail se načítá přes `getTeamMemberDetail(selectedUserId, { period, scope })` — při prázdném výběru se panel vrátí do empty state (nepadá).

## People filters (proxy)

- Segmenty a „stabilní“ stav jsou **zjednodušený proxy** — logika je v `memberMatchesPeopleSegment` a v komentářích u `getVisibleTeamMembers`.
- Počet řádků: „Zobrazeno X z Y“ v `TeamOverviewPeopleFiltersBar` odpovídá `visibleMembers.length` vs `members.length`.

## Edge cases (hierarchie, prázdné stavy)

- Varování u neúplné hierarchie (`hierarchyParentLinksConfigured`) zůstává v `TeamOverviewView` nad gridem.
- Tabulka: při 0 výsledcích filtru — informační řádek (ne crash); při 0 členech v rozsahu — vlastní copy.
- Pool / adaptace / kariéra: sekce se renderují podle `members.length` tam, kde to dávalo smysl v původním UI.

## Testy

- `apps/web/src/lib/__tests__/team-overview-format.test.ts`
- `apps/web/src/lib/__tests__/team-overview-members.test.ts`
- `apps/web/src/lib/__tests__/team-overview-page-model.test.ts` (pool split přes `buildTeamOverviewPageModel`)
- `apps/web/src/lib/__tests__/team-hierarchy-scope.test.ts` (`defaultLandingScopeForRole`, viditelnost, parita s Director landing)

Spuštění: `pnpm --filter web test -- src/lib/__tests__/team-overview-*.test.ts`

Finální QA checklist: `docs/team-overview-release-checklist.md`.

## Co zbývá na další prompt (UX/UI polish)

- Pixel spacing, typografie a finální copy pass.
- Případné další sjednocení barev/stavů bez změny datové logiky.
- Volitelné: virtualizace tabulky při velmi velkých týmech (zatím neřešeno).
