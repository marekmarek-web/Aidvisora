-- WS-2 Batch 3 — Swap readiness RLS policy completion
-- Datum: 2026-04-19
--
-- Cíl: dostat DB do stavu, kdy je bezpečné přepnout runtime `DATABASE_URL` z Supabase
-- `postgres` (BYPASSRLS) na `aidvisora_app` (NOBYPASSRLS), aniž by spadly základní flows
-- (login, dashboard, team, setup, AI Review, mindmap, board, messaging, GDPR export,
-- notifications, onboarding, atd.).
--
-- Rozsah (striktně jen hard blocker minimum; nice-to-have je v Batch 4):
--   0) FIX `contracts` policies — přidat roli `aidvisora_app` (Batch 1 M2 je jen pro
--      `authenticated`, což by po swapu = deny-all pro runtime).
--   1) Bootstrap tier — tabulky nutné k vyřešení tenantu ze session (login flow):
--        memberships, user_profiles, tenants, roles, staff_invitations, client_contacts
--      Policies zde **nesmějí** tvrdě záviset na `app.tenant_id`, protože `getMembership()`
--      běží ještě PŘED `withTenantContext()`. Místo toho akceptují buď
--        (a) `current_setting('app.user_id')` — nastaveno nově přidaným `withUserContext()`
--        (b) `auth.uid()::text` — pokud query běží pod PostgREST JWT session
--        (c) fallback `app.tenant_id` — jakmile tenant je už znám (admin-side ops).
--   2) Export tier — `export_artifacts` (GDPR export flow; nemá vlastní tenant_id,
--      join přes `exports.tenant_id`).
--   3) Core post-login tier — tenant-scoped tabulky (`tenant_id` přímo ve schématu),
--      které se natahují hned po loginu do dashboardu / detailů / settings.
--   4) Join-scoped tier — tabulky bez vlastního `tenant_id`, patřící pod tenant-owner
--      parent (households, documents, mindmap_maps, advisor_business_plans).
--
-- CO NEdělá (Batch 4):
--   - AI audit (ai_feedback, ai_generations), analysis_*, background queues
--     (dead_letter_items, analysis_import_jobs), admin-only (incident_logs).
--   - Stripe side (invoices, stripe_webhook_events) — mimo WS-2 scope.
--   - Termination stack (termination_*, insurer_termination_registry) — nevolá se
--     z primárního post-login flow.
--   - Globální katalog (partners, products) — vyžaduje special read-all + tenant-write
--     design, ne minimum-blocker scope.
--   - Legacy tabulky (profiles, organizations, payment_accounts, fund_add_requests,
--     opportunity_stages) — pokud je runtime potřebuje, bude to vidět v testu a doplní se.
--   - PII encryption backfill, MFA policies, storage signed-URL hardening, web/legal.
--
-- NULLIF pattern:
--   `current_setting('app.x', true)` vrací '' pokud GUC není nastaveno. Přímá ::uuid
--   by selhala. Všude v policies, kde může být GUC nenastavená (bootstrap tier),
--   používáme `NULLIF(current_setting('...'), '')::uuid` a explicitní `IS NOT NULL`
--   guard, aby fail-closed neházelo SQLSTATE ale vrátilo 0 rows.
--
-- Idempotentní. Bezpečné re-run.

BEGIN;

-- =============================================================================
-- 0) FIX: contracts policies — přidat roli `aidvisora_app`
-- =============================================================================
-- Batch 1 M2 vytvořila contracts_tenant_* jen pro `authenticated`. Po swapu runtime
-- na `aidvisora_app` by contracts spadlo na deny-all pro každý Drizzle dotaz.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='contracts') THEN
    EXECUTE 'DROP POLICY IF EXISTS contracts_tenant_select ON public.contracts';
    EXECUTE 'DROP POLICY IF EXISTS contracts_tenant_insert ON public.contracts';
    EXECUTE 'DROP POLICY IF EXISTS contracts_tenant_update ON public.contracts';
    EXECUTE 'DROP POLICY IF EXISTS contracts_tenant_delete ON public.contracts';

    EXECUTE $p$
      CREATE POLICY contracts_tenant_select ON public.contracts
        FOR SELECT TO authenticated, aidvisora_app
        USING (tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid)
    $p$;
    EXECUTE $p$
      CREATE POLICY contracts_tenant_insert ON public.contracts
        FOR INSERT TO authenticated, aidvisora_app
        WITH CHECK (tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid)
    $p$;
    EXECUTE $p$
      CREATE POLICY contracts_tenant_update ON public.contracts
        FOR UPDATE TO authenticated, aidvisora_app
        USING (tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid)
        WITH CHECK (tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid)
    $p$;
    EXECUTE $p$
      CREATE POLICY contracts_tenant_delete ON public.contracts
        FOR DELETE TO authenticated, aidvisora_app
        USING (tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid)
    $p$;
  END IF;
