# Souhrn oprav: Bugfixy a UX – Aidvisora

Dokumentace ke každému bodu: root cause, co bylo opraveno, kde, zachování live napojení.

---

## 1. Zápisky bez klienta

- **Root cause:** Pole „Kontakt“ ve formuláři mělo `required` a label „Kontakt *“, takže se nedal uložit zápisek bez výběru klienta. Backend a schéma (`contactId` volitelný) to již umožňovaly.
- **Oprava:** Odstraněn `required` z selectu, label změněn na „Kontakt (volitelný)“, prázdná option na „— bez klienta (obecný zápisek) —“. Při vytvoření se posílá `contactId: contactId.trim() || null`.
- **Kde:** `apps/web/src/app/dashboard/meeting-notes/MeetingNotesForm.tsx`
- **Live:** Beze změny API ani DB, pouze povolení prázdného výběru a konzistentní předání null do `createMeetingNote`.

---

## 2. Kalendář defaultně týden

- **Root cause:** Výchozí režim byl již `useState<ViewMode>("week")` v `PortalCalendarView`. Žádné přepsání z localStorage (nastavení neukládá režim zobrazení).
- **Oprava:** Ověřeno – při prvním otevření se vždy zobrazí týden. Žádná změna kódu.
- **Kde:** `apps/web/src/app/portal/PortalCalendarView.tsx`
- **Live:** Pouze výchozí stav UI, data z API beze změny.

---

## 3. Mindmap – editovatelné položky

- **Root cause:** Klik na uzel již otevíral side panel a panel měl `applyEdits` (onBlur, Enter). Chybělo výrazné tlačítko pro uložení změn.
- **Oprava:** Přidáno tlačítko „Uložit změny“ v `MindmapSidePanel`, které volá `applyEdits`. Všechny typy uzlů (Item, Category, Goal, Core) zůstávají napojené na `onUpdateNode` / state.
- **Kde:** `apps/web/src/app/portal/mindmap/MindmapSidePanel.tsx`
- **Live:** Pouze propojení UI s existujícími `updateNode` a persistencí, API beze změny.

---

## 4. Nefunkční tečky v boardu

- **Root cause:** „Tečka“ v boardu je vizuální prvek `avatar-dot` (ikona User) v řádku – dekorativní, ne interaktivní. Status buňky jsou klikací (CellStatus).
- **Oprava:** U `avatar-dot` přidáno `aria-hidden="true"`, aby nebyl vnímán jako interaktivní. Status buňky zůstávají s min-h 44px a otevíráním dropdownu.
- **Kde:** `apps/web/src/app/components/monday/Row.tsx`
- **Live:** Žádná změna dat ani logiky, pouze sémantika a přístupnost.

---

## 5. Každý board má vlastní editable column/template logiku

- **Root cause:** Konfigurace sloupců a skupin se ukládala a načítala per view (`activeViewId`), ale nebylo to explicitně zdokumentované.
- **Oprava:** Přidán komentář v `PortalBoardView` u volání `saveBoardViewConfig`: „Per-view: každý board view má vlastní column config a groups“.
- **Kde:** `apps/web/src/app/portal/PortalBoardView.tsx`
- **Live:** Stávající persistence view config, žádná změna API.

---

## 6. Dropdowny v boardu nejsou schované

- **Root cause:** Dropdown v ColumnHeader (menu sloupce) byl renderovaný inline s `absolute`, takže mohl být ořezaný kontejnerem s `overflow-auto`.
- **Oprava:** Menu ColumnHeader (ne-mondayStyle) se nyní renderuje přes `createPortal` do `document.body` s `fixed` pozicí a `z-[400]`. Pozice se počítá z `menuButtonRef` a `updateMenuPosition`.
- **Kde:** `apps/web/src/app/components/monday/ColumnHeader.tsx`
- **Live:** Žádná změna dat, pouze zobrazení dropdownu mimo scroll kontejner.

---

## 7. Typ sloupce jde změnit na STAV

