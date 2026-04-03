# Client Portal – P2.2 + P2.3 Release Gate & Smoke Scenarios

## Scope

P2.2 – Client route auth consistency  
P2.3 – Client portal hardening bez redesignu

---

## P2.2 – Reuse audit výsledky

### Keep (beze změny)
- `requireClientZoneAuth()` v layout.tsx ✅
- Demo/dev bypass logika v `require-auth.ts` ✅
- Redirect logika pro non-Client přístupy ✅

### Patched
- Všechny client pages (13 souborů) přešly z `requireAuth()` → `requireClientZoneAuth()`
- Guard zjednodušen: `if (auth.roleName !== "Client" || !auth.contactId)` → `if (!auth.contactId)` (role garantuje layout)
- `profile/page.tsx` – odstraněn redundantní try/catch + `isRedirectError` (layout to already handles)
- `requests/new/page.tsx` – guard odstraněn zcela (requireClientZoneAuth garantuje Client + contactId)

### Exact files patched (P2.2)
```
apps/web/src/app/client/payments/page.tsx
apps/web/src/app/client/messages/page.tsx
apps/web/src/app/client/notifications/page.tsx
apps/web/src/app/client/documents/page.tsx
apps/web/src/app/client/requests/page.tsx
apps/web/src/app/client/requests/new/page.tsx
apps/web/src/app/client/portfolio/page.tsx
apps/web/src/app/client/profile/page.tsx
apps/web/src/app/client/calculators/page.tsx
apps/web/src/app/client/calculators/investment/page.tsx
apps/web/src/app/client/calculators/mortgage/page.tsx
apps/web/src/app/client/pozadavky-poradce/page.tsx
apps/web/src/app/client/pozadavky-poradce/[id]/page.tsx
```

### Out of scope (P2.2)
- Advisor portal auth (je mimo client zone)
- Demo auth logic (záměrné, dle plánu nezasahovat)
- Mobile auth (ClientMobileApp je servován z clientzone layoutu)

---

## P2.3 – Reuse audit výsledky

### Keep (beze změny)
- `ClientNotificationsList.tsx` – mark-read on click + canonical routing ✅
- `portal-notification-routing.ts` – `getPortalNotificationDeepLink()` single source ✅
- `getPortalNotificationsUnreadCount()` – SQL COUNT (ne full-row select) ✅
- `ClientChatWrapper.tsx` – volá `markMessagesRead()` při každém načtení ✅
- `loadClientPortalSessionBundle()` – cached, kompletní dashboard loader ✅
- `ClientMaterialRequestRespondForm` na detail stránce požadavku ✅
- Redirect pages `/client/contracts` → `/client/portfolio` ✅
- Redirect pages `/client/investments` → `/client/portfolio` ✅

### Patched
- `ClientPortalTopbar.tsx` – přidány chybějící tituly: `pozadavky-poradce`, `investments` do `PAGE_TITLES`
- `ClientPortalShell.tsx` – přidán prop `unreadMessagesCount`
- `ClientSidebar.tsx` – přidán badge na "Zprávy poradci" pro `unreadMessagesCount`, nová logika `showMessagesBadge`
- `layout.tsx` – předává `unreadMessagesCount` do shell separátně

### Extend (bylo přidáno)
- Sidebar badge pro zprávy (samostatný počítač, oddělený od notification badge)

### Do-not-rebuild
- ClientChatWrapper polling logic
- Notification toast stack
- ClientDashboardLayout
- ClientWelcomeView
- Mobile SPA (ClientMobileClient.tsx) – already má správnou badge logiku

### Out of scope (P2.3)
- Redesign UI komponent
- Přepisování fungující chat logiky
- Přepisování document upload flow
- Přepisování portfolio read modelu

---

## Smoke scénáře – před deployem ověřit manuálně

### Auth (P2.2)

| # | Scénář | Expected |
|---|--------|----------|
| 1 | Nepřihlášený uživatel navštíví `/client/portfolio` | Redirect → `/prihlaseni?error=auth_error` |
| 2 | Advisor (non-Client role) navštíví `/client/messages` | Redirect → `/portal` |
| 3 | Klient přihlášen → navštíví `/client/profile` | Stránka se načte, žádný prázdný return null |
| 4 | Demo mode + `x-demo-client-zone: 1` header | Client zóna se načte s demo kontaktem |

### Unread counts (P2.3)

| # | Scénář | Expected |
|---|--------|----------|
| 5 | Poradce pošle zprávu klientovi | Bell badge v topbaru se zvýší; sidebar "Zprávy poradci" zobrazí červený badge |
| 6 | Klient otevře `/client/messages` | Zprávy jsou označeny jako přečtené, sidebar badge zmizí |
| 7 | Klient klikne na notifikaci v `/client/notifications` | Notifikace označena jako přečtená, přesměrování na správnou stránku |
| 8 | Bell badge po přečtení zprávy i notifikace | Celkový počet klesne na 0 |

### Routing (P2.3)

| # | Scénář | Expected |
|---|--------|----------|
| 9  | Topbar titulek na `/client/pozadavky-poradce` | Zobrazí „Od poradce" (ne fallback „Klientská zóna") |
| 10 | Topbar titulek na `/client/pozadavky-poradce/[id]` | Zobrazí „Od poradce" (startsWith match) |
| 11 | Navigace na `/client/contracts` | Redirect → `/client/portfolio` bez chyby |
| 12 | Navigace na `/client/investments` | Redirect → `/client/portfolio` bez chyby |
| 13 | Kliknutí na notifikaci typu `advisor_material_request` | Přesměrování na `/client/pozadavky-poradce/[id]` |
| 14 | Kliknutí na notifikaci typu `new_document` | Přesměrování na `/client/documents` |
| 15 | Kliknutí na notifikaci typu `request_status_change` | Přesměrování na `/client/requests` |

### Wiring (P2.3)

| # | Scénář | Expected |
|---|--------|----------|
| 16 | Dashboard stránka `/client` | Načte data ze session bundle (kontrakty, dokumenty, notifikace) |
| 17 | Portfolio stránka | Zobrazí seskupené smlouvy, metriky, source document linky |
| 18 | Documents stránka | Zobrazí seznam dokumentů, upload funguje |
| 19 | Requests stránka | Zobrazí moje požadavky + od poradce v jednom přehledu |
| 20 | Request detail `/client/pozadavky-poradce/[id]` | Zobrazí detail, přílohy, komunikaci, respond form (pokud open) |

---

## Acceptance criteria (P2.2 + P2.3)

- [ ] Žádná client page nepoužívá generický `requireAuth()` (pouze `requireClientZoneAuth()`)
- [ ] Bell badge v topbaru zobrazuje součet notifikací + nepřečtených zpráv
- [ ] Sidebar badge „Zprávy poradci" zobrazuje pouze `unreadMessagesCount`
- [ ] Sidebar badge „Oznámení" zobrazuje součet notifikací + zpráv (kombinovaný)
- [ ] Topbar titulek se zobrazuje správně pro všechny client routes vč. `pozadavky-poradce`
- [ ] Smoke scénáře 1–20 projdou bez chyby
