-- WS-2 Batch 2 / M3 + M4 — RLS na messages / message_attachments / contact_coverage
--                          + tenant-scoped policies pro hlavní PII / contract / document scope
-- Datum: 2026-04-19
--
-- Rozsah (dle plánu Batch 2):
--   A) Zapnout RLS (RLS OFF → ON) na tabulkách `messages`, `message_attachments`,
--      `contact_coverage` — tyto měly v Phase 0 snapshotu RLS OFF.
--   B) Přidat tenant-scoped policies pro tyto tři tabulky + pro hlavní PII/contract/document
--      scope tabulky, které měly RLS ON ale 0 policies (= deny-all pro authenticated, BYPASS
--      pro `postgres` runtime). Po swapu runtime na `aidvisora_app` se začnou vymáhat.
--   C) U `messages` jdeme nad rámec tenant scope: přidáme i participant scope (client user smí
--      číst jen zprávy svého kontaktu přes `contacts.auth_user_id`, pokud taková vazba existuje).
--
-- Co NENÍ v této migraci:
--   - Celých 77 RLS-ON-bez-policy tabulek — scope jen PII / contracts / documents core.
--   - Signed URL hardening storage.objects (mimo rozsah Batch 2).
--
-- Idempotentní. Bezpečné re-run.

BEGIN;

-- =============================================================================
-- A) RLS ENABLE + FORCE na dříve-OFF tabulkách
-- =============================================================================
DO $$
DECLARE
  tbl text;
  off_tables text[] := ARRAY['messages', 'message_attachments', 'contact_coverage'];
BEGIN
  FOREACH tbl IN ARRAY off_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
      EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', tbl);
    END IF;
  END LOOP;
END $$;

-- =============================================================================
-- B) Tenant-scoped policies pro hlavní scope
-- =============================================================================
-- Helper macro — vytvoří 4 policies (select/insert/update/delete) nad přímým tenant_id sloupcem.
-- Implementováno jako DO blok s dynamickým SQL (PL/pgSQL nemá user-defined macros).

DO $$
DECLARE
  tbl text;
  tenant_tables text[] := ARRAY[
    'contacts',
    'households', 'household_members',
    'documents', 'document_extractions', 'document_extraction_fields',
    'contract_upload_reviews', 'contract_review_corrections',
    'contact_coverage',
    'tasks', 'opportunities',
    'financial_analyses', 'financial_shared_facts',
    'consents', 'processing_purposes', 'aml_checklists',
    'exports',
    'audit_log', 'activity_log',
    'communication_drafts',
    'reminders', 'meeting_notes',
    'portal_notifications', 'advisor_notifications',
    'tenant_settings'
  ];
BEGIN
  FOREACH tbl IN ARRAY tenant_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'tenant_id'
    ) THEN
      RAISE NOTICE 'Skipping %: no tenant_id column.', tbl;
      CONTINUE;
    END IF;

    -- Drop starých tenant_isolation policies (pro idempotenci)
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_tenant_select', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_tenant_insert', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_tenant_update', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_tenant_delete', tbl);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated, aidvisora_app ' ||
      'USING (tenant_id = (SELECT current_setting(''app.tenant_id'', true))::uuid)',
      tbl || '_tenant_select', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated, aidvisora_app ' ||
      'WITH CHECK (tenant_id = (SELECT current_setting(''app.tenant_id'', true))::uuid)',
      tbl || '_tenant_insert', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated, aidvisora_app ' ||
      'USING (tenant_id = (SELECT current_setting(''app.tenant_id'', true))::uuid) ' ||
      'WITH CHECK (tenant_id = (SELECT current_setting(''app.tenant_id'', true))::uuid)',
      tbl || '_tenant_update', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated, aidvisora_app ' ||
      'USING (tenant_id = (SELECT current_setting(''app.tenant_id'', true))::uuid)',
      tbl || '_tenant_delete', tbl);

    -- RLS musí být enabled; FORCE mají nastavené dřívější migrace.
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', tbl);
  END LOOP;
END $$;

-- =============================================================================
-- C) messages — tenant scope + participant scope
-- =============================================================================
-- messages má: tenant_id + contact_id + sender_type ('advisor' | 'client') + sender_id
-- Pravidla:
--   - Poradce (authenticated / aidvisora_app s app.tenant_id) vidí zprávy svého tenantu.
--   - Klient (authenticated přes portal) vidí jen zprávy, kde contact_id patří jeho kontaktu.
--     (Klient nemá `app.tenant_id` GUC, ale má auth.uid() a kontakt má `auth_user_id` sloupec,
--     pokud v DB existuje — viz contacts schema; pokud ne, tato větev se vypne.)

