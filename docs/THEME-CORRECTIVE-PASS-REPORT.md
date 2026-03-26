# Theme corrective pass – report (portal)

## 1. Tokeny přidané / upravené (`apps/web/src/styles/aidvisora-theme.css`)

| Token | Účel |
|-------|------|
| `--wp-main-scroll-bg` | Pozadí scroll oblasti hlavního panelu (light: `transparent`, dark: `#0c1222` = shodně s panelem) |
| `--wp-modal-surface`, `--wp-modal-border`, `--wp-modal-shadow` | Modal/dialog – odkaz na dropdown tokeny |
| `--wp-right-panel-bg/border/shadow` | Alias na `--wp-sc-*` (sidecalendar) |
| `--wp-state-hover-overlay`, `--wp-state-selected-bg`, `--wp-focus-ring-color` | Interakce / focus |
| **`.dark`**: `--wp-main-panel-bg` | Z `rgba(6,9,24,0.6)` na **solid `#0c1222`** |
| **`.dark`**: `--wp-main-panel-backdrop-blur` | `0px` (žádný „glass“ přes canvas) |
| **` :root` shadcn HSL blok** | `--background`, `--card`, `--muted`, `--border`, … sladěné s portálem (načítá se po `globals.css`) |
| `--wp-profile-menu-width` | `18rem` (širší profil menu) |

## 2. Tailwind (`apps/web/tailwind.config.ts`)

Nové barvy: `wp-text`, `wp-text-muted`, `wp-border-token`, `wp-app-canvas`, `wp-main-panel`, `wp-main-scroll`, `wp-dropdown-surface`, `wp-modal-surface`, `wp-right-panel`, `wp-surface-card-border`.

## 3. Shell / globální CSS (`aidvisora-components.css`)

- `.wp-portal-main-scroll` → `background-color: var(--wp-main-scroll-bg)`.
- `.dark .wp-portal-blob` → `mix-blend-mode: normal`, snížená opacity (bloby nezesvětlují panel).
- `.dark .wp-portal-main-panel` → respektuje `--wp-main-panel-backdrop-blur: 0`.

## 4. Refaktorované sdílené komponenty

- Wizard: `wizard-styles.ts`, `WizardShell.tsx`, `WizardHeader.tsx`, `WizardFooter.tsx`, `WizardStepper.tsx`
- `CustomDropdown.tsx`
- `BaseModal.tsx`
- List page: `ListPageEmpty`, `ListPageNoResults`, `ListPageHeader`, `ListPageToolbar`, `ListPageSearchInput`
- `UserMenu.tsx` (šířka, focus ring, hover přes tokeny)
- `Skeleton.tsx`
- `BoardTable.tsx` (část buněk / loading overlay)
- `PortalSidebar.tsx` (footer pill, dělíč, theme: **sun/moon active včetně system + resolvedTheme**)
- `PortalShell.tsx` (mobile search zavřít – tokeny)

## 5. Stránky / moduly explicitně prošité

| Oblast | Soubory (hlavní) |
|--------|------------------|
| **Vlna 1 (dříve)** | Shell, wizard, list-page, část dashboardu, zápisky hub, business plan, seznam klientů, kalkulačky hub, část `BoardTable` |
| **Vlna 2** | `shared/mobile-ui/primitives.tsx`, `portal/tasks/page.tsx`, `PortalCalendarView.tsx`, `portal/calendar/*` (vč. `event-categories.ts`, `WeekDayGrid`), `mobile/screens/DashboardScreen.tsx` |
| **Vlna 3** | Strom `portal/contacts/[id]/*`, `households/*`, `PortalBoardView.tsx`, `pipeline/*`, `cold-contacts/*`, `components/monday/*` (Row, ColumnHeader, …) |
| **Vlna 4** | `analyses/*` (company + financial), `mindmap/*`, `team-overview/*`, `messages/PortalMessagesView.tsx`, `AiAssistantDrawer.tsx`, `scan/page.tsx`, `contracts/review/*`, `components/ai-review/*` |
| **Vlna 5** | `portal/mobile/*` (vč. `MobileGlobalSearchOverlay`, `MobilePortalClient`, všechny `mobile/screens/*`), `MobileSideDrawer.tsx`, `portal/profile/*` |
| **Vlna 6** | `MessengerPreview.tsx`, `CalendarWidget.tsx`, `NotificationBell.tsx`, doplněk kalkulaček (`calculators/_components/**`), `PortalSidebar.tsx`, `quick-new-ui`, `PortalShell` (push toast), `setup/*`, `tools/*`, `admin/ai-quality`, `notes`, `notifications`, `share/import`, `DashboardMiniNotes`, `PortalFeedbackLauncher`, `error.tsx`, `board/page` |
| Nástěnka | `DashboardEditable.tsx`, `DashboardAiAssistant.tsx`, `DashboardCard.tsx`, `TodayInCalendarWidget.tsx` |
| Sidecalendar | `DashboardCalendarSidePanel.tsx` (tokeny panelu + scrim) |

