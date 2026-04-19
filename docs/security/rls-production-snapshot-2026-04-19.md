# RLS production snapshot — 2026-04-19 (WS-2, Phase 0)

> Read-only Phase 0 inventory před spuštěním WS-2 Batch 1.
> Zdroj pravdy: Supabase project `paoayamrcanxhsvkmdni` (Aidvisora, region `eu-west-1`, Postgres 17.6.1.063).
> Výstup byl získán přes Supabase MCP `execute_sql` (role `postgres`, `is_superuser = off` u MCP konektoru; viz poznámka o runtime DB userovi níže).
>
> **Tento dokument je interní snapshot stavu RLS/šifrování/storage pro poradce-SaaS nástroj Aidvisora. Není to rada klientovi.**

---

## 1. Shrnutí (TL;DR)

- **`clients` je legacy a prázdná** (0 řádků). Drizzle ji nemá ve schématu, ale tabulka fyzicky existuje s `RLS ON`. FK z `contracts.client_id` byla 2026-04-16 přesměrována na `contacts(id)`. **Drift potvrzen.**
- **Všechny aktivní RLS policy na `contracts`, `client_requests`, `client_request_files` se stále odkazují na `public.clients`** a na funkce `current_advisor_id()` / `current_client_id()`, které čtou z prázdných tabulek `advisors` / `clients`. Policies tedy pod rolí `authenticated` de facto vrací prázdno.
- **Aplikace přesto funguje** → runtime běží přes Drizzle s `DATABASE_URL` mířící na `postgres.<ref>` přes pooler, což je Supabase `postgres` superuser → `BYPASSRLS`. **RLS tedy v praxi není vymáhána na backendu**; je vymáhána jen přes PostgREST pro `anon`/`authenticated` (kde je nastaveno, že app ji nepoužívá pro čtení dat poradce).
- **GUC drift potvrzen**: část tabulek používá `app.current_tenant_id`, jiné `app.tenant_id`. Žádný middleware v kódu zatím žádnou z těchto GUC nenastavuje → všechny tenant-GUC policies by při vynucení RLS vracely `NULL = NULL` (= deny).
- **Supabase Vault** je dostupný (extension `supabase_vault` 0.3.1). **pgsodium** je v katalogu `pg_available_extensions` k dispozici, ale **není** nainstalován. Transparent Column Encryption (TCE) přes pgsodium je Supabase **deprecated** pro nové i existující projekty — pro šifrování PII sloupců je třeba jít cestou **aplikačního AES-GCM** s klíčem drženým mimo DB (env / KMS), ne Vault TCE.
- **Storage buckety**: 6 bucketů, všechny `public = false`. Několik `INSERT`-policy pod rolí `anon` (`attachments_anon_insert`, `reports_anon_insert`, `uploads_anon_insert`) — budou potřebovat review v pozdějších batchích (mimo Batch 1).
- **3 tabulky v `public` mají `RLS = OFF`**: `contact_coverage`, `message_attachments`, `messages`. **Cca 77 tabulek má `RLS = ON` ale 0 policies** → pod `authenticated` = deny-all; provoz drží výhradně `postgres` superuser přes Drizzle.

---

## 2. Metadata DB

| Položka | Hodnota |
| --- | --- |
| Supabase project ref | `paoayamrcanxhsvkmdni` |
| DB host (přímý) | `db.paoayamrcanxhsvkmdni.supabase.co` |
| Postgres | 17.6.1.063 |
| Runtime connection string | `postgresql://postgres.paoayamrcanxhsvkmdni:***@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true` |
| Runtime DB user (Drizzle) | **`postgres`** (přes pooler s login rolí `postgres.<ref>`) → efektivně **BYPASSRLS** |
| MCP DB user (tento snapshot) | `postgres`, `is_superuser = off` |
| pgbouncer mód | transaction pooling (`port 6543`, `prepare: false`) |

> Důsledek: cokoliv jde přes `apps/web/src/lib/db-client.ts` ignoruje RLS. To je reálný bezpečnostní strop: bug v kódu nad Drizzle = únik tenantem napříč. RLS v DB aktuálně slouží jen jako pojistka pro PostgREST klienty (browser přes `@supabase/supabase-js`).

---

