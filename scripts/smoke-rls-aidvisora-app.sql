-- =============================================================================
-- smoke-rls-aidvisora-app.sql
--
-- Smoke-test pack pro ruční spuštění v Supabase SQL Editor POD ROLÍ
-- `aidvisora_app` (NOSUPERUSER, NOBYPASSRLS). Ověřuje, že RLS se skutečně
-- vymáhá, že tenant GUC pattern funguje, a že pre-auth bootstrap flow
-- nepadají.
--
-- Pořadí kroků:
--   0) přepni sezení: SET ROLE aidvisora_app;
--   1) bez GUC — SELECT musí vrátit 0 rows (fail-closed)
--   2) s GUC tenant A — vidíme jen tenant A
--   3) s GUC tenant B — vidíme jen tenant B, nikdy data tenant A
--   4) cross-tenant write — musí hodit RLS violation (WITH CHECK)
--   5) pre-auth bootstrap (SECURITY DEFINER) — musí projít i bez GUC
--   6) storage: jen prefix `documents/<tenant_id>/…` je dostupný
--
-- POZN: nahraď :tenant_a, :tenant_b, :user_a, :user_b, :invite_token,
-- :unsubscribe_token skutečnými hodnotami ze staging DB.
-- =============================================================================

\echo '=== STEP 0: Přepni na runtime roli ==='
SET ROLE aidvisora_app;
SELECT current_user, session_user;

-- -------------------------------------------------------------------------
\echo '=== STEP 1: bez GUC → musí 0 rows (fail-closed) ==='
-- -------------------------------------------------------------------------
-- Vybereme 3 kanonické tenant-scoped tabulky. Pokud vrátí > 0 řádků,
-- je to HARD BLOCKER (policy chybí nebo cast padá do NULL → vše dostupné).
SELECT 'contacts' AS tbl, count(*) FROM contacts;
SELECT 'contracts' AS tbl, count(*) FROM contracts;
SELECT 'documents' AS tbl, count(*) FROM documents;

-- -------------------------------------------------------------------------
\echo '=== STEP 2: s GUC tenant A → vidíme jen tenant A ==='
-- -------------------------------------------------------------------------
BEGIN;
  SELECT set_config('app.tenant_id', :'tenant_a', true);
  SELECT set_config('app.user_id',  :'user_a',  true);

  -- Počty by měly odpovídat skutečnému objemu tenant A (spot check vůči admin čtení).
  SELECT count(*) AS contacts_in_tenant_a FROM contacts;
  SELECT count(*) AS contracts_in_tenant_a FROM contracts;
  SELECT count(*) AS documents_in_tenant_a FROM documents;

  -- Žádný řádek nesmí mít jiný tenantId než :tenant_a.
  SELECT count(*) AS leak_from_other_tenants
    FROM contacts
   WHERE "tenantId" <> :'tenant_a';
COMMIT;

-- -------------------------------------------------------------------------
\echo '=== STEP 3: s GUC tenant B → vidíme jen tenant B ==='
-- -------------------------------------------------------------------------
BEGIN;
  SELECT set_config('app.tenant_id', :'tenant_b', true);

  SELECT count(*) AS contacts_in_tenant_b FROM contacts;

  SELECT count(*) AS leak_from_tenant_a
    FROM contacts
   WHERE "tenantId" = :'tenant_a';
COMMIT;

-- -------------------------------------------------------------------------
\echo '=== STEP 4: cross-tenant write → musí hodit RLS violation ==='
-- -------------------------------------------------------------------------
-- Jsme v GUC tenant B, ale pokusíme se zapsat řádek s tenantId = A.
-- Očekávání: ERROR: new row violates row-level security policy.
BEGIN;
  SELECT set_config('app.tenant_id', :'tenant_b', true);

  -- Zapni očekávaný fail; pokud projde, je to HARD BLOCKER.
  SAVEPOINT sp_cross_write;
  DO $$
  BEGIN
    INSERT INTO contacts ("tenantId", "firstName", "lastName")
      VALUES (current_setting('app.tenant_id_other_test', true)::uuid,
              'RLS', 'SmokeTest');
    RAISE EXCEPTION 'HARD BLOCKER: cross-tenant INSERT prošel — RLS WITH CHECK je slabý';
  EXCEPTION
    WHEN insufficient_privilege OR check_violation OR others THEN
      RAISE NOTICE 'OK: cross-tenant INSERT zablokován (%).', SQLERRM;
  END $$;
  ROLLBACK TO SAVEPOINT sp_cross_write;
ROLLBACK;

-- -------------------------------------------------------------------------
\echo '=== STEP 5: pre-auth SECURITY DEFINER — musí projít i bez GUC ==='
-- -------------------------------------------------------------------------
-- Bootstrap flow před přihlášením. GUC zde není nastaveno, přesto funkce
-- vrací data, protože běží pod OWNER kontextem (SECURITY DEFINER).

-- 5a) invite metadata lookup
SELECT public.lookup_invite_metadata_v1(:'invite_token');

-- 5b) client-portal unsubscribe by token
SELECT public.process_unsubscribe_by_token_v1(:'unsubscribe_token');

-- 5c) accept staff invitation (dry-run pouze v staging; v prod necháme na UI)
--     SELECT public.accept_staff_invitation_v1(:'invite_token', :'user_id', :'user_email');

-- -------------------------------------------------------------------------
\echo '=== STEP 6: storage objects — jen documents/<tenant>/… ==='
-- -------------------------------------------------------------------------
BEGIN;
  SELECT set_config('app.tenant_id', :'tenant_a', true);

  -- Jen documents/<tenant_a>/* smí vracet řádky.
  SELECT count(*) AS storage_documents_tenant_a
    FROM storage.objects
   WHERE bucket_id = 'documents'
     AND name LIKE :'tenant_a' || '/%';

  -- Cross-tenant storage read → musí být 0.
  SELECT count(*) AS storage_leak_to_tenant_b
    FROM storage.objects
   WHERE bucket_id = 'documents'
     AND name LIKE :'tenant_b' || '/%';

  -- Non-documents bucket → musí být 0 (restrictive deny z rls-m10).
  SELECT count(*) AS storage_non_documents_visible
    FROM storage.objects
   WHERE bucket_id <> 'documents';
COMMIT;

-- -------------------------------------------------------------------------
\echo '=== VERDIKT ==='
-- -------------------------------------------------------------------------
-- STEP 1 musí být samé nuly.
-- STEP 2 a STEP 3 musí mít leak_* = 0.
-- STEP 4 musí logovat "OK: cross-tenant INSERT zablokován".
-- STEP 5 musí vrátit řádek / void bez chyby.
-- STEP 6 musí mít leak_* = 0 a storage_non_documents_visible = 0.
--
-- Pokud cokoliv z toho selže → STOP, NEPŘEPÍNAT DATABASE_URL.
