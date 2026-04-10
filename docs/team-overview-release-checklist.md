# Team Overview — release checklist, QA a known limitations

Finální produkční sanity pass před **demem** nebo **release** modulu Týmový přehled. Dokument doplňuje `team-overview-implementation-notes.md` a `team-overview-masterplan.md`.

---

## 1. Role / permission checklist

| Role | `team_overview:read` | Výchozí scope (landing) | Poznámka |
|------|----------------------|-------------------------|----------|
| Advisor | ano | `me` | Žádný týmový leak mimo self. |
| Viewer | **ne** (v `rolePermissions.ts`) | — | Přístup na `/portal/team-overview` = redirect na `/portal` — Team Overview se netestuje jako Viewer. |
| Manager | ano | `my_team` | Nemůže přepnout na `full` (UI + `resolveScopeForRole`). |
| Director | ano | `full` | Širší přehled tenantu (v rámci `getVisibleUserIds`). |
| Admin | ano | `full` | |

- [ ] `getTeamMemberDetail` kontroluje `visibleUserIds` pro předaný `scope` — mimo scope = Forbidden / null → 404 na stránce detailu.
- [ ] **Detail člena (`/portal/team-overview/[userId]`):** server předává `scope` z `?scope=` nebo **`defaultLandingScopeForRole`** — musí odpovídat přehledu (Director/Admin = `full`, ne omylem jen `my_team` z `resolveScopeForRole(undefined)`).
- [ ] Odkazy z přehledu obsahují `period` + `scope` v query — konzistence s panelem a hlubokými odkazy.
- [ ] AI follow-up z týmového shrnutí: přiřazený uživatel musí být v povoleném scope (stejná logika jako Team Overview).
- [ ] CTA „Vytvořit follow-up z shrnutí“ jen s `contacts:write` nebo `tasks:*` — jinak informativní text.

---

## 2. Scope / hierarchy checklist

- [ ] Bez jediného `parent_id`: „Můj tým“ = jen přihlášený uživatel (žádný leak na celý tenant).
- [ ] Banner o neúplné hierarchii (`hierarchyParentLinksConfigured`) je viditelný, kde KPI existují a scope ≠ `me`.
- [ ] Strom: sirotci / neviditelný parent → uzel jako kořen v rámci scope (`getTeamTree`).
- [ ] Po změně scope se synchronizuje URL (`scope` v query) a obnoví se data.

---

## 3. Career / pool / unit checklist

- [ ] Beplan vs Premium Brokers: labely a poznámky k jednotkám z `team-overview-format.ts` (`poolCardUnitsFootnote`, `poolProgramLabel`, …) — ne mixovat BJ/BJS náhodně v komponentách.
- [ ] Sloupec „Jednotky“ v tabulce: `TEAM_OVERVIEW_UNITS_COLUMN_SUBTITLE` (CRM ≠ BJ/BJS z řádu).
- [ ] `not_set` / partial kariéra: štítky z `career-ui-labels` + evaluátor; chování je konzistentní mezi řádkem a bočním panelem (stejný serverový pipeline).

---

## 4. Briefing / attention / rhythm consistency

- [ ] Briefing počty a „Vyžaduje pozornost“ vycházejí z `buildTeamOverviewPageModel` / KPI — žádný druhý paralelní výpočet alertů na klientovi.
- [ ] Sekce pozornosti (CRM + coaching) nepoužívá jinou sadu ID než filtr „attention“ ve filtrech lidí (zdroj `attentionUserIds` v page modelu).
- [ ] Rytmus: stejný scope jako přehled (`getTeamRhythmCalendarData` / `getScopeContext`); disclaimer viditelný.
- [ ] „Stabilní“ segment u lidí je **proxy** (viz komentáře u `memberMatchesPeopleSegment`) — na demo říct jako orientační, ne tvrdé pravidlo.

---

## 5. People area checklist

- [ ] Segmenty (all / attention / adaptation / managers / healthy) + search — výsledek konzistentní s `getVisibleTeamMembers`.
- [ ] Počet „Zobrazeno X z Y“ odpovídá `visibleMembers.length` / `members.length`.
- [ ] Prázdný výsledek filtru: informační stav v tabulce, ne prázdná obrazovka bez textu.
- [ ] Vybraný řádek: zvýraznění; mimo filtr: `outsideFilter` v bočním panelu.

---

## 6. Selected member checklist

- [ ] Výběr ze stromu / tabulky / alertů nastaví `member` v URL a načte detail se **stejným** `period` a `scope`.
- [ ] Po změně scope: pokud vybraný user není v `members`, výběr se zruší (`isSelectedMemberInScope`).
- [ ] Načtení detailu: `getTeamMemberDetail(..., { period, scope })` — při chybě prádzný panel, ne pád celé stránky.

