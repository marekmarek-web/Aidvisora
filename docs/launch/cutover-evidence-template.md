# aidvisora_app cutover — EVIDENCE PACK template

> **Použití:** zkopíruj tento soubor do
> `docs/launch/cutover-evidence-<env>-YYYY-MM-DD.md`, vyplň každou sekci
> přímo během cutoveru. Prázdná / "N/A" políčka = gate fail.
>
> **Source of truth runbook:** [`docs/audit/aidvisora-app-cutover-runbook.md`](../audit/aidvisora-app-cutover-runbook.md)
>
> **Sentry alert:** [A13 `db_error_kind`](../observability/sentry-alerts.md#a13--db-role-cutover-guard--db_error_kind-spike-p0)

---

## 0. Hlavička

| Pole | Hodnota |
|---|---|
| Prostředí | `staging` | `production` |
| Datum zahájení | YYYY-MM-DD HH:MM CET |
| Operátor | Marek |
| Git SHA (web runtime) | `<git rev-parse HEAD>` |
| Vercel deployment ID | `dpl_…` |
| Supabase project ref | `<ref>` |
| Runtime role PŘED | `postgres` (BYPASSRLS) |
| Runtime role PO | `aidvisora_app` (NOBYPASSRLS + FORCE RLS) |
| Service role (crony/webhooky) | `postgres` přes `DATABASE_URL_SERVICE` |

---

## 1. Pre-cutover gate (blocking)

Všechny řádky musí být `PASS` před swap env vars.

| Check | Výsledek | Artefakt / log |
|---|---|---|
| `aidvisora_app` role existuje, `rolsuper=false`, `rolbypassrls=false` | PASS / FAIL | paste output `SELECT rolname, rolsuper, rolbypassrls, rolcanlogin FROM pg_roles WHERE rolname='aidvisora_app';` |
| `rls-m8-bootstrap-provision-and-gaps-2026-04-22.sql` aplikovaná | PASS / FAIL | `select count(*) from pg_policies where tablename='audit_log'` = očekáváno |
| `rls-m9-bootstrap-sd-functions-2026-04-22.sql` aplikovaná | PASS / FAIL | `proname` pro `accept_staff_invitation_v1`, `process_unsubscribe_by_token_v1` existuje |
| `rls-m10-storage-default-deny-2026-04-22.sql` aplikovaná | PASS / FAIL | policy `storage_non_documents_deny_%` existuje |
| `storage.objects.relrowsecurity = true` | PASS / FAIL | `SELECT relrowsecurity FROM pg_class WHERE relname='objects'` |
| PITR / daily backup ON | PASS / FAIL | screenshot Supabase Dashboard → Database → Backups |
| Live integration test `rls-live.test.ts` (7/7) | PASS / FAIL | paste vitest output (timestamp) |
| SQL smoke pack `scripts/smoke-rls-aidvisora-app.sql` — všechny `leak_*` = 0 | PASS / FAIL | paste `=== VERDIKT ===` sekce |
| Static guard `ws2-batch6-full-swap-readiness.test.ts` (17/17) | PASS / FAIL | paste vitest output |
| `DATABASE_URL_SERVICE` nastaveno (Vercel env, non-empty, ne placeholder) | PASS / FAIL | `vercel env ls` screenshot (maskované heslo) |
| `DATABASE_URL_ROLLBACK` nastaveno (kopie stávajícího `DATABASE_URL`) | PASS / FAIL | `vercel env ls` screenshot |
| Sentry A13 alert aktivní v `production` | PASS / FAIL | screenshot Sentry Alerts rule |
| Baseline Sentry error rate (last 24h) | `<n> events/h` | screenshot Sentry Dashboard |

---

## 2. Swap env vars (T-0)

| Krok | Čas (HH:MM) | Poznámka |
|---|---|---|
| Banner "Probíhá údržba" ON (pokud prod) | | kill-switch `MAINTENANCE_MODE=true` |
| `DATABASE_URL` → `aidvisora_app` pooler string | | maskovat heslo v evidence |
| `DATABASE_URL_SERVICE` → `postgres` pooler string | | maskovat heslo |
| `DATABASE_URL_ROLLBACK` potvrzeno (původní postgres string) | | |
| Vercel redeploy triggered | | deployment URL / ID |
| Vercel redeploy READY | | elapsed min. |
| Banner OFF | | |

---

## 3. Smoke pack (post-swap)

Vyplň **ANO / NE + timestamp**. NE = rollback podle §5 runbooku.

### 3.1 Auth + core navigation
- [ ] Login advisor (email/heslo)
- [ ] Login klient (client portal)
- [ ] Apple Sign-In (iOS TestFlight build na fyzickém zařízení) — pouze prod
- [ ] Dashboard / Today page renderuje kontakty, smlouvy, úkoly
- [ ] Contact detail + timeline
- [ ] Contract list + detail

### 3.2 Write paths (RLS kritické)
- [ ] Document upload + preview
- [ ] AI review read (existující review se otevře)
- [ ] Messages — odeslat zprávu advisor → klient
- [ ] Notifications — seznam se načte
- [ ] Events / Calendar — vytvořit event

### 3.3 Pre-auth / service identity paths
- [ ] Invite URL — lookup přes `lookup_invite_metadata_v1`
- [ ] Unsubscribe URL — `process_unsubscribe_by_token_v1`
- [ ] Public booking (pokud zapnuté v tenantu) — `resolve_public_booking_v1`

### 3.4 Cron + webhooks (service role)
- [ ] Další tick `analytics-snapshot` bez chyby (Vercel Cron logs)
- [ ] Další tick `grace-period-check` bez chyby
- [ ] Stripe webhook — test event `invoice.payment_succeeded` (Stripe Dashboard → Events → Send test)
- [ ] Resend webhook — test event `email.delivered`

### 3.5 Audit log continuity
```sql
SELECT count(*) FROM audit_log WHERE created_at > now() - interval '30 min';
-- Očekávání: > 0 (audit triggery píšou pod novou runtime rolí)
```
Výsledek: `<n>`

---

## 4. Sentry watch window

**Filtr:** `environment:<env> tags[db_error_kind]:[rls_deny,missing_guc,permission_denied]`

| Okno | db_error_kind events | Action |
|---|---|---|
| T+0 až T+15 min (canary internal) | | Musí být 0. Jinak rollback §5. |
| T+15 až T+45 min (10 %) | | Musí být 0. |
| T+45 až T+105 min (50 %) | | Musí být 0. |
| T+105 min až T+24h (100 %) | | Musí být 0. |

**Baseline (last 24h) error rate:** `<n> events/h`  
**Post-cutover error rate (T+60 min):** `<n> events/h` → **delta:** `+/- n`

Pokud delta > +20 % bez `db_error_kind` příčiny → investigate, ale ne automatický rollback.

---

## 5. Rollback drill (staging only, povinné před prod)

| Pole | Hodnota |
|---|---|
| Zahájení drillu | HH:MM |
| `DATABASE_URL` ↔ `DATABASE_URL_ROLLBACK` swap | HH:MM |
| Vercel redeploy READY | HH:MM |
| Smoke po rollbacku (login + 1 write path) | PASS / FAIL |
| Elapsed total | `<minuty>` (target < 10 min) |
| Návrat na aidvisora_app po drillu | HH:MM |

---

## 6. 14-dní burn-in (staging only)

| Den | Datum | db_error_kind events | Error rate delta | Incident? |
|---|---|---|---|---|
| D+1 | | 0 | | |
| D+2 | | 0 | | |
| D+3 | | 0 | | |
| D+7 | | 0 | | |
| D+14 | | 0 | | GO / NO-GO prod |

**GO gate pro prod:** 14 dní bez `db_error_kind` eventů + bez RLS-related 500s + rollback drill provedený.

---

## 7. Post-cutover housekeeping (24h+)

- [ ] Rotace `postgres` hesla v Supabase Dashboard
- [ ] Update `DATABASE_URL_SERVICE` s novým `postgres` heslem
- [ ] `DATABASE_URL_ROLLBACK` — buď smazat, nebo update na re-resetnuté heslo
- [ ] 1Password trezor "Aidvisora / Supabase" aktualizován
- [ ] Log do `docs/launch/cutover-log.md` — datum, result, odkaz na tento evidence file

---

## 8. Verdikt

- [ ] **Staging 14-day burn-in:** GO / NO-GO
- [ ] **Prod cutover:** GO / NO-GO (jen pokud staging = GO)
- [ ] **Registration safety:** viz runbook §6 — PB pilot = GO, veřejný self-serve = NO-GO do samostatného auditu.

Podpis operátora: Marek — YYYY-MM-DD HH:MM
