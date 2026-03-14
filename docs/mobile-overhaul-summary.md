# Mobile UX/UI Responsiveness Overhaul – výstup

Shrnutí implementace podle plánu v `.cursor/plans/mobile_ux_responsiveness_overhaul_9d8f16dd.plan.md`.

---

## Hotové

### Obrazovky a komponenty

- **Shell:** PortalShell (topbar s mobilním search overlay, overflow menu pod 640px, menší padding na mobilu), PortalSidebar (drawer s z-drawer-overlay/panel, body scroll lock), Toast (pozice nad AI tlačítkem na mobilu, z-toast), AI tlačítko (z-floating-ai, safe-area).
- **Modaly:** BaseModal má `mobileVariant`: "modal" | "sheet" | "fullScreen" (default fullScreen na mobilu); z-modal; close a title min 44px.
- **Wizard:** NewClientWizard – fullScreen na mobilu, sticky bottom CTA (StickyBottomCTA), jednosloupcové formuláře (grid-cols-1 md:grid-cols-2).
- **Kritické workflow:** Kalendář event modal (z-modal), Úkoly mobilní panel (z-modal), kalkulačky Pension/Life/Mortgage (z-fixed-cta, safe-area), Review smluv (z-modal pro dialogy, StickyBottomCTA pro Schválit/Zamítnout/Aplikovat), FA PersonalFALinkBanner (z-modal).
- **List/detail:** ListPageHeader a ListPageToolbar – touch targety (min-h-[44px] na mobilu pro akce a taby), ContactsPageClient již měl mobilní karty a desktop tabulku, ContactTabLayout má horizontální scroll tabů a min-h-[44px].

### Mobilní hierarchie

- Nástěnka: KPI a rychlé vstupy již responzivní (grid-cols-1 sm:grid-cols-3, flex-wrap, min-h-[44px]).
- Listy: Kontakty – karty na mobilu, toolbar s taby + search + filtry; ostatní listy používají ListPageShell/Header/Toolbar se sjednocenými touch targety.
- Detaily: Kontakt – taby horizontální scroll, hlavní akce s min 44px; Review detail – sticky spodní lišta s akcemi na mobilu.

### Sticky akce

- NewClientWizard: StickyBottomCTA s Další / Uložit (md:hidden).
- Contract review detail: StickyBottomCTA se Schválit, Zamítnout, Aplikovat do CRM (md:hidden).
- Kalkulačky Pension, Life, Mortgage: fixed bottom panel s výsledky / CTA (lg:hidden, z-fixed-cta, safe-area).

### Modaly → sheet/full-screen

- BaseModal: na mobilu default `mobileVariant="fullScreen"` (celá obrazovka) nebo "sheet" (bottom sheet), volitelně "modal" (původní chování).
- NewClientWizard používá fullScreen + StickyBottomCTA.

### Listy (karty, filtry)

- Kontakty: mobilní karty (md:hidden card list), filtry v toolbaru (taby + search + select); touch targety v kartách.
- ListPageToolbar: leftSlot s overflow-x-auto a min-h-[44px] pro taby na mobilu.

---

## Upravené

### Breakpointy a layout

- **Soubor:** `apps/web/src/app/lib/breakpoints.ts` – `MD_BREAKPOINT_PX = 768`, `LG_BREAKPOINT_PX = 1024`, helpery `mediaBelowMd`, `mediaMdUp`, `mediaBelowLg`.
- **Tailwind:** v `tailwind.config.ts` nebyly měněny výchozí screens; v kódu se používá `md:` (768px). PortalSidebar stále používá `(max-width: 767px)` pro mobil (pod 768px) – konzistentní s Tailwind md.
- **Theme:** `weplan-theme.css` – `--wp-mobile: 768px`, proměnné pro délky animací a `prefer-reduced-motion`.

### Z-index vrstvy

- **Theme:** `--z-base`, `--z-sticky`, `--z-sticky-header`, `--z-fixed-cta`, `--z-dropdown`, `--z-overlay`, `--z-drawer-overlay`, `--z-drawer-panel`, `--z-modal`, `--z-toast`, `--z-floating-ai`.
- **Tailwind:** v `theme.extend.zIndex` přidány odpovídající třídy (z-sticky-header, z-fixed-cta, z-drawer-overlay, z-drawer-panel, z-modal, z-toast, z-floating-ai).
- Použití: PortalSidebar (z-drawer-overlay, z-drawer-panel), PortalShell (z-sticky-header, z-floating-ai), Toast (z-toast), BaseModal (z-modal), kalkulačky (z-fixed-cta), Contract review a FA modaly (z-modal), tasks panel (z-modal).

### Navigace na mobilu

