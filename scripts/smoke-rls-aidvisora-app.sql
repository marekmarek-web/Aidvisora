-- =============================================================================
-- smoke-rls-aidvisora-app.sql
--
-- Smoke-test pack pro ruční spuštění v **Supabase SQL Editor** POD ROLÍ
-- `aidvisora_app` (NOSUPERUSER, NOBYPASSRLS). Ověřuje, že RLS se skutečně
-- vymáhá, že tenant GUC pattern funguje, a že pre-auth bootstrap flow
-- nepadají.
--
-- DŮLEŽITÉ: Supabase SQL Editor není psql — NEPODPORUJE `\echo`, `\i`, `:'var'`.
-- Tento skript je pure SQL a používá `RAISE NOTICE` pro status output.
-- Placeholdery níže MUSÍŠ před spuštěním přepsat konkrétními UUID hodnotami
-- ze staging/prod DB.
--
-- KROKY (postupuj shora dolů, blok po bloku):
--   0) přepni sezení na `aidvisora_app`
--   1) bez GUC — tenant-scoped SELECT musí vrátit 0 rows (fail-closed)
--   2) s GUC tenant A — vidíme jen tenant A
--   3) s GUC tenant B — vidíme jen tenant B, žádný leak z A
--   4) cross-tenant write — musí hodit RLS violation (WITH CHECK)
--   5) pre-auth SECURITY DEFINER — musí projít i bez GUC
--   6) storage: jen prefix `documents/<tenant_id>/…` je dostupný
-- =============================================================================

-- =============================================================================
-- 🚨 NASTAVENÍ PROMĚNNÝCH — přepiš 4 hodnoty níže před spuštěním
-- =============================================================================
-- Najdi reálné UUID v Supabase Dashboard → Table Editor:
--   - tenant_a / tenant_b: SELECT id FROM public.tenants LIMIT 2;
--   - user_a:              SELECT "userId" FROM public.memberships
--                          WHERE "tenantId" = '<tenant_a>' LIMIT 1;

-- -----------------------------------------------------------------------------
-- STEP 0: přepni na runtime roli aidvisora_app
-- -----------------------------------------------------------------------------

SET ROLE aidvisora_app;

SELECT current_user AS active_role,
       (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypassrls;
-- ✅ active_role = 'aidvisora_app', bypassrls = false

-- -----------------------------------------------------------------------------
-- STEP 1: bez GUC → tenant-scoped tabulky musí vrátit 0 rows (fail-closed)
-- -----------------------------------------------------------------------------

SELECT 'contacts'  AS tbl, count(*) AS visible FROM public.contacts
UNION ALL
SELECT 'contracts'     , count(*)              FROM public.contracts
UNION ALL
SELECT 'documents'     , count(*)              FROM public.documents;
-- ✅ visible = 0 pro všechny řádky (fail-closed bez GUC)
-- ❌ cokoliv > 0 → HARD BLOCKER (policy chybí nebo cast padá na NULL)

-- -----------------------------------------------------------------------------
-- STEP 2: s GUC tenant A → vidíme jen tenant A, žádný leak
-- -----------------------------------------------------------------------------

BEGIN;
  -- ⚠️ PŘEPSAT: UUID tenantu A a jeho usera
  SELECT set_config('app.tenant_id', '00000000-0000-0000-0000-00000000AAAA', true);
  SELECT set_config('app.user_id',   '00000000-0000-0000-0000-0000000000A1', true);

  SELECT count(*) AS contacts_in_tenant_a  FROM public.contacts;
  SELECT count(*) AS contracts_in_tenant_a FROM public.contracts;
  SELECT count(*) AS documents_in_tenant_a FROM public.documents;

  -- Klíčový leak check: žádný řádek nesmí mít jiný tenantId
  SELECT count(*) AS leak_from_other_tenants
    FROM public.contacts
   WHERE "tenantId" <> '00000000-0000-0000-0000-00000000AAAA'::uuid;
  -- ✅ leak_from_other_tenants = 0
COMMIT;

-- -----------------------------------------------------------------------------
-- STEP 3: s GUC tenant B → žádný leak z tenant A
-- -----------------------------------------------------------------------------

BEGIN;
  -- ⚠️ PŘEPSAT: UUID tenantu B
  SELECT set_config('app.tenant_id', '00000000-0000-0000-0000-00000000BBBB', true);

  SELECT count(*) AS contacts_in_tenant_b FROM public.contacts;

  SELECT count(*) AS leak_from_tenant_a
    FROM public.contacts
   WHERE "tenantId" = '00000000-0000-0000-0000-00000000AAAA'::uuid;
  -- ✅ leak_from_tenant_a = 0
COMMIT;

-- -----------------------------------------------------------------------------
-- STEP 4: cross-tenant INSERT → musí hodit RLS violation (WITH CHECK)
-- -----------------------------------------------------------------------------
-- Jsme v GUC tenantu B, pokusíme se INSERT s tenantId = tenant A.
-- Očekávání: "new row violates row-level security policy".

DO $$
DECLARE
  v_tenant_b uuid := '00000000-0000-0000-0000-00000000BBBB'; -- ⚠️ PŘEPSAT
  v_tenant_a uuid := '00000000-0000-0000-0000-00000000AAAA'; -- ⚠️ PŘEPSAT
  v_err_text text;
BEGIN
  PERFORM set_config('app.tenant_id', v_tenant_b::text, true);

  BEGIN
    INSERT INTO public.contacts ("tenantId", "firstName", "lastName")
      VALUES (v_tenant_a, 'RLS', 'SmokeTest');
    RAISE EXCEPTION 'HARD BLOCKER: cross-tenant INSERT PROŠEL — RLS WITH CHECK je slabý';
  EXCEPTION
    WHEN insufficient_privilege OR check_violation THEN
      RAISE NOTICE '✅ OK: cross-tenant INSERT zablokován (%).', SQLERRM;
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err_text = MESSAGE_TEXT;
      IF v_err_text ILIKE '%row-level security%' THEN
        RAISE NOTICE '✅ OK: cross-tenant INSERT zablokován RLS (%).', v_err_text;
      ELSE
        RAISE EXCEPTION 'NEŽÁDOUCÍ chyba při cross-tenant INSERT: %', v_err_text;
      END IF;
  END;
END $$;

-- -----------------------------------------------------------------------------
-- STEP 5: pre-auth SECURITY DEFINER — musí projít i bez GUC
-- -----------------------------------------------------------------------------
-- Bootstrap flow před přihlášením. GUC není nastaveno, funkce běží pod OWNER
-- kontextem (SECURITY DEFINER) a musí vracet data bez chyby.

-- 5a) invite metadata lookup (neznámý token → vrátí NULL, ne error)
SELECT public.lookup_invite_metadata_v1(
  '00000000-0000-0000-0000-000000000000'::text  -- ⚠️ PŘEPSAT skutečným tokenem nebo nech default
);