## 3. Row Level Security — stav per tabulka

### 3.1 Tabulky s `RLS = OFF` (public schema)

| Tabulka | Poznámka |
| --- | --- |
| `contact_coverage` | chybí RLS |
| `message_attachments` | chybí RLS |
| `messages` | chybí RLS |

> Všechny tři by měly v pozdějším batchi dostat RLS ON + tenant policy. **Mimo rozsah Batch 1** (viz rozsah „neřešit M3+“).

### 3.2 Tabulky s `RLS = ON` a `policy_count = 0`

77 tabulek v `public` schématu má RLS zapnuté, ale žádnou policy. Pod `authenticated`/`anon` = deny-all. Pod `postgres` (Drizzle runtime) = BYPASSRLS, proto aplikace funguje. Seznam (zkráceně): `activity_log, advisor_business_plan_targets, advisor_business_plans, advisor_notifications, advisor_preferences, advisor_vision_goals, ai_feedback, ai_generations, aml_checklists, analysis_import_jobs, analysis_versions, audit_log, board_items, board_views, client_contacts, client_invitations, client_payment_setups, communication_drafts, companies, company_person_links, consents, contacts, contract_review_corrections, contract_upload_reviews, dead_letter_items, document_extraction_fields, document_extractions, document_processing_jobs, document_versions, documents, events, execution_actions, export_artifacts, exports, financial_analyses, financial_shared_facts, fund_add_requests, household_members, households, incident_logs, insurer_termination_registry, invoices, meeting_notes, memberships, mindmap_edges, mindmap_maps, mindmap_nodes, note_templates, notification_log, opportunity_stages, organizations, partners, payment_accounts, portal_feedback, portal_notifications, processing_purposes, products, profiles, relationships, reminders, roles, staff_invitations, stripe_webhook_events, subscription_usage_monthly, subscriptions, tasks, team_events, team_goals, team_tasks, tenant_settings, tenants, termination_dispatch_log, termination_generated_documents, termination_reason_catalog, termination_request_events, termination_requests, termination_required_attachments, timeline_items, unsubscribe_tokens, user_profiles`.

### 3.3 Tabulky s existujícími `public.*` policy

Zjištěné policy (`pg_policies`) — zaměřeno na tabulky v rozsahu Batch 1:

| Tabulka | Policy | Role | Příkaz | Odkazuje na `clients`? | GUC |
| --- | --- | --- | --- | --- | --- |
| `clients` | `clients_select` / `_insert` / `_update` / `_delete` | authenticated | SELECT/INSERT/UPDATE/DELETE | n/a (self) | — |
| `contracts` | `contracts_select` | authenticated | SELECT | **ANO** (`SELECT advisor_id FROM clients WHERE id = contracts.client_id`) | — |
| `contracts` | `contracts_insert` | authenticated | INSERT | ne (advisor_id scope) | — |
| `contracts` | `contracts_update` | authenticated | UPDATE | **ANO** | — |
| `contracts` | `contracts_delete` | authenticated | DELETE | **ANO** | — |
| `client_requests` | `client_requests_select/insert/update/delete` | authenticated | CRUD | **ANO** (lookup přes `clients cl`) | — |
| `client_request_files` | `client_request_files_via_request` | authenticated | ALL | **ANO** | — |
| `assistant_conversations` | `assistant_conversations_tenant_isolation` | public | ALL | ne | **`app.tenant_id`** |
| `assistant_messages` | `assistant_messages_tenant_isolation` | public | ALL | ne | **`app.tenant_id`** |
| `fa_plan_items` | `fa_plan_items_tenant_isolation` | public | ALL | ne | **`app.current_tenant_id`** |
| `fa_sync_log` | `fa_sync_log_tenant_isolation` | public | ALL | ne | **`app.current_tenant_id`** |

> Pozorování: `contracts` policies odkazují na `public.clients.advisor_id`, ale `contracts.client_id` od 2026-04-16 (`contracts_drop_legacy_advisor_fk_2026-04-16.sql`) FK-uje na `contacts(id)`, ne na `clients(id)`. `JOIN clients ON clients.id = contracts.client_id` tedy nikdy nic nevrací — **tyto policies jsou pod `authenticated` efektivně deny-all**.

