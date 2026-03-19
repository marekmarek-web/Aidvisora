# Týmový přehled – hierarchická struktura

Stručné shrnutí implementace hierarchického týmového přehledu (poradce → manažer → ředitel) s role-based visibility, scope přepínačem a reálnými metrikami.

---

## Architektura

### Datový model

- **`memberships.parent_id`** (UUID, nullable) – odkaz na `auth.users.id` nadřízeného. Určuje reportingovou hierarchii uvnitř tenantu.
- **Role:** Admin, Director, Manager, Advisor, Viewer. Director má stejná team oprávnění jako Manager; scope „Celá struktura“ je dostupný jen Director/Admin.

### Scope (rozsah dat)

- **Já** (`me`) – jen aktuální uživatel. Advisor/Viewer vždy jen „me“.
- **Můj tým** (`my_team`) – já + přímí a nepřímí podřízení (odvozeno z `parent_id`). Manager vidí jen svůj strom.
- **Celá struktura** (`full`) – všichni členové tenantu. Pouze Director a Admin; u Managera se požadavek „full“ převede na „my_team“.

Scope se řeší v **`getVisibleUserIds`** podle role a `parent_id` stromu. Všechny gettery v `team-overview` actions berou volitelný parametr `scope` a filtrují metriky/členy přes `getScopeContext(scope)` → `visibleUserIds`.

### Klíčové moduly

| Modul | Účel |
|-------|------|
| `apps/web/src/lib/team-hierarchy.ts` | `listTenantHierarchyMembers`, `getVisibleUserIds`, `getTeamTree`, `resolveScopeForRole` |
| `apps/web/src/app/actions/team-overview.ts` | KPI, členové, metriky, alerty, nováčci, performance over time – vše s scope |
| `apps/web/src/app/actions/auth.ts` | `updatePortalProfile(_, supervisorUserId)`, `listSupervisorOptions()` |
| `apps/web/src/app/portal/team-overview/*` | Stránka, view, filtry, scope switcher, detail člena |
| `apps/web/src/app/portal/profile/*` | Výběr nadřízeného v profilu (Osobní údaje) |

---

## Změněné / nové soubory

### DB a migrace

- `packages/db/src/schema/tenants.ts` – sloupec `parentId` na `memberships`
- `packages/db/migrations/add_memberships_parent_id_and_director.sql` – přidání `parent_id`, index, role Director
- `packages/db/src/seed.ts` – role Director
- `packages/db/supabase-schema.sql` – `parent_id` + index
- `packages/db/src/index.ts` – export `ne` z drizzle-orm

### Auth a oprávnění

- `apps/web/src/lib/auth/get-membership.ts` – role Director, oprávnění `team_overview:read` dle role
- `apps/web/src/app/actions/auth.ts` – `updatePortalProfile(fullName, supervisorUserId?)`, `listSupervisorOptions()`, validace nadřízeného dle role

### Team hierarchy a overview

- `apps/web/src/lib/team-hierarchy.ts` – **nový** – scope, strom, visible user IDs
- `apps/web/src/app/actions/team-overview.ts` – scope ve všech getterech, rozšířené typy (parentId, managerName, calls, conversion, pipeline, …), `getTeamHierarchy`, `getTeamMemberDetail` s kontrolou visibility

### Frontend

- `apps/web/src/app/portal/layout.tsx` – odkaz na Týmový přehled i pro Advisor/Director
- `apps/web/src/app/portal/team-overview/page.tsx` – default scope podle role, předání hierarchy
- `apps/web/src/app/portal/team-overview/TeamOverviewView.tsx` – scope switcher, filtry (role, top/bottom, rizikoví, nováčci), KPI karty (včetně pipeline, conversion), tabulka s Nadřízený/Konverze, mobilní karty
- `apps/web/src/app/portal/team-overview/TeamCalendarModal.tsx` – presety (Celý tým, Manažeři, Poradci, Nováčci, Rizikoví)
- `apps/web/src/app/portal/team-overview/[userId]/page.tsx` – detail člena s kontrolou přístupu
- `apps/web/src/app/portal/team-overview/[userId]/TeamMemberDetailView.tsx` – metriky (Hovory, Follow-upy, Conversion, Pipeline)
- `apps/web/src/app/portal/profile/page.tsx` – načtení `parentId`, `listSupervisorOptions`
- `apps/web/src/app/portal/profile/AdvisorProfileView.tsx` – select Nadřízený, uložení přes `updatePortalProfile`

### API

- `apps/web/src/app/api/ai/team-summary/route.ts` – query parametr `scope`, předání do KPI/metrik/alertů

---

## Checklist implementace

- [x] DB: `parent_id` na memberships, migrace
- [x] DB: role Director (schema + seed)
- [x] Auth: Director v get-membership, oprávnění
- [x] Auth: updatePortalProfile s nadřízeným, listSupervisorOptions
- [x] team-hierarchy: scope, strom, visible user IDs
- [x] team-overview actions: scope ve všech getterech, rozšířené metriky, getTeamMemberDetail s visibility
- [x] UI: scope switcher, filtry, KPI (pipeline, conversion), Nadřízený v tabulce/kartách
- [x] Profil: výběr nadřízeného (Osobní údaje)
- [x] API team-summary: scope parametr
- [ ] **Volitelně:** Registrace – pole „Nadřízený“ ve signup flow (nyní jen v profilu)
- [ ] **Volitelně:** Manager note – persistence interní poznámky manažera k členovi
- [ ] **Volitelně:** Období „rok“ a custom range v UI
- [ ] **Volitelně:** Online/offline indikátor (pokud bude zdroj last_seen)

---

## Bez mock dat

Týmový přehled nepoužívá mock data: KPI, členové, metriky, alerty a nováčci vycházejí z DB (contracts, events, tasks, opportunities, activity_log, memberships, user_profiles, team_goals). Scope a hierarchie jsou odvozeny z `parent_id` a role.
