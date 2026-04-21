# RLS Policy Matrix — WS-2 (launch)

> Stav po dokončení WS-2 Batch 1 – 5. Doplňkový dokument k
> `docs/security/rls-production-snapshot-2026-04-19.md` (Phase 0 snapshot).
>
> **Účel:** rychlý přehled, která tabulka má RLS zapnuté, kde je `FORCE ROW LEVEL SECURITY`,
> jakou má tenant-guardrail podmínku a přes kterou migraci byla nastavena. Aktualizuj
> při jakékoli nové RLS migraci.
>
> **Kontext:** Aidvisora je interní SaaS pro finanční poradce. RLS zde nechrání před
> koncovým klientem (ten má vlastní `client_portal_*` scope), ale primárně zajišťuje
> **tenant isolation** mezi jednotlivými brokerage firmami sdílejícími jednu DB.

---

## 1. Runtime model

- **DB URL v produkci:** Drizzle pool přes Supabase `postgres.<ref>` → efektivně
  `BYPASSRLS`. RLS tedy při běžném provozu **nevynucuje DB**, vynucuje ji aplikace přes
  `withTenantContext`/`withAuthContext`, které nastavují `app.tenant_id` a `app.user_id`
  GUC a skenují vstupy. Viz `apps/web/src/lib/db/with-tenant-context.ts`.
- **Cíl přepnutí (post-launch):** runtime role `aidvisora_app` (viz
  `rls-app-role-and-force-2026-04-19.sql`), `NOSUPERUSER`, `NOBYPASSRLS`. Po přepnutí
  `DATABASE_URL` na tuto roli začnou všechny níže vyjmenované policy platit i pro
  backend. Dopředná připravenost ověřená testem
  `ws2-batch5-swap-readiness.test.ts` (statická) + RLS smoke migrací.
- **PostgREST (`anon` / `authenticated`)** plně spadá pod RLS. Browser klienti
  jdou výhradně přes RLS-gated cesty (přihlášený poradce v advisor zóně, klient
  v portal zóně).

---

## 2. Kritické tabulky — matice

Legenda:

- **RLS**: `ON` = enabled, `FORCE` = `FORCE ROW LEVEL SECURITY`.
- **Scope**: formulace WHERE v politikách.
- **Migrace**: `packages/db/migrations/<name>.sql`.

| Tabulka | RLS | Scope | Migrace |
|---|---|---|---|
| `contacts` | FORCE | `tenant_id = current_setting('app.tenant_id')::uuid` | `rls-m3-m4-messages-and-core-tables-2026-04-19.sql` |
| `documents` | FORCE | `tenant_id = current_setting('app.tenant_id')::uuid` | `rls-m3-m4-messages-and-core-tables-2026-04-19.sql` |
| `contracts` | FORCE | `tenant_id = current_setting('app.tenant_id')::uuid` (drop legacy `public.clients` ref) | `rls-cleanup-legacy-clients-contracts-tenant-2026-04-19.sql` |
| `contract_upload_reviews` | FORCE | `tenant_id` match | `rls-m3-m4-messages-and-core-tables-2026-04-19.sql` |
| `messages` | FORCE | participant scope (advisor tenant OR portal user) | `rls-m3-m4-messages-and-core-tables-2026-04-19.sql` |
| `message_attachments` | FORCE | navázáno přes `messages` | `rls-m3-m4-messages-and-core-tables-2026-04-19.sql` |
| `contact_coverage` | FORCE | `tenant_id` match | `rls-m3-m4-messages-and-core-tables-2026-04-19.sql` |
| `fa_plan_items` | FORCE | `tenant_id = current_setting('app.tenant_id')` (GUC sjednoceno) | `rls-unify-guc-app-tenant-id-2026-04-19.sql` |
| `fa_sync_log` | FORCE | `tenant_id` match | `rls-unify-guc-app-tenant-id-2026-04-19.sql` |
| `audit_log` | ON (append-only) | `tenant_id` match; `UPDATE`/`DELETE` revoked | `audit-log-append-only-2026-04-20.sql` |
| `storage.objects` (bucket `documents`) | ON | první path segment = `app.tenant_id` | `storage-documents-tenant-policies-2026-04-21.sql` |

> Další tabulky s `RLS=ON` ale bez policy — viz Phase 0 snapshot. Deny-all pod
> `authenticated`; provoz drží app runtime přes tenant-scoped queries. Tyto tabulky
> budou pokryté v post-launch batchi (WS-2 post-launch hardening).

---

## 3. GUC kontrakt

- `app.tenant_id` — UUID tenanta přihlášeného poradce/klienta. Nastavený lokálně
  v transakci přes `SET LOCAL`. Policies používají `current_setting('app.tenant_id')::uuid`.
- `app.user_id` — UUID přihlášeného uživatele (auth.users.id). Použité pro
  participant-scoped policies (`messages`).
- **Nepoužívat** `app.current_tenant_id` — sjednoceno v M1 (`rls-unify-guc-app-tenant-id-2026-04-19.sql`).
  Jakýkoli nový kód / migrace musí používat pouze `app.tenant_id`.

---

## 4. Runtime policy — klíčové body

1. **Žádný globální `db.insert/update/delete` proti tenant-scoped tabulkám**
   (ověřeno testem `ws2-batch5-swap-readiness.test.ts`). Používej
   `withAuthContext` / `withTenantContextFromAuth`.
2. **Service role (`SUPABASE_SERVICE_ROLE_KEY`)** se používá výhradně pro:
   - Supabase Auth Admin API,
   - Supabase Storage (signed URL generace, upload, delete),
   - back-office bootstrap skripty.
   Nikdy ne pro čtení dat konkrétního tenanta v user-facing cestě — tam vždy
   projít přes `withAuthContext`.
3. **IDOR guardrail** — každý helper, který bere `documentId` / `contractId` /
   `contactId` z requestu, musí povinně dostat `tenantId` z auth kontextu a použít
   ho ve WHERE. Ověřeno v batch 2 (`page-text-map-lookup.ts`, `resolve-ai-input.ts`,
   `from-document-extraction.ts`).

---

## 5. Připravenost na `aidvisora_app` swap

| Kontrola | Stav |
|---|---|
| Non-superuser role vytvořena | `rls-app-role-and-force-2026-04-19.sql` |
| `FORCE RLS` na všech PII tabulkách | `rls-m3-m4-messages-and-core-tables-2026-04-19.sql` |
| App runtime používá `withAuthContext` | Ověřeno `ws2-batch5-swap-readiness.test.ts` |
| Smoke RLS test v DB | `rls-ws2-batch3-swap-readiness-test.sql` |
| Storage tenant-scoped policies | `storage-documents-tenant-policies-2026-04-21.sql` |

**Swap samotný (přepnutí `DATABASE_URL`) je provozní krok** a není součástí launch
checklistu; provede se v kontrolovaném maintenance window po stabilizaci.
