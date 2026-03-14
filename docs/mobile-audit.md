# Mobile UX/UI Audit – Aidvisora

Audit hlavních obrazovek a komponent pro mobile viewport (do 768px). Slouží jako vstup pro Mobile responsiveness overhaul.

---

## 1. Topbar (PortalShell)

| Kontrola | Stav | Poznámka |
|----------|------|----------|
| Přecpanost | Střední | Hamburger + search + 3 ikony (Nový, notifikace, user) – na velmi úzkém viewportu může být těsno |
| Výška | OK | py-3 md:py-4; na mobilu rozumné |
| Search | K upravě | Vždy viditelný inline; požadavek: na mobilu ikona → expand/overlay/sheet |
| Nový (QuickNewMenu) | OK | min-h-[44px] v draweru; v headeru ikona |
| Overflow menu | Chybí | Sekundární akce nejsou v overflow menu – přidat na velmi malý viewport |
| Sticky | OK | sticky top-0 z-50 |

**Priorita:** Důležitá (search expand, overflow menu).

---

## 2. Sidebar / mobile drawer (PortalSidebar)

| Kontrola | Stav | Poznámka |
|----------|------|----------|
| Breakpoint | Nekonzistence | PortalShell 768px (min-width), Sidebar 767px (max-width) – sjednotit na 768 |
| Animace | OK | transition-[width,transform] duration-300 |
| Overlay | OK | fixed inset-0 bg-black/40, klik zavře |
| Touch targets | OK | Položky menu mají dostatečnou výšku |
| Scroll v draweru | OK | Flex layout, obsah scrolluje |
| Search v menu | OK | Vyhledávání v položkách sidebaru |
| Zavření | OK | Overlay, Escape, po navigaci |

**Priorita:** Kritická (sjednocení breakpointu).

---

## 3. Nástěnka (DashboardEditable, today/page)

| Kontrola | Stav | Poznámka |
|----------|------|----------|
| KPI karty | OK | grid-cols-1 sm:grid-cols-3 – na mobilu 1 sloupec |
| Quick actions | OK | flex-wrap gap-3, min-h-[44px] na odkazech |
| Widgety | Střední | Drag-drop na mobilu může být problematický; pořadí sekcí OK |
| Stacking | OK | Jednosloupcový flow na mobilu |
| Spacing | OK | space-y, mb-6, mb-8 |

**Priorita:** Nízká (možná vylepšení pořadí widgetů pro mobil).

---

## 4. Seznamové stránky

### Kontakty (ContactsPageClient)

| Kontrola | Stav | Poznámka |
|----------|------|----------|
| Mobilní varianta | OK | md:hidden card list; hidden md:block tabulka |
| Filtry | Střední | Tabs + search + select v jednom řádku; na mobilu může být přeplácané – zvážit chips / bottom sheet |
| Touch targets | OK | min-h-[44px] na tlačítkách a ikonách v kartách |
| Akce | OK | Telefon, e-mail, úkol, zpráva, Detail v kartě |

### Ostatní listy (AnalysesPageClient, mindmap list, contract review, messages, tasks, households)

- Obecně: zkontrolovat, zda na mobilu existuje card/stacked varianta místo tabulky.
- Filtry: jednotný pattern (chips nebo bottom sheet).

**Priorita:** Důležitá (sjednotit filtr pattern, ověřit všechny seznamy).

---

## 5. Detail stránky (kontakt, obchod, domácnost)

| Kontrola | Stav | Poznámka |
|----------|------|----------|
| Taby (ContactTabLayout) | OK | overflow-x-auto hide-scrollbar, min-h-[44px] |
| KPI / obsah | OK | Jednosloupcový layout na mobilu |
| Sticky akce | Částečně | Zavolat, Zpráva v hero – ne vždy sticky; zvážit sticky bottom bar na mobilu pro primární akce |

**Priorita:** Střední.

---

## 6. Formuláře a wizardy

| Kontrola | Stav | Poznámka |
|----------|------|----------|
| BaseModal | K úpravě | Vždy centrovaný box, max-h-[90vh]; na mobilu žádná full-screen/sheet varianta |
| NewClientWizard | K úpravě | V BaseModal; chybí sticky spodní lišta na mobilu |
| 2-column layout | Různé | V wizardech grid-cols-2 – na mobilu by měl být 1 sloupec |
| Input výška / spacing | Střední | Zvětšit vertikální spacing na mobilu |
| Validace | OK | Chyby zobrazeny |

**Priorita:** Kritická (modal/sheet na mobilu, sticky CTA).

---

## 7. Modaly a overlay

| Soubor / oblast | Stav | Poznámka |
|-----------------|------|----------|
| BaseModal | Centered, max-h-90vh | Na mobilu vhodné převést na full-screen nebo bottom sheet pro formuláře |
| ConfirmDeleteModal | Malý obsah | OK ponechat jako malý dialog |
| Calculator contact modals | fixed inset-0 | Full overlay – ověřit scroll a zavření |
| Calendar modals | fixed inset-0 z-[200] | Overlay – ověřit na malém viewportu |
| Review modals | fixed inset-0 | Schválit/Zamítnout – zvážit sticky footer na mobilu |

**Priorita:** Kritická (BaseModal varianta pro mobil).

---

## 8. Tabulky a dense data