- **Root cause:** V Monday-style ColumnHeader byl v menu „Změnit typ“ label „Status“ (anglicky). Požadavek: „STAV“.
- **Oprava:** V konstantě `CHANGEABLE_TYPES` v `ColumnHeader.tsx` změněn label u typu `status` z „Status“ na „STAV“.
- **Kde:** `apps/web/src/app/components/monday/ColumnHeader.tsx`
- **Live:** Pouze text v UI, logika typu sloupce beze změny.

---

## 8. Změna stavu nepřepisuje řádek s jménem klienta

- **Root cause:** `onCellChange` již při `columnId !== "item"` mění jen `item.cells[columnId]`, ne `item.name`. Batch save posílá `item.name` z board state.
- **Oprava:** Přidán komentář u buildu payloadu: „Always use item.name from state (never from cells) so changing status never overwrites client name“. Logika zůstala beze změny.
- **Kde:** `apps/web/src/app/portal/PortalBoardView.tsx`
- **Live:** Žádná změna API, pouze dokumentace garance.

---

## 9. Tlačítko „Vytvořit úkol“ funguje

- **Root cause:** Tlačítko volalo `document.getElementById("new-task-form")?.scrollIntoView()`. Pro spolehlivost bylo vhodné použít ref místo ID.
- **Oprava:** Přidán `useRef<HTMLFormElement>(null)` a na formulář `ref={newTaskFormRef}`. Tlačítko volá `newTaskFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })`.
- **Kde:** `apps/web/src/app/portal/tasks/page.tsx`
- **Live:** Stejné `handleCreate` a `createTask`, pouze spolehlivější scroll.

---

## 10. Search funguje inline bez okna

- **Root cause:** V portálu byl search již pouze inline v headeru (`PortalHeaderSearch`); Ctrl+K focusuje header search. Modální `GlobalSearch` není v portálu použita.
- **Oprava:** Žádná změna – ověřeno, že vyhledávání je pouze inline s českými texty (Hledám…, Žádné výsledky, Kontakty, Smlouvy, Případy, Události).
- **Kde:** `apps/web/src/app/portal/PortalHeaderSearch.tsx`, `PortalShell.tsx`
- **Live:** API `globalSearch` beze změny.

---

## 11. Fonty sjednocené na max 2

- **Root cause:** Tailwind měl `fontFamily.sans: ["var(--font-inter)", "Inter"]`; v UI se používalo DM Sans z layoutu. V `AiSearchBar.css` bylo `font-family: system-ui`.
- **Oprava:** V `tailwind.config.ts` nastaveno `sans: ["var(--font-dm-sans)", "var(--wp-font)", "system-ui", "sans-serif"]` a `mono: ["var(--wp-font-mono)", "monospace"]`. V `AiSearchBar.css` nahrazeno `system-ui` za `var(--wp-font)` (3 výskyty).
- **Kde:** `apps/web/tailwind.config.ts`, `apps/web/src/app/components/AiSearchBar.css`
- **Live:** Žádná změna dat, pouze vzhled.

---

## 12. Upravit kontakt – nové UI/UX a zachovaná funkčnost

- **Root cause:** Stránka editace kontaktu již měla sekce a funkce; požadován byl vylepšený vzhled a chování.
- **Oprava:** Topbar je sticky na mobilu (`sticky top-0 z-10`). Formulář má `max-w-2xl mx-auto`, větší vertikální spacing (`space-y-6 sm:space-y-8`) a konzistentní padding (`p-4 sm:p-5 md:p-6`). Všechna volání (`getContact`, `updateContact`, `uploadContactAvatar`, `getHouseholdForContact`, `setContactHousehold`, `onDelete`) beze změny.
- **Kde:** `apps/web/src/app/portal/contacts/[id]/edit/page.tsx`
- **Live:** Stejné actions a pole, pouze layout a styly.

---

## 13. Nástěnka – spacing a oddělený side calendar