DO $$
DECLARE
  has_contact_auth_user_id boolean;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'messages'
  ) THEN
    RAISE NOTICE 'messages tabulka neexistuje — přeskakuji.';
    RETURN;
  END IF;

  -- Drop starých názvů pro idempotenci
  EXECUTE 'DROP POLICY IF EXISTS messages_tenant_select ON public.messages';
  EXECUTE 'DROP POLICY IF EXISTS messages_tenant_insert ON public.messages';
  EXECUTE 'DROP POLICY IF EXISTS messages_tenant_update ON public.messages';
  EXECUTE 'DROP POLICY IF EXISTS messages_tenant_delete ON public.messages';
  EXECUTE 'DROP POLICY IF EXISTS messages_participant_select ON public.messages';
  EXECUTE 'DROP POLICY IF EXISTS messages_participant_insert ON public.messages';

  -- Tenant scope (poradce)
  EXECUTE $p$
    CREATE POLICY messages_tenant_select ON public.messages
      FOR SELECT TO authenticated, aidvisora_app
      USING (tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid)
  $p$;
  EXECUTE $p$
    CREATE POLICY messages_tenant_insert ON public.messages
      FOR INSERT TO authenticated, aidvisora_app
      WITH CHECK (tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid)
  $p$;
  EXECUTE $p$
    CREATE POLICY messages_tenant_update ON public.messages
      FOR UPDATE TO authenticated, aidvisora_app
      USING (tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid)
      WITH CHECK (tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid)
  $p$;
  EXECUTE $p$
    CREATE POLICY messages_tenant_delete ON public.messages
      FOR DELETE TO authenticated, aidvisora_app
      USING (tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid)
  $p$;

  -- Participant (client user) scope — jen pokud contacts má `auth_user_id` sloupec
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'auth_user_id'
  ) INTO has_contact_auth_user_id;

  IF has_contact_auth_user_id THEN
    EXECUTE $p$
      CREATE POLICY messages_participant_select ON public.messages
        FOR SELECT TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.contacts c
            WHERE c.id = messages.contact_id
              AND c.auth_user_id = (SELECT auth.uid())
          )
        )
    $p$;
    -- Klient smí vložit zprávu pro svůj kontakt jako sender_type='client'
    EXECUTE $p$
      CREATE POLICY messages_participant_insert ON public.messages
        FOR INSERT TO authenticated
        WITH CHECK (
          sender_type = 'client'
          AND EXISTS (
            SELECT 1 FROM public.contacts c
            WHERE c.id = messages.contact_id
              AND c.auth_user_id = (SELECT auth.uid())
              AND messages.tenant_id = c.tenant_id
          )
        )
    $p$;
  ELSE
    RAISE NOTICE 'contacts.auth_user_id neexistuje — participant scope pro klienta vynechán.';
  END IF;
END $$;

-- =============================================================================
-- D) message_attachments — tenant scope přes join na messages
-- =============================================================================
-- message_attachments nemá vlastní tenant_id (schema je lightweight: messageId FK), takže
-- musíme odvodit tenant přes messages.tenant_id.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'message_attachments'
  ) THEN
    RAISE NOTICE 'message_attachments neexistuje.';
    RETURN;
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS message_attachments_via_message_select ON public.message_attachments';
  EXECUTE 'DROP POLICY IF EXISTS message_attachments_via_message_insert ON public.message_attachments';
  EXECUTE 'DROP POLICY IF EXISTS message_attachments_via_message_delete ON public.message_attachments';

  EXECUTE $p$
    CREATE POLICY message_attachments_via_message_select ON public.message_attachments
      FOR SELECT TO authenticated, aidvisora_app
      USING (
        EXISTS (
          SELECT 1 FROM public.messages m
          WHERE m.id = message_attachments.message_id
            AND m.tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid
        )
      )
  $p$;
  EXECUTE $p$
    CREATE POLICY message_attachments_via_message_insert ON public.message_attachments
      FOR INSERT TO authenticated, aidvisora_app
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.messages m
          WHERE m.id = message_attachments.message_id
            AND m.tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid
        )
      )
  $p$;
  EXECUTE $p$
    CREATE POLICY message_attachments_via_message_delete ON public.message_attachments
      FOR DELETE TO authenticated, aidvisora_app
      USING (
        EXISTS (
          SELECT 1 FROM public.messages m
          WHERE m.id = message_attachments.message_id
            AND m.tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid
        )
      )
  $p$;
END $$;

-- =============================================================================
-- E) Sanity verifikace
-- =============================================================================
DO $$
DECLARE
  missing_rls text;
  total integer;
BEGIN
  SELECT string_agg(c.relname, ', ')
    INTO missing_rls
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relname IN ('messages', 'message_attachments', 'contact_coverage')
    AND NOT c.relrowsecurity;
  IF missing_rls IS NOT NULL THEN
    RAISE EXCEPTION 'M3/M4: RLS stále OFF na: %', missing_rls;
  END IF;

  SELECT count(*)
    INTO total
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('messages', 'message_attachments', 'contact_coverage',
                      'contacts', 'documents', 'tasks');
  IF total < 10 THEN
    RAISE EXCEPTION 'M3/M4: na hlavních tabulkách je jen % policies (očekáváno >= 10).', total;
  END IF;
END $$;

COMMIT;
