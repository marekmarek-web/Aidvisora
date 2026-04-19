-- WS-2 Batch 2 / Schema fixes — tenant_id coverage + contracts.tenant_id NOT NULL
-- Datum: 2026-04-19
--
-- Rozsah:
--   1) Přidat `tenant_id` na `public.client_requests` a `public.client_request_files`
--      (obě tabulky ho dnes nemají, RLS policies musí joinovat přes prázdnou `public.clients`).
--   2) Backfill tenant_id pomocí dostupných lookupů (advisors/clients nebo memberships).
--      Pokud se nepodaří zaplnit všechny řádky, NOT NULL se záměrně NEaplikuje (ochrana proti
--      tichému vymazání dat). Počet NULL řádků se pak vypíše v RAISE NOTICE.
--   3) Drop starých policies (odkazují na `public.clients` + `current_advisor_id()`) a nahradit
--      je čistě tenant-based přes GUC `app.tenant_id`.
--   4) `contracts.tenant_id` → NOT NULL (snapshot 2026-04-19: 3/3 řádky tenant_id vyplněn).
--
-- Idempotentní. Bezpečné re-run.

BEGIN;

-- =============================================================================
-- 1) client_requests: přidat tenant_id (pokud chybí)
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'client_requests'
  ) THEN
    RAISE NOTICE 'client_requests tabulka neexistuje — přeskakuji.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'client_requests' AND column_name = 'tenant_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.client_requests ADD COLUMN tenant_id uuid';
  END IF;
END $$;

-- =============================================================================
-- 2) client_request_files: přidat tenant_id (pokud chybí)
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'client_request_files'
  ) THEN
    RAISE NOTICE 'client_request_files tabulka neexistuje — přeskakuji.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'client_request_files' AND column_name = 'tenant_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.client_request_files ADD COLUMN tenant_id uuid';
  END IF;
END $$;

-- =============================================================================
-- 3) Backfill client_requests.tenant_id
-- =============================================================================
-- Priorita zdrojů:
--   a) legacy advisors.user_id → memberships.tenant_id (advisor má vlastnictví requestu)
--   b) contacts lookup přes contact_id (pokud client_requests má contact_id)
--   c) fallback: přes legacy clients.advisor_id → advisors.user_id → memberships.tenant_id
--
-- Pokud je `public.clients` a `public.advisors` prázdný (aktuální stav), backfill je no-op
-- a tabulka by měla být taky prázdná. V produkčním stavu 2026-04-19 je `clients` = 0 řádků.

DO $$
DECLARE
  has_contact_id boolean;
  has_client_id boolean;
  total_rows integer;
  remaining integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'client_requests'
  ) THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'client_requests' AND column_name = 'contact_id'
  ) INTO has_contact_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'client_requests' AND column_name = 'client_id'
  ) INTO has_client_id;

  EXECUTE 'SELECT count(*) FROM public.client_requests WHERE tenant_id IS NULL' INTO total_rows;

  IF total_rows = 0 THEN
    RAISE NOTICE 'client_requests: 0 NULL tenant_id rows, backfill skipped.';
    RETURN;
  END IF;

  -- (b) přes contacts (pokud sloupec existuje)
  IF has_contact_id THEN
    EXECUTE $sql$
      UPDATE public.client_requests r
         SET tenant_id = c.tenant_id
        FROM public.contacts c
       WHERE r.tenant_id IS NULL
         AND r.contact_id = c.id
         AND c.tenant_id IS NOT NULL
    $sql$;
  END IF;

  -- (c) přes legacy clients + advisors + memberships
  IF has_client_id
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='clients')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='advisors')
  THEN
    EXECUTE $sql$
      UPDATE public.client_requests r
         SET tenant_id = m.tenant_id
        FROM public.clients cl
        JOIN public.advisors adv ON adv.id = cl.advisor_id
        JOIN public.memberships m ON m.user_id::text = adv.user_id::text
       WHERE r.tenant_id IS NULL
         AND r.client_id = cl.id
         AND m.tenant_id IS NOT NULL
    $sql$;
  END IF;

  EXECUTE 'SELECT count(*) FROM public.client_requests WHERE tenant_id IS NULL' INTO remaining;
  IF remaining > 0 THEN
    RAISE NOTICE 'client_requests: % řádků stále má NULL tenant_id — NOT NULL constraint záměrně neaplikuji, data review manuálně.', remaining;
  ELSE
    RAISE NOTICE 'client_requests: backfill OK, všech % řádků má tenant_id.', total_rows;
  END IF;