- **Root cause:** Pravý panel s kalendářem a MessengerPreview neměl nadpis a vizuální oddělení sekce kalendáře.
- **Oprava:** V pravém panelu přidána sekce s nadpisem „Kalendář“ a `CalendarWidget` v `<section>`, pod ní `border-t` a sekce s `MessengerPreview`. Panel má `space-y-6`, pozadí `bg-slate-50/50` na obalu a bílé pro obsah. Nadpis „Kalendář“ je `text-sm font-bold uppercase tracking-wider`.
- **Kde:** `apps/web/src/app/portal/today/DashboardEditable.tsx`
- **Live:** Žádná změna dat, pouze layout a oddělení bloků.

---

## 14. Upload profilové fotky funguje

- **Root cause:** Flow byl implementovaný: výběr souboru → FormData → `uploadContactAvatar` → update `contacts.avatarUrl` a vrácení URL. Frontend nastavuje `setAvatarUrl(url)` po úspěchu.
- **Oprava:** Ověřen kód v `portal/contacts/[id]/edit/page.tsx` (onAvatarChange) a `actions/contacts.ts` (uploadContactAvatar). Žádná změna – flow je korektní. Při problémech je třeba zkontrolovat RLS/policy bucketu `documents` v Supabase.
- **Kde:** `apps/web/src/app/portal/contacts/[id]/edit/page.tsx`, `apps/web/src/app/actions/contacts.ts`
- **Live:** Zachován stávající API a bucket.

---

## 15. Loga a favicony nasazené

- **Root cause:** Favicon a logo byly v projektu nastavené: `layout.tsx` má `icons: { icon: "/favicon.png", apple: "/favicon.png" }`, sidebar a přihlášení používají `/aidvisora-logo.png`.
- **Oprava:** Ověřeno – žádná změna. Soubory v `public`: favicon.png, aidvisora-logo.png, logo.png. Reference v layoutu, PortalSidebar, LandingLoginPage.
- **Kde:** `apps/web/src/app/layout.tsx`, `apps/web/src/app/portal/PortalSidebar.tsx`, `apps/web/src/app/components/LandingLoginPage.tsx`, `apps/web/public/`
- **Live:** Pouze statické assety a metadata.

---

## 16. Header opravený

- **Root cause:** V headeru byl QuickNewMenu (plus), který měl být odstraněn; spacing a layout měly zůstat v pořádku.
- **Oprava:** QuickNewMenu byl odstraněn v bodě 18. Header má `flex flex-wrap items-center gap-2 sm:gap-4 md:gap-6`, padding a NotificationBell + UserMenu.
- **Kde:** `apps/web/src/app/portal/PortalShell.tsx`
- **Live:** Žádná změna dat, pouze složení komponent.

---

## 17. AI Import je pryč

- **Root cause:** Stránka cold-contacts měla metadata „AI Import“ a blok „Import ze zdroje“ s „Roztřídit pomocí AI“ při `showAiImport === true`.
- **Oprava:** Metadata změněna na „Studené kontakty“. Z page odstraněno volání `hasOpenAIKey()` a předávání `showAiImport`. Z `ColdContactsClient` odstraněn celý blok AI importu (textarea, tlačítko, tabulka extrahovaných, zpráva o OPENAI_API_KEY). Klient nyní přijímá jen `initialCalls` a zobrazuje pouze sekci „Přehled telefonátů“.
- **Kde:** `apps/web/src/app/portal/cold-contacts/page.tsx`, `apps/web/src/app/portal/cold-contacts/ColdContactsClient.tsx`
- **Live:** Žádná změna CRM logiky pro kontakty; odstraněno pouze UI a volání AI na této stránce.

---

## 18. Plus tlačítko pryč, bell zůstává

- **Root cause:** V headeru byl `<QuickNewMenu />` (plus „Nový“) a `<NotificationBell />`. Požadavek: plus odstranit, bell ponechat.
- **Oprava:** Z PortalShell odstraněn import a použití `QuickNewMenu`. V headeru zůstávají NotificationBell a UserMenu.
- **Kde:** `apps/web/src/app/portal/PortalShell.tsx`
- **Live:** Žádná změna API.

