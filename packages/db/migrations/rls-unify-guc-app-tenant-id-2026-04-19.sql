-- WS-2 Batch 1 / M1 — Unifikace GUC na `app.tenant_id`
-- Datum: 2026-04-19
-- Rozsah: drop + recreate policies, které používaly `app.current_tenant_id`, aby
-- používaly kanonickou GUC `app.tenant_id`. Policies na `assistant_conversations`
-- a `assistant_messages` už `app.tenant_id` používají → beze změn.
--
-- Idempotentní (DROP POLICY IF EXISTS). Neaktivuje ani nedeaktivuje RLS na tabulkách.
-- Neupravuje runtime DB role — viz `docs/security/rls-production-snapshot-2026-04-19.md`,
-- runtime přes Drizzle (`postgres` superuser) má BYPASSRLS, takže policies zde jsou
-- aktuálně vymáhány jen pro `authenticated` / PostgREST klienty.

BEGIN;

-- fa_plan_items: přepnout z app.current_tenant_id → app.tenant_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'fa_plan_items'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS fa_plan_items_tenant_isolation ON public.fa_plan_items';
    EXECUTE $p$
      CREATE POLICY fa_plan_items_tenant_isolation ON public.fa_plan_items
        FOR ALL
        USING (tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid)
        WITH CHECK (tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid)
    $p$;
  END IF;
END $$;

-- fa_sync_log: přepnout z app.current_tenant_id → app.tenant_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'fa_sync_log'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS fa_sync_log_tenant_isolation ON public.fa_sync_log';
    EXECUTE $p$
      CREATE POLICY fa_sync_log_tenant_isolation ON public.fa_sync_log
        FOR ALL
        USING (tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid)
        WITH CHECK (tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid)
    $p$;
  END IF;
END $$;

-- Sanity check: žádná policy v public už nesmí referencovat `app.current_tenant_id`.
DO $$
DECLARE
  leftover integer;
BEGIN
  SELECT count(*)
    INTO leftover
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (
      qual LIKE '%app.current_tenant_id%'
      OR with_check LIKE '%app.current_tenant_id%'
    );
  IF leftover > 0 THEN
    RAISE EXCEPTION 'M1: po migraci zbývá % policy s GUC app.current_tenant_id — zkontroluj ručně.', leftover;
  END IF;
END $$;

COMMIT;