END $$;

-- =============================================================================
-- 1) BOOTSTRAP TIER — login / session lookup
-- =============================================================================

-- 1.1 memberships
-- SELECT: čtu jen svoje membership (getMembership), nebo všechny members svého tenantu
--         (team management), nebo PostgREST přes auth.uid().
-- WRITE : jen pod plným tenant contextem (admin-side invite accept / role change).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='memberships') THEN
    RETURN;
  END IF;
  EXECUTE 'DROP POLICY IF EXISTS memberships_self_select       ON public.memberships';
  EXECUTE 'DROP POLICY IF EXISTS memberships_tenant_select     ON public.memberships';
  EXECUTE 'DROP POLICY IF EXISTS memberships_tenant_insert     ON public.memberships';
  EXECUTE 'DROP POLICY IF EXISTS memberships_tenant_update     ON public.memberships';
  EXECUTE 'DROP POLICY IF EXISTS memberships_tenant_delete     ON public.memberships';

  EXECUTE $p$
    CREATE POLICY memberships_self_select ON public.memberships
      FOR SELECT TO authenticated, aidvisora_app
      USING (
        user_id = NULLIF(current_setting('app.user_id', true), '')
        OR user_id = (SELECT auth.uid())::text
        OR (
          NULLIF(current_setting('app.tenant_id', true), '') IS NOT NULL
          AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
        )
      )
  $p$;
  EXECUTE $p$
    CREATE POLICY memberships_tenant_insert ON public.memberships
      FOR INSERT TO authenticated, aidvisora_app
      WITH CHECK (
        NULLIF(current_setting('app.tenant_id', true), '') IS NOT NULL
        AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      )
  $p$;
  EXECUTE $p$
    CREATE POLICY memberships_tenant_update ON public.memberships
      FOR UPDATE TO authenticated, aidvisora_app
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NOT NULL
        AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      )
      WITH CHECK (
        NULLIF(current_setting('app.tenant_id', true), '') IS NOT NULL
        AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      )
  $p$;
  EXECUTE $p$
    CREATE POLICY memberships_tenant_delete ON public.memberships
      FOR DELETE TO authenticated, aidvisora_app
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NOT NULL
        AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      )
  $p$;

  EXECUTE 'ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.memberships FORCE ROW LEVEL SECURITY';
END $$;

