# Phase 6H – Observability & Production Debugging Notes

## Co bylo přidáno

### `apps/web/src/lib/observability/portal-sentry.ts`

Nový Sentry helper soubor pokrývající Phase 5/6 portal flows:

| Helper | Kdy se volá | Feature tag |
|---|---|---|
| `captureNotificationDeliveryFailure` | Push notifikace selže v `createPortalNotification` | `portal_notification_delivery` |
| `captureRequestReplyFailure` | Klient se pokouší odpovědět na uzavřený požadavek | `material_request_reply` |
| `captureAttachmentLinkFailure` | Upload souboru selže v `respondClientMaterialRequest` | `material_request_attachment_link` |
| `capturePublishGuardFailure` | Review není schválena před aplikací do CRM nebo viditelností | `portal_publish_guard` |
| `captureAuthGuardMismatch` | Neočekávané selhání auth guardu v serverových akcích | `portal_auth_guard` |

### Kontext v každé chybě

Každý helper přidává do Sentry scope:
- `tenant_id` (tag)
- `feature` (tag)
- stable fingerprint pro grupování
- context objekt s `tenantId`, `contactId` / `requestId` / `reviewId`, `reason`

### Napojení na produkční kód

| Soubor | Místo instrumentace |
|---|---|
| `apps/web/src/lib/ai/apply-contract-review.ts` | Publish guard — `reviewStatus !== "approved"` |
| `apps/web/src/app/actions/contract-review.ts` | Publish guard — `visibleToClient=true` bez approved/applied |
| `apps/web/src/app/actions/advisor-material-requests.ts` | Closed request reply + attachment upload failure |
| `apps/web/src/app/actions/portal-notifications.ts` | Push delivery failure (best-effort, ale nyní monitorovaná) |

### Regression testy

`src/lib/observability/__tests__/portal-sentry.test.ts` — 9 testů pokrývající:
- správné volání `captureException` / `captureMessage`
- wrapping non-Error hodnot na Error instance
- zkrácení dlouhých řetězců
- no-op chování, pokud Sentry SDK hodí výjimku

## Sentry Alerts doporučení

Nastavte Sentry alert pravidla pro feature tagy:
- `portal_publish_guard` — kritická chyba, okamžité upozornění
- `portal_notification_delivery` — warning, denní digest
- `material_request_reply` — warning, denní digest  
- `material_request_attachment_link` — error, okamžité upozornění

## Co NENÍ pokryto (v1 rozsah)

- Auth guard redirect events (pouze server-side logs)
- Dedup skip tracking v notifikacích (je to záměrné chování, ne chyba)
- `requireClientZoneAuth` redirect paths (Next.js redirect není chyba)