-- 5b) client-portal unsubscribe by token (neznámý token → vrátí NULL/void)
--     Pozor: reálný token by znamenal skutečný opt-out. V staging nech default.
SELECT public.process_unsubscribe_by_token_v1(
  '00000000-0000-0000-0000-000000000000'::text
);

-- 5c) accept_staff_invitation_v1 NESPOUŠTĚJ bez reálného test tokenu —
--     skutečně by někoho přiřadila. Pokud test provádíš, odkomentuj a přepiš.
-- SELECT public.accept_staff_invitation_v1(
--   '<invite_token>'::text,
--   '<user_id>'::uuid,
--   '<user_email>'::text
-- );

-- -----------------------------------------------------------------------------
-- STEP 6: storage.objects — jen documents/<tenant>/… + non-documents = 0
-- -----------------------------------------------------------------------------

BEGIN;
  -- ⚠️ PŘEPSAT: UUID tenantu A a B
  SELECT set_config('app.tenant_id', '00000000-0000-0000-0000-00000000AAAA', true);

  -- Jen documents/<tenant_a>/* smí vracet řádky
  SELECT count(*) AS storage_documents_tenant_a
    FROM storage.objects
   WHERE bucket_id = 'documents'
     AND name LIKE '00000000-0000-0000-0000-00000000AAAA/%';

  -- Cross-tenant storage read → musí být 0
  SELECT count(*) AS storage_leak_to_tenant_b
    FROM storage.objects
   WHERE bucket_id = 'documents'
     AND name LIKE '00000000-0000-0000-0000-00000000BBBB/%';

  -- Non-documents bucket → musí být 0 (restrictive deny z rls-m10)
  SELECT count(*) AS storage_non_documents_visible
    FROM storage.objects
   WHERE bucket_id <> 'documents';
COMMIT;

-- -----------------------------------------------------------------------------
-- RESET session role
-- -----------------------------------------------------------------------------

RESET ROLE;

-- =============================================================================
-- ✅ VERDIKT
-- =============================================================================
-- STEP 0: active_role = 'aidvisora_app', bypassrls = false.
-- STEP 1: všechny counts = 0.
-- STEP 2: leak_from_other_tenants = 0.
-- STEP 3: leak_from_tenant_a = 0.
-- STEP 4: RAISE NOTICE '✅ OK: cross-tenant INSERT zablokován …'.
-- STEP 5: oba SELECTy proběhnou bez chyby (NULL result je OK).
-- STEP 6: storage_leak_to_tenant_b = 0 a storage_non_documents_visible = 0.
--
-- Pokud cokoliv selže → STOP, NEPŘEPÍNAT DATABASE_URL v Vercelu.