-- 1.2 user_profiles (user_id PK, text)
-- Self view + update, peer read (same tenant via memberships).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user_profiles') THEN
    RETURN;
  END IF;
  EXECUTE 'DROP POLICY IF EXISTS user_profiles_self_select    ON public.user_profiles';
  EXECUTE 'DROP POLICY IF EXISTS user_profiles_self_upsert    ON public.user_profiles';
  EXECUTE 'DROP POLICY IF EXISTS user_profiles_self_update    ON public.user_profiles';
  EXECUTE 'DROP POLICY IF EXISTS user_profiles_self_delete    ON public.user_profiles';
  EXECUTE 'DROP POLICY IF EXISTS user_profiles_peer_select    ON public.user_profiles';

  EXECUTE $p$
    CREATE POLICY user_profiles_self_select ON public.user_profiles
      FOR SELECT TO authenticated, aidvisora_app
      USING (
        user_id = NULLIF(current_setting('app.user_id', true), '')
        OR user_id = (SELECT auth.uid())::text
      )
  $p$;
  EXECUTE $p$
    CREATE POLICY user_profiles_peer_select ON public.user_profiles
      FOR SELECT TO authenticated, aidvisora_app
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.memberships m
          WHERE m.user_id = public.user_profiles.user_id
            AND m.tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
        )
      )
  $p$;
  EXECUTE $p$
    CREATE POLICY user_profiles_self_upsert ON public.user_profiles
      FOR INSERT TO authenticated, aidvisora_app
      WITH CHECK (
        user_id = NULLIF(current_setting('app.user_id', true), '')
        OR user_id = (SELECT auth.uid())::text
      )
  $p$;
  EXECUTE $p$
    CREATE POLICY user_profiles_self_update ON public.user_profiles
      FOR UPDATE TO authenticated, aidvisora_app
      USING (
        user_id = NULLIF(current_setting('app.user_id', true), '')
        OR user_id = (SELECT auth.uid())::text
      )
      WITH CHECK (
        user_id = NULLIF(current_setting('app.user_id', true), '')
        OR user_id = (SELECT auth.uid())::text
      )
  $p$;
  EXECUTE $p$
    CREATE POLICY user_profiles_self_delete ON public.user_profiles
      FOR DELETE TO authenticated, aidvisora_app
      USING (
        user_id = NULLIF(current_setting('app.user_id', true), '')
        OR user_id = (SELECT auth.uid())::text
      )
  $p$;

  EXECUTE 'ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.user_profiles FORCE ROW LEVEL SECURITY';
END $$;

-- 1.3 tenants
-- Poradce / klient smí vidět jen svůj tenant. Žádná primární role v produkci
-- nevytváří tenanty za běhu → INSERT / UPDATE / DELETE mimo aplikační scope.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenants') THEN
    RETURN;
  END IF;
  EXECUTE 'DROP POLICY IF EXISTS tenants_member_select        ON public.tenants';
  EXECUTE 'DROP POLICY IF EXISTS tenants_member_update        ON public.tenants';

  EXECUTE $p$
    CREATE POLICY tenants_member_select ON public.tenants
      FOR SELECT TO authenticated, aidvisora_app
      USING (
        (
          NULLIF(current_setting('app.tenant_id', true), '') IS NOT NULL
          AND id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
        )
        OR EXISTS (
          SELECT 1 FROM public.memberships m
          WHERE m.tenant_id = public.tenants.id
            AND (
              m.user_id = NULLIF(current_setting('app.user_id', true), '')
              OR m.user_id = (SELECT auth.uid())::text
            )
        )
      )
  $p$;
  -- Update: jen pod tenant contextem (nastavení tenant metadat z admin UI).
  EXECUTE $p$
    CREATE POLICY tenants_member_update ON public.tenants
      FOR UPDATE TO authenticated, aidvisora_app
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NOT NULL
        AND id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      )
      WITH CHECK (
        NULLIF(current_setting('app.tenant_id', true), '') IS NOT NULL
        AND id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      )
  $p$;

  EXECUTE 'ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.tenants FORCE ROW LEVEL SECURITY';
END $$;