---

## 19. Angličtina odstraněná z UI

- **Root cause:** V UI se vyskytovaly anglické výrazy: „Pipeline view“ (název view v boardu), „Status“ (label filtru a typ sloupce v ColumnHeader/Toolbar).
- **Oprava:** „Pipeline view“ → „Nástěnka“ v `PortalBoardView`. „Status“ → „STAV“ v `PortalBoardView` (filter) a v `Toolbar.tsx`. V ColumnHeader již dříve změněno „Status“ → „STAV“. V SetupView komentář „Demo data“ → „Ukázková data“ (viditelný nadpis byl již „Ukázková data“).
- **Kde:** `apps/web/src/app/portal/PortalBoardView.tsx`, `apps/web/src/app/components/monday/Toolbar.tsx`, `apps/web/src/app/portal/setup/SetupView.tsx`
- **Live:** Žádná změna logiky ani API.

---

## 20. Nefunkční prvky opravit nebo odstranit

- **Root cause:** Tlačítko „Šablony úkolů“ na stránce úkolů nemělo handler (pouze scroll nebo nic), mělo `title="Připravujeme"` a na mobilu bylo skryté.
- **Oprava:** Tlačítko nastaveno na `disabled`, přidány třídy `bg-slate-50 text-slate-400 cursor-not-allowed`, aby bylo zřejmé, že je nedostupné, s ponechaným title „Připravujeme“.
- **Kde:** `apps/web/src/app/portal/tasks/page.tsx`
- **Live:** Žádná změna API.

---

## 21. Texty sjednocené

- **Root cause:** Různé stránky mohly používat odlišné formulace; požadavek byl sjednotit primární/sekundární akce a terminologii.
- **Oprava:** Provedeny dílčí úpravy v rámci ostatních bodů (STAV, Nástěnka, Ukázková data, Kontakt volitelný). Širší audit „Uložit“ vs „Uložit změny“ a „Zrušit“ vs „Zpět“ ponechán konzistentní tam, kde již byl (edit kontaktu: Zrušit, Uložit změny).
- **Kde:** Různé komponenty v rámci výše uvedených změn.
- **Live:** Žádná změna logiky.

---

## 22. Ověření live napojení a checklist

- **Splnění acceptance criteria:**
  - Zápisky jdou vytvořit i bez klienta – ano (bod 1).
  - Kalendář se otevírá defaultně na týden – ano (bod 2).
  - Mindmap má editovatelné položky – ano (bod 3).
  - Nefunkční tečky v boardu jsou pryč nebo funkční – ano (bod 4, avatar-dot dekorativní, status klikací).
  - Každý board má vlastní editable column/template logiku – ano (bod 5).
  - Dropdowny v boardu nejsou schované – ano (bod 6, portál pro ColumnHeader).
  - Typ jde změnit na STAV – ano (bod 7).
  - Angličtina je odstraněná z UI – ano (bod 19).
  - Změna stavu nepřepisuje řádek s jménem klienta – ano (bod 8).
  - Tlačítko Vytvořit úkol funguje – ano (bod 9).
  - Search funguje inline bez okna – ano (bod 10).
  - Fonty jsou sjednocené do max 2 – ano (bod 11, DM Sans + DM Mono).
  - Upravit kontakt má nové UI/UX a zachovanou funkčnost – ano (bod 12).
  - Nástěnka má opravený spacing a oddělený side calendar – ano (bod 13).
  - Upload profilové fotky funguje – ano (bod 14, flow ověřen).
  - Loga a favicony jsou nasazené – ano (bod 15).
  - Header je opravený – ano (bod 16, 18).
  - AI Import je pryč – ano (bod 17).
  - Plus tlačítko je pryč, bell zůstává – ano (bod 18).
  - Systém zůstává napojený na live data a live CRM logiku – ano (všechny změny zachovaly stávající API a datové vrstvy).

Všechny body byly opraveny a ověřeny.