### 3.4 GUC drift — přehled

| GUC | Používá | Počet policies |
| --- | --- | --- |
| `app.tenant_id` | `assistant_conversations`, `assistant_messages` | 2 |
| `app.current_tenant_id` | `fa_plan_items`, `fa_sync_log` | 2 |

> **Kanonické:** Batch 1 / M1 sjednocuje na **`app.tenant_id`** (kratší, v souladu s novější migrací). `app.current_tenant_id` z policies zmizí.
>
> **Kód**: grep `apps/web/src` pro `set_config\\(|SET LOCAL app\\.|app\\.tenant_id|app\\.current_tenant_id` → **0 výskytů**. Runtime žádnou GUC nenastavuje, protože přes `postgres` to není potřeba (BYPASSRLS).

---

## 4. Tenant / tenant_id pokrytí

| Tabulka | Má sloupec `tenant_id`? | NOT NULL? | Poznámka |
| --- | --- | --- | --- |
| `contacts` | ano | **ANO** | čisté |
| `contracts` | ano | NE (nullable) | 3/3 existujících řádků má `tenant_id` vyplněn, ale constraint chybí |
| `clients` | — | — | legacy, nepoužívat |
| `client_requests` | **NE** | — | tenant kontext jen přes `clients`/`contacts` lookup |
| `client_request_files` | **NE** | — | tenant kontext jen přes `client_requests` → ... |

> Důsledek pro M2: `contracts` dostane tenant_id-based policy přímo; `client_requests`/`client_request_files` nejsou v Batch 1 (chybí sloupec `tenant_id`, potřebují best-practice přístup v pozdějším batchi — buď přidat `tenant_id` a backfill, nebo joinovat přes `contacts`).

---

## 5. Legacy helper SQL funkce

| Funkce | Tělo | Funkční? |
| --- | --- | --- |
| `current_advisor_id()` | `SELECT id FROM public.advisors WHERE user_id = auth.uid() LIMIT 1` | **NE** — `advisors` má 0 řádků |
| `current_client_id()` | `SELECT id FROM public.clients WHERE client_user_id = auth.uid() LIMIT 1` | **NE** — `clients` má 0 řádků |
| `current_tenant_id()` | neexistuje | — |

> M1/M2 tyto helpery **nerušíme** (scope), jen je obejdeme. Cleanup přes `DROP FUNCTION` patří do pozdějšího batche.

---

## 6. Storage

### 6.1 Buckets

| Bucket | Public |
| --- | --- |
| `attachments` | false |
| `contracts` | false |
| `documents` | false |
| `reports` | false |
| `request_files` | false |
| `uploads` | false |

### 6.2 Storage policies (`storage.objects`)

| Policy | Role | Cmd |
| --- | --- | --- |
| `attachments_anon_insert` | anon | INSERT |
| `contracts_authenticated_insert` | authenticated | INSERT |
| `contracts_authenticated_select` | authenticated | SELECT |
| `reports_anon_insert` | anon | INSERT |
| `request_files_authenticated_insert` | authenticated | INSERT |
| `request_files_authenticated_select` | authenticated | SELECT |
| `uploads_anon_insert` | anon | INSERT |

> Pozorování k pozdějším batchům (ne Batch 1): anon `INSERT` na `attachments` / `uploads` / `reports` vyžaduje review, zda je to záměrné (nejspíš napojené na veřejné rezervace/uploady). **Signed URL hardening je mimo Batch 1.**

---

## 7. Šifrování — dostupnost

| Prvek | Stav | Poznámka |
| --- | --- | --- |
| `supabase_vault` (`vault` schema) | **nainstalováno 0.3.1** | použitelné pro secret storage (API klíče, ne sloupcové šifrování) |
| `pgsodium` | dostupné v katalogu, **NEinstalované** | Supabase deprecated pro TCE; aktivace se nedoporučuje |
| Transparent Column Encryption (TCE) | **NEDOSTUPNÉ** | pgsodium TCE je označeno za deprecated, Vault pro sloupcovou šifru nenabízí rovnocennou náhradu |
| `pgcrypto` | **nainstalováno 1.3** (schema `extensions`) | lze použít pro PGP/`crypt()` — ale klíč by musel být v session, což nechceme mít v DB |