-- 1.4 roles — tenant-scoped (roles.tenant_id)
-- Uživatel smí číst role svého tenantu; update jen pod tenant contextem.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='roles') THEN
    RETURN;
  END IF;
  EXECUTE 'DROP POLICY IF EXISTS roles_tenant_select          ON public.roles';
  EXECUTE 'DROP POLICY IF EXISTS roles_member_self_select     ON public.roles';
  EXECUTE 'DROP POLICY IF EXISTS roles_tenant_insert          ON public.roles';
  EXECUTE 'DROP POLICY IF EXISTS roles_tenant_update          ON public.roles';
  EXECUTE 'DROP POLICY IF EXISTS roles_tenant_delete          ON public.roles';

  -- (a) pod plným tenant contextem
  EXECUTE $p$
    CREATE POLICY roles_tenant_select ON public.roles
      FOR SELECT TO authenticated, aidvisora_app
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NOT NULL
        AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      )
  $p$;
  -- (b) bootstrap: role, kterou má moje membership (pro getMembership join)
  EXECUTE $p$
    CREATE POLICY roles_member_self_select ON public.roles
      FOR SELECT TO authenticated, aidvisora_app
      USING (
        EXISTS (
          SELECT 1 FROM public.memberships m
          WHERE m.role_id = public.roles.id
            AND (
              m.user_id = NULLIF(current_setting('app.user_id', true), '')
              OR m.user_id = (SELECT auth.uid())::text
            )
        )
      )
  $p$;
  EXECUTE $p$
    CREATE POLICY roles_tenant_insert ON public.roles
      FOR INSERT TO authenticated, aidvisora_app
      WITH CHECK (
        NULLIF(current_setting('app.tenant_id', true), '') IS NOT NULL
        AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      )
  $p$;
  EXECUTE $p$
    CREATE POLICY roles_tenant_update ON public.roles
      FOR UPDATE TO authenticated, aidvisora_app
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NOT NULL
        AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      )
      WITH CHECK (
        NULLIF(current_setting('app.tenant_id', true), '') IS NOT NULL
        AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      )
  $p$;
  EXECUTE $p$
    CREATE POLICY roles_tenant_delete ON public.roles
      FOR DELETE TO authenticated, aidvisora_app
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NOT NULL
        AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      )
  $p$;

  EXECUTE 'ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.roles FORCE ROW LEVEL SECURITY';
END $$;

-- 1.5 staff_invitations — čistě tenant-scoped (write pod tenant contextem; token accept
-- je server-side action ověřující token mimo RLS, pod aidvisora_app to projde jen s GUC).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='staff_invitations') THEN
    RETURN;
  END IF;
  EXECUTE 'DROP POLICY IF EXISTS staff_invitations_tenant_select ON public.staff_invitations';
  EXECUTE 'DROP POLICY IF EXISTS staff_invitations_tenant_insert ON public.staff_invitations';
  EXECUTE 'DROP POLICY IF EXISTS staff_invitations_tenant_update ON public.staff_invitations';
  EXECUTE 'DROP POLICY IF EXISTS staff_invitations_tenant_delete ON public.staff_invitations';

  EXECUTE $p$
    CREATE POLICY staff_invitations_tenant_select ON public.staff_invitations
      FOR SELECT TO authenticated, aidvisora_app
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NOT NULL
        AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      )
  $p$;
  EXECUTE $p$
    CREATE POLICY staff_invitations_tenant_insert ON public.staff_invitations
      FOR INSERT TO authenticated, aidvisora_app
      WITH CHECK (
        NULLIF(current_setting('app.tenant_id', true), '') IS NOT NULL
        AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      )
  $p$;
  EXECUTE $p$
    CREATE POLICY staff_invitations_tenant_update ON public.staff_invitations
      FOR UPDATE TO authenticated, aidvisora_app
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NOT NULL
        AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      )
      WITH CHECK (
        NULLIF(current_setting('app.tenant_id', true), '') IS NOT NULL
        AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      )
  $p$;
  EXECUTE $p$
    CREATE POLICY staff_invitations_tenant_delete ON public.staff_invitations
      FOR DELETE TO authenticated, aidvisora_app
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NOT NULL
        AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      )
  $p$;

  EXECUTE 'ALTER TABLE public.staff_invitations ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.staff_invitations FORCE ROW LEVEL SECURITY';
END $$;