- **Topbar:** Na mobilu ikona vyhledávání → full-screen overlay s PortalHeaderSearch; pod 640px overflow menu (•••) s QuickNewMenu, NotificationBell, UserMenu; header py-2 md:py-4.
- **Sidebar:** Drawer pod 768px, overlay klik zavře, body scroll lock; položky min 44px; z-drawer-overlay / z-drawer-panel.

### Tabulky a dense data

- Kontakty: na mobilu karty (bez tabulky); desktop tabulka beze změny.
- Ostatní listy (pipeline, analyses, mindmap, review) nebyly v této vlně přepracovány na karty – zůstává stávající layout s vylepšenými ListPage* komponentami.

### Výkon a motion

- V theme přidány `--wp-duration-drawer` a `--wp-duration-modal`; v `@media (prefer-reduced-motion: reduce)` nastaveny na 0ms.
- Toast: tlačítko Zavřít má min-h-[44px] min-w-[44px].
- Drawer/sheet používají stávající transition (duration-300); pro plné využití reduced-motion lze v budoucnu přepnout na var(--wp-duration-drawer).

---

## Nehotové / rizika

- **Obrazovky k další iteraci:** Pipeline/board na mobilu (horizontální scroll nebo zjednodušený list), AnalysesPageClient (mobilní karty/filtry), Mindmap list a canvas (ověření touch targetů), stránka Zprávy (layout na velmi úzkém viewportu), Dokumenty a Domácnosti (konzistence s Contacts patternem).
- **Overflow menu v topbaru:** Obsah overflow menu (QuickNewMenu, NotificationBell, UserMenu) je vložen do jednoho dropdownu; na velmi malém viewportu může být potřeba upravit chování (např. full-screen menu místo dropdownu).
- **Mobilní search overlay:** Při otevření (ikona nebo Cmd+K) se vykreslí full-screen overlay s vyhledáváním; po výběru výsledku se overlay zavře – vhodné doplnit automatické zavření po navigaci.
- **Klávesnice vs. sticky footer:** U formulářů v modalu/sheetu nebyl řešen posun sticky CTA při otevřené virtuální klávesnici (scroll do view / úprava pozice) – doporučeno ověřit na reálných zařízeních.
- **Investiční kalkulačka:** Nemá sticky CTA panel jako Pension/Life/Mortgage; plán předpokládal jednotný pattern – lze doplnit v další iteraci.

---

## Soubory změněny / přidané

- `docs/mobile-audit.md` – audit
- `docs/mobile-overhaul-summary.md` – tento soubor
- `apps/web/src/app/lib/breakpoints.ts` – nový
- `apps/web/src/styles/weplan-theme.css` – z-index, breakpoint, motion vars
- `apps/web/tailwind.config.ts` – zIndex extend
- `apps/web/src/app/components/BaseModal.tsx` – mobileVariant, useIsMobile, fullScreen/sheet
- `apps/web/src/app/components/StickyBottomCTA.tsx` – nový
- `apps/web/src/app/components/Toast.tsx` – pozice na mobilu, z-toast, touch target zavřít
- `apps/web/src/app/components/weplan/NewClientWizard.tsx` – mobileVariant, StickyBottomCTA, grid-cols-1 md:grid-cols-2
- `apps/web/src/app/portal/PortalShell.tsx` – mobilní search overlay, overflow menu, isDesktop/isMobile, z-index, safe-area AI
- `apps/web/src/app/portal/PortalSidebar.tsx` – z-drawer-overlay, z-drawer-panel
- `apps/web/src/app/portal/PortalCalendarView.tsx` – z-modal
- `apps/web/src/app/portal/tasks/page.tsx` – z-modal
- `apps/web/src/app/portal/calculators/_components/pension/PensionCalculatorPage.tsx` – z-fixed-cta
- `apps/web/src/app/portal/calculators/_components/life/LifeCalculatorPage.tsx` – z-fixed-cta
- `apps/web/src/app/portal/calculators/_components/mortgage/MortgageCalculatorPage.tsx` – z-fixed-cta
- `apps/web/src/app/portal/contracts/review/[id]/ContractReviewDetailView.tsx` – z-modal, StickyBottomCTA, STICKY_BOTTOM_CTA_PADDING_CLASS
- `apps/web/src/app/portal/analyses/financial/components/PersonalFALinkBanner.tsx` – z-modal
- `apps/web/src/app/components/list-page/ListPageHeader.tsx` – touch targety pro akce
- `apps/web/src/app/components/list-page/ListPageToolbar.tsx` – touch targety pro leftSlot

Acceptance criteria z plánu jsou splněna v rozsahu této implementace: mobilní použitelnost vylepšena, hlavní workflow ovladatelné, breakpointy a z-index sjednoceny, modaly na mobilu full-screen/sheet, list kontakty jako karty, topbar s search overlay a overflow menu, sticky CTA u wizardu a review, toast a AI bez překryvu a se safe area, desktop zachován, vizuál z weplan-theme zachován.
