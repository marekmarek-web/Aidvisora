# Client Portal Flow (Phase 5/6)

Stručná mapa klientského portálu pro developery a agentní modely.  
Cíl: pochopit flows rychle, bez čtení celého kódu.

---

## 1. Auth guard — vstup do `/client/**`

```
GET /client/*
  → apps/web/src/app/client/layout.tsx
      └─ requireClientZoneAuth()            ← apps/web/src/lib/auth/require-auth.ts
           Contract:
           - roleName === "Client" + contactId set → OK
           - non-Client role → redirect /portal
           - unauthenticated → redirect /prihlaseni
           - pending password change → redirect /password-setup
           - Client bez contactId → redirect /prihlaseni?error=auth_error
```

Každá `/client/**/page.tsx` volá `requireClientZoneAuth()` samostatně (layout + page, defense in depth).  
Server actions: `requireAuthInAction()` + manuální `auth.roleName !== "Client"` check.

---

## 2. Session bundle (dashboard + mobile SPA)

```
loadClientPortalSessionBundle(auth)        ← apps/web/src/lib/client-portal/client-portal-session-bundle.ts
  ├─ requireClientZoneAuth() interně
  ├─ portfolio (contracts, documents, segments)
  ├─ requests (advisor_material_requests + messages)
  ├─ notifications (unread count)
  └─ financialSummary

Mobile SPA entry:
  GET /client/mobile/  → apps/web/src/app/client/mobile/
      └─ loadClientPortalSessionBundle() → ClientMobileInitialData (JSON)
         Bezpečné: tenantId se nevystavuje klientovi (pouze v session serveru)
```

---

## 3. Notifikace

### Vytvoření (CRM/advisor side)
```
createPortalNotification(params)           ← apps/web/src/app/actions/portal-notifications.ts
  ├─ Dedup check (5 min window, same type + relatedEntityId)
  ├─ INSERT do portalNotifications
  └─ sendPushForPortalNotification()        ← apps/web/src/lib/push/send.ts
       └─ captureNotificationDeliveryFailure() při selhání (Sentry, Phase 6H)
```

### Deep-link routing (všechny vstupy)
```
getPortalNotificationDeepLink(type, relatedEntityType, relatedEntityId)
  ← apps/web/src/lib/client-portal/portal-notification-routing.ts

Používají: bell icon, notifikační stránka, toast stack
Typy → routes:
  advisor_material_request → /client/pozadavky-poradce/{id}
  new_document             → /client/documents
  new_message              → /client/messages
  request_status_change    → /client/pozadavky-poradce/{id}
  important_date           → /client/portfolio
```

### Toast stack (polling)
```
ClientMaterialRequestToastStack            ← apps/web/src/app/client/ClientMaterialRequestToastStack.tsx
  - Polling interval: 35 s (v1 rozhodnutí — websocket není scope Fáze 5/6)
  - Scope: pouze advisor_material_request notifikace
  - href generuje přes getPortalNotificationDeepLink (konzistentní s bell/page)
```

---

## 4. Požadavky poradce (advisor_material_requests)

### List
```
GET /client/pozadavky-poradce/
  → apps/web/src/app/client/pozadavky-poradce/page.tsx
      └─ getClientMaterialRequests()        ← apps/web/src/app/actions/advisor-material-requests.ts
```

### Detail + reply
```
GET /client/pozadavky-poradce/[id]/
  → apps/web/src/app/client/pozadavky-poradce/[id]/page.tsx
      └─ getClientMaterialRequestDetail()
           ├─ detail.internalNote = null   ← data leak guard (Phase 6B)
           └─ vrací zprávy, přílohy (bez interní poznámky)

POST (server action): respondClientMaterialRequest(requestId, message, files)
  ├─ auth guard (Client + contactId)
  ├─ terminal status guard: status==="closed"|"done" → error + Sentry (Phase 6D+6H)
  ├─ INSERT message + upload přílohy
  │     └─ captureAttachmentLinkFailure() při upload erroru (Phase 6H)
  ├─ UPDATE status → "answered"
  └─ emitNotification() pro advisora (best-effort)
```

---

## 5. Dokumenty a viditelnost

```
Dokument je visible klientovi pokud:
  documents.visibleToClient = true
  + documents.contactId = auth.contactId
  + documents.tenantId = auth.tenantId

Publikování přes AI Review (linkContractReviewFileToContactDocuments):
  ├─ Publish guard: visibleToClient=true → reviewStatus musí být "approved" nebo "applied"
  │     → capturePublishGuardFailure() při narušení (Phase 6H)
  └─ INSERT do documents (bez kopírování v úložišti)
```

---

## 6. Klíčové soubory na jednom místě

| Oblast | Soubor |
|--------|--------|
| Auth guard | `apps/web/src/lib/auth/require-auth.ts` |
| Session bundle | `apps/web/src/lib/client-portal/client-portal-session-bundle.ts` |
| Notification routing | `apps/web/src/lib/client-portal/portal-notification-routing.ts` |
| Portal notifications (action) | `apps/web/src/app/actions/portal-notifications.ts` |
| Material requests (action) | `apps/web/src/app/actions/advisor-material-requests.ts` |
| Push delivery | `apps/web/src/lib/push/send.ts` |
| Observability | `apps/web/src/lib/observability/portal-sentry.ts` |
| Testy (regression gate) | `apps/web/src/lib/client-portal/__tests__/phase-6f-phase5-6-release-gate.test.ts` |

---

## 7. Co NENÍ scope tohoto flow

- Advisor-side CRM views (`/portal/**`) — jiný auth guard (`requireAuth`)
- Payment setup flow — viz `apps/web/src/app/actions/contracts.ts` + `payment-accounts.ts`
- AI asistent chat — viz `apps/web/src/lib/assistant/`