-- 1.6 client_contacts — (tenant_id, user_id) mapa klient↔kontakt; bootstrap klient
-- portálu potřebuje lookup před tenant contextem.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='client_contacts') THEN
    RETURN;
  END IF;
  EXECUTE 'DROP POLICY IF EXISTS client_contacts_self_select   ON public.client_contacts';
  EXECUTE 'DROP POLICY IF EXISTS client_contacts_tenant_select ON public.client_contacts';
  EXECUTE 'DROP POLICY IF EXISTS client_contacts_tenant_insert ON public.client_contacts';
  EXECUTE 'DROP POLICY IF EXISTS client_contacts_tenant_update ON public.client_contacts';
  EXECUTE 'DROP POLICY IF EXISTS client_contacts_tenant_delete ON public.client_contacts';

  EXECUTE $p$
    CREATE POLICY client_contacts_self_select ON public.client_contacts
      FOR SELECT TO authenticated, aidvisora_app
      USING (
        user_id = NULLIF(current_setting('app.user_id', true), '')
        OR user_id = (SELECT auth.uid())::text
        OR (
          NULLIF(current_setting('app.tenant_id', true), '') IS NOT NULL
          AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
        )
      )
  $p$;
  EXECUTE $p$
    CREATE POLICY client_contacts_tenant_insert ON public.client_contacts
      FOR INSERT TO authenticated, aidvisora_app
      WITH CHECK (
        NULLIF(current_setting('app.tenant_id', true), '') IS NOT NULL
        AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      )
  $p$;
  EXECUTE $p$
    CREATE POLICY client_contacts_tenant_update ON public.client_contacts
      FOR UPDATE TO authenticated, aidvisora_app
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NOT NULL
        AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      )
      WITH CHECK (
        NULLIF(current_setting('app.tenant_id', true), '') IS NOT NULL
        AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      )
  $p$;
  EXECUTE $p$
    CREATE POLICY client_contacts_tenant_delete ON public.client_contacts
      FOR DELETE TO authenticated, aidvisora_app
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NOT NULL
        AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
      )
  $p$;

  EXECUTE 'ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.client_contacts FORCE ROW LEVEL SECURITY';
END $$;

-- =============================================================================
-- 2) EXPORT TIER — export_artifacts (join přes exports)
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='export_artifacts') THEN
    RETURN;
  END IF;
  EXECUTE 'DROP POLICY IF EXISTS export_artifacts_via_export_select ON public.export_artifacts';
  EXECUTE 'DROP POLICY IF EXISTS export_artifacts_via_export_insert ON public.export_artifacts';
  EXECUTE 'DROP POLICY IF EXISTS export_artifacts_via_export_delete ON public.export_artifacts';

  EXECUTE $p$
    CREATE POLICY export_artifacts_via_export_select ON public.export_artifacts
      FOR SELECT TO authenticated, aidvisora_app
      USING (
        EXISTS (
          SELECT 1 FROM public.exports e
          WHERE e.id = public.export_artifacts.export_id
            AND e.tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid
        )
      )
  $p$;
  EXECUTE $p$
    CREATE POLICY export_artifacts_via_export_insert ON public.export_artifacts
      FOR INSERT TO authenticated, aidvisora_app
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.exports e
          WHERE e.id = public.export_artifacts.export_id
            AND e.tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid
        )
      )
  $p$;
  EXECUTE $p$
    CREATE POLICY export_artifacts_via_export_delete ON public.export_artifacts
      FOR DELETE TO authenticated, aidvisora_app
      USING (
        EXISTS (
          SELECT 1 FROM public.exports e
          WHERE e.id = public.export_artifacts.export_id
            AND e.tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid
        )
      )
  $p$;

  EXECUTE 'ALTER TABLE public.export_artifacts ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.export_artifacts FORCE ROW LEVEL SECURITY';
END $$;

-- =============================================================================
-- 3) CORE POST-LOGIN TIER — generický loop pro přímé tenant_id scope
-- =============================================================================
DO $$
DECLARE
  tbl text;
  tenant_tables text[] := ARRAY[
    -- CRM core
    'events',
    'timeline_items',
    'notification_log',
    'execution_actions',
    'relationships',
    'companies', 'company_person_links',
    -- Advisor workspace
    'advisor_preferences',
    'advisor_business_plans',
    'advisor_vision_goals',
    'note_templates',
    'board_items', 'board_views',
    'mindmap_maps',
    -- Team
    'team_tasks', 'team_events', 'team_goals',
    -- Documents pipeline
    'document_processing_jobs',
    -- AI Review / client-facing
    'client_invitations',
    'client_payment_setups',
    -- Billing (read-only z runtime)
    'subscriptions',
    'subscription_usage_monthly'
  ];
BEGIN
  FOREACH tbl IN ARRAY tenant_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      RAISE NOTICE 'Batch3 skip %: table missing.', tbl;
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'tenant_id'
    ) THEN
      RAISE NOTICE 'Batch3 skip %: no tenant_id column.', tbl;
      CONTINUE;
    END IF;

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

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', tbl);
  END LOOP;
END $$;

