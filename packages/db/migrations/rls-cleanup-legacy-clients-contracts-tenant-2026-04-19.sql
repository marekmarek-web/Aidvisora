-- WS-2 Batch 1 / M2 — Cleanup legacy `clients`-based RLS na `public.contracts`
-- Datum: 2026-04-19
-- Rozsah:
--   1) Drop starých contracts_* policies, které odkazují na prázdnou legacy tabulku
--      `public.clients` a na `current_advisor_id()` (čte z prázdné `public.advisors`).
--   2) Create nové contracts_* policies, které vymáhají tenant izolaci přímo přes
--      `contracts.tenant_id` + GUC `app.tenant_id`.
--
-- Co NENÍ v této migraci (úmyslně, viz snapshot 2026-04-19):
--   - `client_requests` a `client_request_files` stále odkazují na legacy `public.clients`.
--     Tyto tabulky nemají sloupec `tenant_id`, takže tenant-based náhrada by vyžadovala
--     schema change (add column + backfill) → patří do pozdějšího batche.
--   - Legacy helper funkce `current_advisor_id()` a `current_client_id()` se nenechávají
--     drop — mohou je používat další policies (storage, atd.). Rušení patří do pozdějšího batche.
--   - Legacy tabulky `public.clients` a `public.advisors` se neodstraňují (scope).
--
-- Bezpečnostní poznámka:
--   Runtime Drizzle user je Supabase `postgres` superuser (BYPASSRLS), takže efekt této
--   migrace je zatím hlavně na úrovni PostgREST (`authenticated`/`anon`). Aby se policies
--   začaly reálně vymáhat i pro server-side, musí další batch buď:
--     a) přepnout runtime na non-superuser roli s GUC-writerem (viz
--        `apps/web/src/lib/db/with-tenant-context.ts`), nebo
--     b) nasadit `ALTER TABLE public.contracts FORCE ROW LEVEL SECURITY`.
--
-- Idempotentní. Bezpečné re-run. Nezasahuje do dat v `contracts`.

BEGIN;

-- 0) Pojistka — contracts musí mít sloupec tenant_id (snapshot říká ano, nullable).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contracts' AND column_name = 'tenant_id'
  ) THEN
    RAISE EXCEPTION 'M2 abort: public.contracts nemá sloupec tenant_id — M2 nelze aplikovat.';
  END IF;
END $$;

-- 1) Drop starých contracts_* policies (name-match včetně starších variant).
DROP POLICY IF EXISTS contracts_select         ON public.contracts;
DROP POLICY IF EXISTS contracts_insert         ON public.contracts;
DROP POLICY IF EXISTS contracts_update         ON public.contracts;
DROP POLICY IF EXISTS contracts_delete         ON public.contracts;
DROP POLICY IF EXISTS contracts_advisor_all    ON public.contracts;
DROP POLICY IF EXISTS contracts_client_select  ON public.contracts;

-- 2) Nové tenant-based policies. Role = `authenticated`, tenant = GUC app.tenant_id.
--    `USING` i `WITH CHECK` shodné, aby nešlo zapsat řádek do cizího tenanta.
CREATE POLICY contracts_tenant_select ON public.contracts
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid);

CREATE POLICY contracts_tenant_insert ON public.contracts
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid);

CREATE POLICY contracts_tenant_update ON public.contracts
  FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid)
  WITH CHECK (tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid);

CREATE POLICY contracts_tenant_delete ON public.contracts
  FOR DELETE TO authenticated
  USING (tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid);

-- 3) Sanity check: žádná policy na contracts už nesmí odkazovat `public.clients`
--    ani `current_advisor_id()` / `current_client_id()`.
DO $$
DECLARE
  leftover integer;
BEGIN
  SELECT count(*)
    INTO leftover
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'contracts'
    AND (
      qual LIKE '%public.clients%' OR qual LIKE '%FROM clients%'
      OR with_check LIKE '%public.clients%' OR with_check LIKE '%FROM clients%'
      OR qual LIKE '%current_advisor_id()%' OR with_check LIKE '%current_advisor_id()%'
      OR qual LIKE '%current_client_id()%'  OR with_check LIKE '%current_client_id()%'
    );
  IF leftover > 0 THEN
    RAISE EXCEPTION 'M2: contracts má po migraci % policies odkazujících na legacy clients/current_advisor_id — zkontroluj ručně.', leftover;
  END IF;
END $$;

COMMIT;
