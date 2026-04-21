# Outbound mail audit

> Delta A2/A3. `notification_log` tabulka existovala, ale `logNotification` se nevolalo z většiny `sendEmail` cest. Zároveň nebyl webhook handler pro Resend bounce/complaint → bounce rate rostl tichým způsobem, což eventuálně stojí suspension verified doména.

## Co je teď v kódu

1. **`sendEmail({ audit })`** — `apps/web/src/lib/email/send-email.ts` automaticky zapíše řádek do `notification_log` včetně `providerMessageId`, pokud caller předá `audit: { tenantId, contactId?, template?, meta? }`.
2. **`/api/resend/webhook`** — ověřený (Svix signature) endpoint pro Resend události `email.delivered`, `email.bounced`, `email.complained`, `email.opened`, `email.clicked`, `email.delivery_delayed`. Update provedene přes `providerMessageId` na existující řádek.
3. **Migrace** `packages/db/migrations/notification-log-provider-id-2026-04-21.sql` přidává sloupce `provider_message_id`, `last_status`, `last_status_at`, `last_error` + indexy.

## Call-sites k patchnutí (callers, kteří dnes Resend volají přímo nebo `sendEmail` bez `audit`)

Audit odhalil tyto soubory — každý potřebuje buď přepnout na `sendEmail({ audit })` s tenantem/kontaktem, nebo zavolat `logNotification()` explicitně:

1. `apps/web/src/app/actions/payment-pdf.ts` — volá `resend.emails.send` přímo. Přepsat na `sendEmail({ audit: { tenantId, contactId, template: "payment-pdf" } })`.
2. `apps/web/src/app/api/cron/service-reminders/route.ts` — přímý Resend SDK. Musí předat tenant a contact ID.
3. `apps/web/src/app/api/cron/event-reminders/route.ts` — přímý Resend SDK.
4. `apps/web/src/app/actions/team.ts` — `sendEmail` bez audit stopy. `tenantId` je dostupný, `template: "team-invite"`.
5. `apps/web/src/app/actions/auth.ts` — klientská invite/reminder, `template: "client-invite"`.
6. `apps/web/src/app/actions/notifications.ts` — `processServiceReminders` loop, `template: "service-reminder"`.
7. `apps/web/src/lib/public-booking/public-booking-emails.ts` — public booking confirm/cancel. `tenantId` poradce je dostupný.
8. `apps/web/src/app/api/portal/feedback/route.ts` — feedback na founders@, nemá contact. Použít `tenantId` odesílatele nebo speciální `SYSTEM_TENANT_ID`.

Migrační strategie: jeden PR = `sendEmail` update + migrace + webhook, pak PR per call-site s test coverage.

## Resend dashboard setup (MANUAL EXT)

1. **Login** na Resend → Webhooks → **Create Webhook**.
2. **Endpoint URL:** `https://www.aidvisora.cz/api/resend/webhook`
3. **Events:** zaškrtnout všech 6 (sent, delivered, bounced, complained, opened, clicked, delivery_delayed).
4. **Signing secret** → zkopírovat (prefix `whsec_`) → Vercel env `RESEND_WEBHOOK_SECRET` (Production + Preview) → redeploy.
5. Test: Resend dashboard → Webhook → **Send test event** → ověřit v DB:
   ```sql
   SELECT provider_message_id, last_status, last_status_at FROM notification_log
   WHERE created_at > now() - interval '5 minutes'
   ORDER BY created_at DESC LIMIT 10;
   ```

## Monitoring bounce / complaint rate

Denní SQL query (lze poslat cronem do Slacku):

```sql
SELECT
  date_trunc('day', sent_at) AS day,
  COUNT(*) FILTER (WHERE last_status = 'delivered') AS delivered,
  COUNT(*) FILTER (WHERE last_status = 'bounced') AS bounced,
  COUNT(*) FILTER (WHERE last_status = 'complained') AS complained,
  ROUND(100.0 * COUNT(*) FILTER (WHERE last_status = 'bounced') / NULLIF(COUNT(*), 0), 2) AS bounce_pct
FROM notification_log
WHERE channel = 'email'
  AND sent_at > now() - interval '7 days'
GROUP BY 1 ORDER BY 1 DESC;
```

**Threshold:** bounce > 2 % → suspension risk u Resend, okamžitě zastavit kampaně / kontrolovat validitu `contacts.email`.

## Opt-out compliance

`contacts.notification_unsubscribed_at` už existuje — před každým `sendEmail` kontrolovat. Při bounce `permanent` + `complained` zasadit do `contacts.notification_unsubscribed_at = now()` automaticky. TODO — zatím manual; do Q3 přidat trigger / app logic.