-- =============================================================================
-- 4) JOIN-SCOPED TIER — tabulky bez vlastního tenant_id, join přes parent
-- =============================================================================

-- 4.1 household_members → households.tenant_id
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='household_members') THEN
    RETURN;
  END IF;
  EXECUTE 'DROP POLICY IF EXISTS household_members_via_household_select ON public.household_members';
  EXECUTE 'DROP POLICY IF EXISTS household_members_via_household_insert ON public.household_members';
  EXECUTE 'DROP POLICY IF EXISTS household_members_via_household_update ON public.household_members';
  EXECUTE 'DROP POLICY IF EXISTS household_members_via_household_delete ON public.household_members';

  EXECUTE $p$
    CREATE POLICY household_members_via_household_select ON public.household_members
      FOR SELECT TO authenticated, aidvisora_app
      USING (
        EXISTS (
          SELECT 1 FROM public.households h
          WHERE h.id = public.household_members.household_id
            AND h.tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid
        )
      )
  $p$;
  EXECUTE $p$
    CREATE POLICY household_members_via_household_insert ON public.household_members
      FOR INSERT TO authenticated, aidvisora_app
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.households h
          WHERE h.id = public.household_members.household_id
            AND h.tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid
        )
      )
  $p$;
  EXECUTE $p$
    CREATE POLICY household_members_via_household_update ON public.household_members
      FOR UPDATE TO authenticated, aidvisora_app
      USING (
        EXISTS (
          SELECT 1 FROM public.households h
          WHERE h.id = public.household_members.household_id
            AND h.tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.households h
          WHERE h.id = public.household_members.household_id
            AND h.tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid
        )
      )
  $p$;
  EXECUTE $p$
    CREATE POLICY household_members_via_household_delete ON public.household_members
      FOR DELETE TO authenticated, aidvisora_app
      USING (
        EXISTS (
          SELECT 1 FROM public.households h
          WHERE h.id = public.household_members.household_id
            AND h.tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid
        )
      )
  $p$;
  EXECUTE 'ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.household_members FORCE ROW LEVEL SECURITY';
END $$;

-- 4.2 document_versions → documents.tenant_id
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='document_versions') THEN
    RETURN;
  END IF;
  EXECUTE 'DROP POLICY IF EXISTS document_versions_via_document_select ON public.document_versions';
  EXECUTE 'DROP POLICY IF EXISTS document_versions_via_document_insert ON public.document_versions';
  EXECUTE 'DROP POLICY IF EXISTS document_versions_via_document_delete ON public.document_versions';
  EXECUTE $p$
    CREATE POLICY document_versions_via_document_select ON public.document_versions
      FOR SELECT TO authenticated, aidvisora_app
      USING (
        EXISTS (
          SELECT 1 FROM public.documents d
          WHERE d.id = public.document_versions.document_id
            AND d.tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid
        )
      )
  $p$;
  EXECUTE $p$
    CREATE POLICY document_versions_via_document_insert ON public.document_versions
      FOR INSERT TO authenticated, aidvisora_app
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.documents d
          WHERE d.id = public.document_versions.document_id
            AND d.tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid
        )
      )
  $p$;
  EXECUTE $p$
    CREATE POLICY document_versions_via_document_delete ON public.document_versions
      FOR DELETE TO authenticated, aidvisora_app
      USING (
        EXISTS (
          SELECT 1 FROM public.documents d
          WHERE d.id = public.document_versions.document_id
            AND d.tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid
        )
      )
  $p$;
  EXECUTE 'ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.document_versions FORCE ROW LEVEL SECURITY';
END $$;