END $$;

-- =============================================================================
-- 4) Backfill client_request_files.tenant_id (přes client_requests)
-- =============================================================================
DO $$
DECLARE
  total_rows integer;
  remaining integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'client_request_files'
  ) THEN
    RETURN;
  END IF;

  EXECUTE 'SELECT count(*) FROM public.client_request_files WHERE tenant_id IS NULL' INTO total_rows;
  IF total_rows = 0 THEN
    RAISE NOTICE 'client_request_files: 0 NULL tenant_id rows, backfill skipped.';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='client_request_files' AND column_name='request_id'
  ) THEN
    EXECUTE $sql$
      UPDATE public.client_request_files f
         SET tenant_id = r.tenant_id
        FROM public.client_requests r
       WHERE f.tenant_id IS NULL
         AND f.request_id = r.id
         AND r.tenant_id IS NOT NULL
    $sql$;
  END IF;

  EXECUTE 'SELECT count(*) FROM public.client_request_files WHERE tenant_id IS NULL' INTO remaining;
  IF remaining > 0 THEN
    RAISE NOTICE 'client_request_files: % řádků stále má NULL tenant_id — NOT NULL záměrně neaplikuji.', remaining;
  ELSE
    RAISE NOTICE 'client_request_files: backfill OK, všech % řádků má tenant_id.', total_rows;
  END IF;
END $$;

-- =============================================================================
-- 5) NOT NULL, pokud všechna data mají tenant_id (safe-mode)
-- =============================================================================
DO $$
DECLARE
  null_count integer;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='client_requests') THEN
    EXECUTE 'SELECT count(*) FROM public.client_requests WHERE tenant_id IS NULL' INTO null_count;
    IF null_count = 0 THEN
      BEGIN
        EXECUTE 'ALTER TABLE public.client_requests ALTER COLUMN tenant_id SET NOT NULL';
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'client_requests: SET NOT NULL selhal (%), ponecháno nullable.', SQLERRM;
      END;
    ELSE
      RAISE NOTICE 'client_requests: nullable tenant_id ponechán (% řádků NULL).', null_count;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='client_request_files') THEN
    EXECUTE 'SELECT count(*) FROM public.client_request_files WHERE tenant_id IS NULL' INTO null_count;
    IF null_count = 0 THEN
      BEGIN
        EXECUTE 'ALTER TABLE public.client_request_files ALTER COLUMN tenant_id SET NOT NULL';
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'client_request_files: SET NOT NULL selhal (%), ponecháno nullable.', SQLERRM;
      END;
    ELSE
      RAISE NOTICE 'client_request_files: nullable tenant_id ponechán (% řádků NULL).', null_count;
    END IF;
  END IF;
END $$;