---

## 7. Empty / partial / fallback states checklist

- [ ] Briefing: skeleton nebo prázdnota s kontextem při chybějících KPI.
- [ ] Attention / career / pool / adaptation: existující empty copy (žádné holé bílé bloky).
- [ ] Struktura: prázdný strom → vhodná zpráva v `TeamStructurePanel`.
- [ ] Rytmus: prázdný kalendář — stávající empty states v panelu.

---

## 8. Responsive / density sanity checklist

- [ ] Mobilní karty členů: `min-w-0`, zkrácené labely metrik kde je třeba; dlouhé názvy nemají rozbít layout.
- [ ] Boční panel detailu na úzkém viewportu: scrollovatelný panel (`max-h` + overflow).
- [ ] Banner hierarchie neřeže okraje na malých šířkách.

---

## 9. Performance sanity checklist

- [ ] `pageModel`, `visibleMembers`, `sortedMembers`, `metricsByUser` — memoizováno v `TeamOverviewView` tam, kde dává smysl.
- [ ] **Snadný win (hotovo):** jeden přepočet filtrů přes `getVisibleTeamMembers`, ne duplicitní filter v renderu.
- [ ] **Future optimization (known limitation):** při načtení přehledu mohou běžet paralelně `getTeamOverviewKpis` a `getTeamMemberMetrics` — případná deduplikace vyžaduje větší refaktor server actions.

---

## 10. Tests / automated checks

- [ ] `pnpm exec vitest run src/lib/__tests__/team-hierarchy-scope.test.ts`
- [ ] `pnpm exec vitest run src/lib/__tests__/team-overview-format.test.ts src/lib/__tests__/team-overview-members.test.ts src/lib/__tests__/team-overview-page-model.test.ts`
- [ ] `pnpm exec tsc --noEmit -p apps/web/tsconfig.json` (nebo aspoň dotčené soubory)
- [ ] `pnpm exec eslint` na změněné soubory Team Overview

---

## 11. Known limitations (poctivě)

1. **Hierarchie** závisí na `parent_id`; bez vazeb je „Můj tým“ záměrně restriktivní.
2. **Kariéra:** část pravidel je heuristická; manuální / partial stavy vyžadují lidský kontext — modul neuděluje „licenci“ BJ/BJS.
3. **Uložené AI shrnutí** nemusí odpovídat aktuálnímu scope/period — uživatel má znovu generovat po přepnutí.
4. **Rytmus / cadence** je read model a doporučení, ne workflow engine.
5. **Filtr „Stabilní“** u lidí je zjednodušený proxy (CRM risk + není v adaptaci).
6. **Členové bez řádku metrik** ve filtrech: `getVisibleTeamMembers` je může pustit (`!mm` větev) — edge case závislý na datech ze serveru; při rozšíření metrik sjednotit.
7. **Typecheck celého monorepa** může občas hlásit chyby mimo Team Overview — před releasem ověřit aspoň `apps/web` nebo dotčené moduly.

---

## 12. Blockers before release / demo

*Aktuálně žádné povinné kódové blokery známé z tohoto QA passu — ověřte v cílovém prostředí (staging), že `parent_id` a ukázková data odpovídají scénáři dema.*

---

## 13. Demo script (doporučení)

1. Přihlásit se jako **Director**, scope **Celá struktura** — ukázat briefing, pool split, strom.
2. Přepnout na **Můj tým** (Manager účet nebo stejný uživatel) — ukázat zúžení dat a URL s `scope=`.
3. Otevřít **detail člena** z řádku — ověřit, že stránka detailu načte (stejný scope v query).
4. Filtrovat **Vyžaduje pozornost** + vyhledání — prázdný stav s vysvětlením.
5. Krátce ukázat **rytmus** a disclaimer u interních termínů.
6. (Volitelně) **Generovat AI shrnutí** — připomenout, že uložený text může být z jiného období.

---

## SQL migrace

Žádné SQL migrace nejsou součástí Team Overview logiky (scope a data v aplikační vrstvě).

```sql
-- Žádná nová migrace pro tento QA pass.
```

Odkazy do repa (implementace):  
`apps/web/src/lib/team-hierarchy-types.ts`  
`apps/web/src/app/actions/team-overview.ts`  
`apps/web/src/app/portal/team-overview/page.tsx`  
`apps/web/src/app/portal/team-overview/[userId]/page.tsx`  
`apps/web/src/app/portal/team-overview/TeamOverviewView.tsx`