-- 4.3 document_extraction_fields → document_extractions.tenant_id
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='document_extraction_fields') THEN
    RETURN;
  END IF;
  EXECUTE 'DROP POLICY IF EXISTS document_extraction_fields_via_extraction_select ON public.document_extraction_fields';
  EXECUTE 'DROP POLICY IF EXISTS document_extraction_fields_via_extraction_insert ON public.document_extraction_fields';
  EXECUTE 'DROP POLICY IF EXISTS document_extraction_fields_via_extraction_update ON public.document_extraction_fields';
  EXECUTE 'DROP POLICY IF EXISTS document_extraction_fields_via_extraction_delete ON public.document_extraction_fields';

  EXECUTE $p$
    CREATE POLICY document_extraction_fields_via_extraction_select ON public.document_extraction_fields
      FOR SELECT TO authenticated, aidvisora_app
      USING (
        EXISTS (
          SELECT 1 FROM public.document_extractions de
          WHERE de.id = public.document_extraction_fields.document_extraction_id
            AND de.tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid
        )
      )
  $p$;
  EXECUTE $p$
    CREATE POLICY document_extraction_fields_via_extraction_insert ON public.document_extraction_fields
      FOR INSERT TO authenticated, aidvisora_app
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.document_extractions de
          WHERE de.id = public.document_extraction_fields.document_extraction_id
            AND de.tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid
        )
      )
  $p$;
  EXECUTE $p$
    CREATE POLICY document_extraction_fields_via_extraction_update ON public.document_extraction_fields
      FOR UPDATE TO authenticated, aidvisora_app
      USING (
        EXISTS (
          SELECT 1 FROM public.document_extractions de
          WHERE de.id = public.document_extraction_fields.document_extraction_id
            AND de.tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.document_extractions de
          WHERE de.id = public.document_extraction_fields.document_extraction_id
            AND de.tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid
        )
      )
  $p$;
  EXECUTE $p$
    CREATE POLICY document_extraction_fields_via_extraction_delete ON public.document_extraction_fields
      FOR DELETE TO authenticated, aidvisora_app
      USING (
        EXISTS (
          SELECT 1 FROM public.document_extractions de
          WHERE de.id = public.document_extraction_fields.document_extraction_id
            AND de.tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid
        )
      )
  $p$;
  EXECUTE 'ALTER TABLE public.document_extraction_fields ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.document_extraction_fields FORCE ROW LEVEL SECURITY';
END $$;

-- 4.4 advisor_business_plan_targets → advisor_business_plans.tenant_id
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='advisor_business_plan_targets') THEN
    RETURN;
  END IF;
  EXECUTE 'DROP POLICY IF EXISTS abp_targets_via_plan_select ON public.advisor_business_plan_targets';
  EXECUTE 'DROP POLICY IF EXISTS abp_targets_via_plan_insert ON public.advisor_business_plan_targets';
  EXECUTE 'DROP POLICY IF EXISTS abp_targets_via_plan_update ON public.advisor_business_plan_targets';
  EXECUTE 'DROP POLICY IF EXISTS abp_targets_via_plan_delete ON public.advisor_business_plan_targets';

  EXECUTE $p$
    CREATE POLICY abp_targets_via_plan_select ON public.advisor_business_plan_targets
      FOR SELECT TO authenticated, aidvisora_app
      USING (
        EXISTS (
          SELECT 1 FROM public.advisor_business_plans p
          WHERE p.id = public.advisor_business_plan_targets.plan_id
            AND p.tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid
        )
      )
  $p$;
  EXECUTE $p$
    CREATE POLICY abp_targets_via_plan_insert ON public.advisor_business_plan_targets
      FOR INSERT TO authenticated, aidvisora_app
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.advisor_business_plans p
          WHERE p.id = public.advisor_business_plan_targets.plan_id
            AND p.tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid
        )
      )
  $p$;
  EXECUTE $p$
    CREATE POLICY abp_targets_via_plan_update ON public.advisor_business_plan_targets
      FOR UPDATE TO authenticated, aidvisora_app
      USING (
        EXISTS (
          SELECT 1 FROM public.advisor_business_plans p
          WHERE p.id = public.advisor_business_plan_targets.plan_id
            AND p.tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.advisor_business_plans p
          WHERE p.id = public.advisor_business_plan_targets.plan_id
            AND p.tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid
        )
      )
  $p$;
  EXECUTE $p$
    CREATE POLICY abp_targets_via_plan_delete ON public.advisor_business_plan_targets
      FOR DELETE TO authenticated, aidvisora_app
      USING (
        EXISTS (
          SELECT 1 FROM public.advisor_business_plans p
          WHERE p.id = public.advisor_business_plan_targets.plan_id
            AND p.tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid
        )
      )
  $p$;
  EXECUTE 'ALTER TABLE public.advisor_business_plan_targets ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.advisor_business_plan_targets FORCE ROW LEVEL SECURITY';