-- =============================================================================
-- 6) Drop legacy policies + CREATE tenant-based policies
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='client_requests') THEN
    -- legacy
    EXECUTE 'DROP POLICY IF EXISTS client_requests_advisor        ON public.client_requests';
    EXECUTE 'DROP POLICY IF EXISTS client_requests_client         ON public.client_requests';
    EXECUTE 'DROP POLICY IF EXISTS client_requests_client_insert  ON public.client_requests';
    EXECUTE 'DROP POLICY IF EXISTS client_requests_select         ON public.client_requests';
    EXECUTE 'DROP POLICY IF EXISTS client_requests_insert         ON public.client_requests';
    EXECUTE 'DROP POLICY IF EXISTS client_requests_update         ON public.client_requests';
    EXECUTE 'DROP POLICY IF EXISTS client_requests_delete         ON public.client_requests';
    -- nové tenant-based
    EXECUTE $p$
      CREATE POLICY client_requests_tenant_select ON public.client_requests
        FOR SELECT TO authenticated, aidvisora_app
        USING (tenant_id IS NOT NULL AND tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid)
    $p$;
    EXECUTE $p$
      CREATE POLICY client_requests_tenant_insert ON public.client_requests
        FOR INSERT TO authenticated, aidvisora_app
        WITH CHECK (tenant_id IS NOT NULL AND tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid)
    $p$;
    EXECUTE $p$
      CREATE POLICY client_requests_tenant_update ON public.client_requests
        FOR UPDATE TO authenticated, aidvisora_app
        USING (tenant_id IS NOT NULL AND tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid)
        WITH CHECK (tenant_id IS NOT NULL AND tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid)
    $p$;
    EXECUTE $p$
      CREATE POLICY client_requests_tenant_delete ON public.client_requests
        FOR DELETE TO authenticated, aidvisora_app
        USING (tenant_id IS NOT NULL AND tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid)
    $p$;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='client_request_files') THEN
    EXECUTE 'DROP POLICY IF EXISTS client_request_files_via_request ON public.client_request_files';
    EXECUTE 'DROP POLICY IF EXISTS client_request_files_select      ON public.client_request_files';
    EXECUTE 'DROP POLICY IF EXISTS client_request_files_insert      ON public.client_request_files';
    EXECUTE 'DROP POLICY IF EXISTS client_request_files_update      ON public.client_request_files';
    EXECUTE 'DROP POLICY IF EXISTS client_request_files_delete      ON public.client_request_files';

    EXECUTE $p$
      CREATE POLICY client_request_files_tenant_select ON public.client_request_files
        FOR SELECT TO authenticated, aidvisora_app
        USING (tenant_id IS NOT NULL AND tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid)
    $p$;
    EXECUTE $p$
      CREATE POLICY client_request_files_tenant_insert ON public.client_request_files
        FOR INSERT TO authenticated, aidvisora_app
        WITH CHECK (tenant_id IS NOT NULL AND tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid)
    $p$;
    EXECUTE $p$
      CREATE POLICY client_request_files_tenant_update ON public.client_request_files
        FOR UPDATE TO authenticated, aidvisora_app
        USING (tenant_id IS NOT NULL AND tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid)
        WITH CHECK (tenant_id IS NOT NULL AND tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid)
    $p$;
    EXECUTE $p$
      CREATE POLICY client_request_files_tenant_delete ON public.client_request_files
        FOR DELETE TO authenticated, aidvisora_app
        USING (tenant_id IS NOT NULL AND tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid)
    $p$;
  END IF;
END $$;

-- =============================================================================
-- 7) contracts.tenant_id → NOT NULL (jen pokud všechny řádky mají tenant_id)
-- =============================================================================
DO $$
DECLARE
  null_count integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='contracts' AND column_name='tenant_id'
  ) THEN
    RAISE EXCEPTION 'contracts.tenant_id sloupec chybí — nelze aplikovat NOT NULL.';
  END IF;

  EXECUTE 'SELECT count(*) FROM public.contracts WHERE tenant_id IS NULL' INTO null_count;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'contracts: % řádků nemá tenant_id — oprav před NOT NULL (WS-2 Batch 2 blocker).', null_count;
  END IF;

  -- Kontrola jestli už NOT NULL existuje (idempotence)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='contracts'
      AND column_name='tenant_id' AND is_nullable = 'YES'
  ) THEN
    EXECUTE 'ALTER TABLE public.contracts ALTER COLUMN tenant_id SET NOT NULL';
    RAISE NOTICE 'contracts.tenant_id: SET NOT NULL aplikován.';
  ELSE
    RAISE NOTICE 'contracts.tenant_id: už je NOT NULL, idempotence OK.';
  END IF;
END $$;

-- =============================================================================
-- 8) Sanity: žádná policy na client_requests / client_request_files nesmí odkazovat
--    na legacy public.clients / current_advisor_id()
-- =============================================================================
DO $$
DECLARE
  leftover integer;
BEGIN
  SELECT count(*)
    INTO leftover
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('client_requests', 'client_request_files')
    AND (
      qual LIKE '%public.clients%' OR qual LIKE '%FROM clients%'
      OR with_check LIKE '%public.clients%' OR with_check LIKE '%FROM clients%'
      OR qual LIKE '%current_advisor_id()%' OR with_check LIKE '%current_advisor_id()%'
      OR qual LIKE '%current_client_id()%'  OR with_check LIKE '%current_client_id()%'
    );
  IF leftover > 0 THEN
    RAISE EXCEPTION 'client_requests/client_request_files: po migraci zbývá % legacy policy — zkontroluj ručně.', leftover;
  END IF;
END $$;

COMMIT;