**Závěr**: pro šifrování PII sloupců **jdeme aplikační cestou** (Node `crypto` AES-256-GCM, klíč v env / KMS). `Supabase Vault` lze použít pro uložení klíče/DEK, ale dešifrování zůstane v aplikaci. Skeleton `apps/web/src/lib/pii/encrypt.ts` je připraven v Batch 1, **sloupcový backfill je mimo Batch 1**.

---

## 8. Co z toho plyne pro Batch 1

1. **M1 (GUC unification)** — přepnout `fa_plan_items` a `fa_sync_log` z `app.current_tenant_id` na `app.tenant_id`. Ostatní tenant policies už `app.tenant_id` používají.
2. **M2 (cleanup legacy `clients` reference na contracts)** — drop `contracts_select/update/delete` policies a nahradit je čistě tenant-based přes `app.tenant_id`. `contracts_insert` taky přepsat (aby neležel na neexistujícím `current_advisor_id()`). `client_requests` / `client_request_files` zatím **ponechat** jak jsou (chybí sloupec `tenant_id` — nutno řešit v Batch 2, jinak by hrozila data loss pro portál).
3. **W2 runtime vrstva** — `with-tenant-context.ts` připraví `SET LOCAL app.tenant_id` přes `set_config(..., true)` uvnitř transakce, aby až se později přepne runtime DB user na non-superuser (nebo se zapne `FORCE ROW LEVEL SECURITY`), policies začaly fungovat.
4. **PII skeleton** — `encrypt.ts` + `redact.ts` bez DB migrace; jen aplikační util. Žádný backfill sloupců.

---

## 9. Otevřené body mimo Batch 1 (nezpracováváme teď)

- M3/M4/M5/M6/M7 (audit coverage, signed URL hardening, test suite, atd.).
- Tenant isolation test suite.
- RLS policy pro 77 tabulek bez policy.
- RLS pro `contact_coverage`, `message_attachments`, `messages`.
- Přidání `tenant_id` sloupce na `client_requests` / `client_request_files` + backfill + policy přes tenant_id.
- DROP funkcí `current_advisor_id()` / `current_client_id()` (zůstává kvůli zpětné kompatibilitě do doby, než budou všechny policies přeepsány).
- Přepnutí Drizzle runtime na non-superuser role s aplikovanou RLS (jinak GUC middleware nemá praktický efekt kromě `FORCE ROW LEVEL SECURITY`).
- Audit `storage.objects` anon INSERT policies.

---

## 10. Reprodukce

SQL použitý pro tento snapshot:

```sql
-- Runtime user
SELECT current_user, current_database(), current_setting('server_version'), current_setting('is_superuser');

-- RLS stav
SELECT schemaname, tablename, rowsecurity
FROM pg_tables WHERE schemaname = 'public' ORDER BY rowsecurity DESC, tablename;

-- Tabulky s RLS ON a 0 policy
SELECT c.relname, (
  SELECT count(*) FROM pg_policies p
  WHERE p.schemaname = 'public' AND p.tablename = c.relname
) AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = true
ORDER BY c.relname;

-- Policies pro klíčové tabulky
SELECT tablename, policyname, roles::text, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('clients','contacts','contracts','client_requests',
                    'client_request_files','assistant_conversations',
                    'assistant_messages','fa_plan_items','fa_sync_log')
ORDER BY tablename, policyname;

-- Storage
SELECT id, name, public FROM storage.buckets ORDER BY name;
SELECT policyname, cmd, roles::text FROM pg_policies WHERE schemaname = 'storage';

-- Extensions
SELECT extname, extnamespace::regnamespace::text FROM pg_extension
WHERE extname IN ('pgsodium','vault','supabase_vault','pgcrypto');
SELECT name, installed_version FROM pg_available_extensions
WHERE name IN ('pgsodium','supabase_vault','pgcrypto');

-- Row counts legacy vs nové
SELECT
  (SELECT count(*) FROM public.clients)  AS clients_rows,
  (SELECT count(*) FROM public.contacts) AS contacts_rows,
  (SELECT count(*) FROM public.contracts) AS contracts_rows,
  (SELECT count(*) FROM public.advisors)  AS advisors_rows;
```