END $$;

-- 4.5 mindmap_nodes / mindmap_edges → mindmap_maps.tenant_id
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['mindmap_nodes','mindmap_edges'] LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=tbl) THEN
      CONTINUE;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_via_map_select', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_via_map_insert', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_via_map_update', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_via_map_delete', tbl);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated, aidvisora_app ' ||
      'USING (EXISTS (SELECT 1 FROM public.mindmap_maps mm WHERE mm.id = public.%I.map_id ' ||
      'AND mm.tenant_id = (SELECT current_setting(''app.tenant_id'', true))::uuid))',
      tbl || '_via_map_select', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated, aidvisora_app ' ||
      'WITH CHECK (EXISTS (SELECT 1 FROM public.mindmap_maps mm WHERE mm.id = public.%I.map_id ' ||
      'AND mm.tenant_id = (SELECT current_setting(''app.tenant_id'', true))::uuid))',
      tbl || '_via_map_insert', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated, aidvisora_app ' ||
      'USING (EXISTS (SELECT 1 FROM public.mindmap_maps mm WHERE mm.id = public.%I.map_id ' ||
      'AND mm.tenant_id = (SELECT current_setting(''app.tenant_id'', true))::uuid)) ' ||
      'WITH CHECK (EXISTS (SELECT 1 FROM public.mindmap_maps mm WHERE mm.id = public.%I.map_id ' ||
      'AND mm.tenant_id = (SELECT current_setting(''app.tenant_id'', true))::uuid))',
      tbl || '_via_map_update', tbl, tbl, tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated, aidvisora_app ' ||
      'USING (EXISTS (SELECT 1 FROM public.mindmap_maps mm WHERE mm.id = public.%I.map_id ' ||
      'AND mm.tenant_id = (SELECT current_setting(''app.tenant_id'', true))::uuid))',
      tbl || '_via_map_delete', tbl, tbl);

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', tbl);
  END LOOP;
END $$;

-- =============================================================================
-- 5) Sanity verifikace
-- =============================================================================
DO $$
DECLARE
  missing text[];
  tbl text;
  cnt integer;
  required_tables text[] := ARRAY[
    'memberships', 'user_profiles', 'tenants', 'roles', 'staff_invitations',
    'client_contacts', 'export_artifacts',
    'events', 'timeline_items', 'notification_log', 'execution_actions',
    'relationships', 'companies', 'company_person_links',
    'advisor_preferences', 'advisor_business_plans', 'advisor_vision_goals',
    'advisor_business_plan_targets',
    'note_templates', 'board_items', 'board_views',
    'mindmap_maps', 'mindmap_nodes', 'mindmap_edges',
    'team_tasks', 'team_events', 'team_goals',
    'document_processing_jobs', 'document_versions', 'document_extraction_fields',
    'household_members',
    'client_invitations', 'client_payment_setups',
    'subscriptions', 'subscription_usage_monthly'
  ];
BEGIN
  missing := ARRAY[]::text[];
  FOREACH tbl IN ARRAY required_tables LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=tbl) THEN
      -- tabulka neexistuje (např. na starších envs) — přeskoč z verifikace
      CONTINUE;
    END IF;
    SELECT count(*) INTO cnt FROM pg_policies WHERE schemaname='public' AND tablename = tbl;
    IF cnt = 0 THEN
      missing := array_append(missing, tbl);
    END IF;
  END LOOP;

  IF array_length(missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'Batch3: tabulky BEZ policy po migraci: %', array_to_string(missing, ', ');
  END IF;

  -- contracts policies musí po fixu obsahovat aidvisora_app
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='contracts') THEN
    SELECT count(*) INTO cnt FROM pg_policies
      WHERE schemaname='public' AND tablename='contracts'
        AND 'aidvisora_app' = ANY(roles);
    IF cnt < 4 THEN
      RAISE EXCEPTION 'Batch3: contracts policies nemají roli aidvisora_app (found=%).', cnt;
    END IF;
  END IF;
END $$;

COMMIT;