| Oblast | Stav | Poznámka |
|--------|------|----------|
| Kontakty | OK | Mobil: karty; desktop: tabulka |
| Contracts, production, pipeline, AnalysesPageClient | Zkontrolovat | Ověřit card/stacked variantu na mobilu; případně overflow-x-auto jen jako dočasné řešení |

**Priorita:** Důležitá (audit všech tabulek).

---

## 9. Kalendář (PortalCalendarView, WeekDayGrid)

| Kontrola | Stav | Poznámka |
|----------|------|----------|
| Layout | Různé | matchMedia(max-width: 767px) – sjednotit breakpoint; mobilní layout existuje |
| Eventy | OK | Karty/čitelné |
| Vytvoření/editace události | Zkontrolovat | Modal vs full-screen/sheet na mobilu |
| Sticky „Přidat“ | Zkontrolovat | Dostupnost bez scrollu |

**Priorita:** Důležitá.

---

## 10. Úkoly (tasks/page)

| Kontrola | Stav | Poznámka |
|----------|------|----------|
| Mobilní panel | OK | fixed inset-0 z-50 md:hidden – celoobrazovkový panel na mobilu |
| Filtry | Zkontrolovat | Chips nebo sheet |
| CTA „Vytvořit úkol“ | Zkontrolovat | Snadno dostupné |

**Priorita:** Střední.

---

## 11. Kalkulačky

| Kontrola | Stav | Poznámka |
|----------|------|----------|
| Sticky CTA | Částečně | Pension, Mortgage, Life mají lg:hidden fixed bottom-0 s safe-area; rozšířit na všechny kalkulačky |
| Inputy / výsledky | OK | Single column na mobilu v řadě komponent |
| Safe area | OK | pb-[env(safe-area-inset-bottom)] kde je sticky CTA |

**Priorita:** Střední (jednotný pattern všude).

---

## 12. Finanční analýzy

| Kontrola | Stav | Poznámka |
|----------|------|----------|
| Stepper | Zkontrolovat | Kompaktní na mobilu (ikony / zkrácené názvy) |
| Kroky | Zkontrolovat | Single column, sticky Další/Uložit |
| Dlouhé kroky | Zkontrolovat | Scrollovatelný obsah |

**Priorita:** Důležitá.

---

## 13. Review smluv (contracts/review)

| Kontrola | Stav | Poznámka |
|----------|------|----------|
| Seznam | Zkontrolovat | Karty na mobilu vs tabulka |
| Detail | Zkontrolovat | Sticky akce (Schválit, Zamítnout) na mobilu |
| Filtry | Zkontrolovat | Chips / sheet |

**Priorita:** Důležitá.

---

## 14. Mindmap

| Kontrola | Stav | Poznámka |
|----------|------|----------|
| Seznam (MindmapListClient) | Zkontrolovat | Karty, touch targets |
| Canvas (MindmapView) | OK | fixed inset-0 na mobilu pro panel; touch pan/zoom |
| Ovládání | Zkontrolovat | Min 44px touch targets |

**Priorita:** Střední.

---

## 15. Toast a floating prvky

| Kontrola | Stav | Poznámka |
|----------|------|----------|
| Toast pozice | Riziko | fixed bottom-4 right-4 z-50 – může kolidovat s AI tlačítkem (right-4 bottom-4 / bottom-6) |
| AI tlačítko | OK | min-w-[48px] min-h-[48px]; chybí safe-area inset |
| AiAssistantDrawer | OK | Na mobilu full overlay; ověřit scroll a touch |
| Z-index | Různé | z-50 (toast), z-[60] (AI button), z-[100] overlay – sjednotit vrstvy |

**Priorita:** Kritická (toast nad AI, safe area, z-index systém).

---

## 16. Z-index (celková nekonzistence)

Aktuální výskyty: z-10, z-20, z-30, z-40, z-50, z-[60], z-[100], z-[101], z-[200]. Chybí centrální schéma (base, sticky, overlay, dropdown, drawer, modal, toast, floating).

**Priorita:** Kritická (Fáze 2).

---

## Shrnutí priorit

| Priorita | Položky |
|----------|---------|
| Kritická | Breakpoint 767/768; BaseModal → sheet/full-screen na mobilu; sticky CTA u wizardů; z-index vrstvy; toast vs AI + safe area |
| Důležitá | Topbar search expand a overflow menu; filtry (chips/sheet) na listech; FA stepper a sticky CTA; review smluv list/detail; kalendář modal/sheet |
| Střední | Detail stránky sticky akce; úkoly filtry; kalkulačky jednotný CTA pattern; mindmap ovládání |
| Nízká | Nástěnka pořadí widgetů; drobné spacing úpravy |

---

## Přehled obrazovek k úpravě (pro implementaci)

- **Shell:** PortalShell (topbar), PortalSidebar (drawer), Toast, AI button.
- **List/detail:** ContactsPageClient, ListPageHeader/Toolbar/Shell, ContactTabLayout, contacts/[id]/page, pipeline, messages, tasks, households, AnalysesPageClient, mindmap list/detail, contract review list/detail.
- **Formuláře/wizardy:** BaseModal, NewClientWizard, FA stepper a kroky, contact edit, calculator steps.
- **Kalendář:** PortalCalendarView, WeekDayGrid.
- **Kalkulačky:** Všechny calculator pages – jednotný sticky CTA.
- **Review:** contracts/review page a detail.