## 6. Kde odpadly hardcoded light surfaces (vzorek)

- Nahrazeno `bg-white`, `bg-slate-*`, `text-slate-*`, `border-slate-*` za `var(--wp-*)` / Tailwind arbitrary `bg-[color:var(--wp-*)]` v prošitých souborech výše.
- **Úmyslně ponecháno:** některé tmavé gradienty / CTA (`#0a0f29`, `#111827`, …) kde jde o brandovaný „inverse“ panel; skleněné `bg-white/10` na tmavých gradientech.
- **Doporučená kontrola:** občasný `rg` na `portal/` pro `slate-` / `bg-white` (admin, nové soubory, marketing mimo portál).

## 7. A–G (stručně)

- **Sidebar:** liquid footer `rounded-[20px]`, dělíč, flex sloupce; theme segment **Světlý/Tmavý** zvýraznění podle `resolvedTheme` při `system`.
- **Top header:** beze změny velké logiky; mobile overlay tlačítko na tokeny.
- **Profile dropdown:** `min-w` z `--wp-profile-menu-width`, jednotný hover přes `--wp-surface-muted`, focus ring `--wp-focus-ring-color`.
- **Theme switcher:** `sunActive` / `moonActive` / `systemActive`; animace slunce zachována.
- **Dashboard:** tokenizace widgetů v `DashboardEditable`, AI blok okraje `border-white/10`.
- **Sidecalendar:** scrim `var(--wp-overlay-scrim)`.
- **Moduly:** Notes, Business plan, Contacts list, Calculators hub.

---

## Checklist

- [x] Dark mode je řízen tokeny na plátně a **neprůhledným** hlavním panelem (ne čistý „tint“ přes šedý podklad).
- [x] Content canvas / scroll v darku má jednotnou barvu s panelem (`--wp-main-scroll-bg`).
- [x] Dashboard / nástěnka – hlavní grid widgetů přes tokeny (`DashboardEditable`).
- [x] Textové tokeny `--wp-text` / secondary / tertiary použity v prošitých komponentách.
- [x] Sidebar – aktivní stav theme při **system** odpovídá `resolvedTheme`.
- [x] Top header – dílčí úpravy (mobile); plná reference parity může vyžadovat další iteraci.
- [x] Profile dropdown – širší, tokenový hover a ring.
- [x] Theme switcher – system + animace slunce + aktivní stavy.
- [x] Sidecalendar – tokenový scrim, panel už používal `--wp-sc-*`.
- [x] Zápisky – `NotesVisionBoard` tokenizován.
- [x] Business plán – `BusinessPlanView` tokenizován.
- [x] Produkce – bez masivní úpravy (už wp proměnné).
- [x] Klienti – `ContactsPageClient` tokenizován (seznam).
- [x] Kalkulačky – hub stránka tokenizována.
- [x] Gmail / Google Disk loga – beze změny.
- [x] Light / dark / system – `next-themes` + CSS `.dark` + nový light shadcn blok v `aidvisora-theme.css`.

- [x] **Vlny 2–6 (plán theme parity):** úkoly, kalendář, kontakty/domácnosti/board, analýzy/mindmap/tým/zprávy/AI, mobilní portál, sidecalendar widgety, kalkulačky (komponenty), sidebar/theme segmenty, doplněk zbývajících portálových cest.
- [ ] Marketing / landing a zóny mimo portál – záměrně mimo tento pass (dle produktu).
