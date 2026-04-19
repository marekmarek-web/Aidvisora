-- WS-2 Batch 2 / Enforcement — non-superuser runtime role + FORCE RLS na citlivé tabulky
-- Datum: 2026-04-19
--
-- Kontext:
--   Runtime Drizzle user je Supabase `postgres` (role `postgres.<project-ref>` přes pooler).
--   Ta má atribut BYPASSRLS, takže RLS policies + `FORCE ROW LEVEL SECURITY` jsou proti němu
--   nevymahatelné. Jediné dvě cesty k reálnému vymáhání:
--     A) připojovat se pod non-superuser / NOBYPASSRLS roli (tento skript),
--     B) spoléhat výhradně na FORCE RLS (nedostatečné proti BYPASSRLS a owner rolím).
--
-- Zvolená cesta: **A + B** (combined):
--   1. Vytvoříme aplikační roli `aidvisora_app` — LOGIN, NOSUPERUSER, NOBYPASSRLS, NOCREATEDB,
--      NOCREATEROLE, NOINHERIT atributy. Role má GRANTS pouze na `public` schéma a tabulky
--      nutné pro aplikační runtime (bez `pg_catalog` manipulace).
--   2. Vynutíme `FORCE ROW LEVEL SECURITY` na tabulkách, kde leží PII / smlouvy / dokumenty.
--      FORCE RLS aktivuje RLS i proti ownerovi tabulky, ale NEobejde BYPASSRLS atribut role.
--      Takže pro `postgres` runtime je to dnes stále no-op; pro `aidvisora_app` (po swapu
--      DATABASE_URL v infra) to začne okamžitě vymáhat policies.
--
-- Co tato migrace **neudělá**:
--   - Nezmění `DATABASE_URL`. To je infra zásah (Vercel env) — viz poznámka níže.
--   - Neodstraní atribut BYPASSRLS z role `postgres` (to by rozbilo Supabase admin UI /
--     migrace / connection pool). Přepnutí runtime se dělá **změnou connection stringu**, ne
--     degradací rolí.
--   - Nepřidává nové RLS policies (to řeší M3/M4/M5 migrace).
--
-- Idempotentní. Bezpečné re-run (DO blok kontroluje existenci role a tabulek).

BEGIN;

-- =============================================================================
-- 1) Vytvoření aplikační role `aidvisora_app`
-- =============================================================================
--
-- Po vytvoření stačí v infra (Vercel Production env) nastavit druhé connection string:
--   DATABASE_URL_APP = postgresql://aidvisora_app.<project-ref>:<password>@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true
-- a `apps/web/src/lib/db-client.ts` nechat číst `DATABASE_URL_APP` místo `DATABASE_URL`.
-- Heslo role musí být nastaveno externě (psql `ALTER ROLE aidvisora_app PASSWORD '...';`),
-- v migraci ho záměrně nenastavujeme, aby nebylo v gitu.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aidvisora_app') THEN
    -- LOGIN role, bez superuseru, bez BYPASSRLS, bez práv na createdb/role.
    CREATE ROLE aidvisora_app
      LOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOBYPASSRLS
      NOINHERIT;
  ELSE
    -- Idempotence: pojistky atributů pro případ, že někdo roli mezitím upravil.
    ALTER ROLE aidvisora_app NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT;
  END IF;
END $$;

-- Přístup ke schématu + sekvence + tabulkám.
GRANT USAGE ON SCHEMA public TO aidvisora_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO aidvisora_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO aidvisora_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO aidvisora_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO aidvisora_app;

-- Přístup ke storage schema pro případné signed URL metadata + k `auth.uid()` helperu.
-- Pozn.: Supabase `auth` schema → EXECUTE přístup na `auth.uid()` mají PUBLIC; jen jistíme.
GRANT USAGE ON SCHEMA auth TO aidvisora_app;
GRANT EXECUTE ON FUNCTION auth.uid() TO aidvisora_app;

-- `set_config('app.tenant_id', ...)` je built-in; volání má PUBLIC. Nic dodatečně nepovolujeme.

-- =============================================================================
-- 2) FORCE ROW LEVEL SECURITY na citlivé tabulky
-- =============================================================================
--
-- FORCE RLS platí i proti ownerovi tabulky, **ale stále je bypassnutelné atributem BYPASSRLS**.
-- Je to tedy hlavně pojistka pro okamžik, kdy runtime přestane běžet pod `postgres`.
-- Rozsah = tabulky, které drží PII / smlouvy / dokumenty / audit.

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'contacts', 'contracts', 'households', 'household_members',
    'documents', 'document_extractions', 'document_extraction_fields',
    'document_versions', 'document_processing_jobs',
    'contract_upload_reviews', 'contract_review_corrections',
    'contact_coverage', 'tasks', 'opportunities',
    'financial_analyses', 'financial_shared_facts',
    'fa_plan_items', 'fa_sync_log',
    'messages', 'message_attachments',
    'consents', 'processing_purposes', 'aml_checklists',
    'exports', 'export_artifacts',
    'audit_log', 'activity_log',
    'memberships', 'staff_invitations', 'user_profiles',
    'tenants', 'tenant_settings',
    'notifications', 'portal_notifications', 'advisor_notifications',
    'communication_drafts',
    'reminders', 'meeting-notes', 'meeting_notes',
    'client_requests', 'client_request_files'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
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
-- 3) Verifikace
-- =============================================================================
DO $$
DECLARE
  app_role_ok boolean;
  force_count integer;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = 'aidvisora_app'
      AND rolsuper = false
      AND rolbypassrls = false
      AND rolcanlogin = true
  ) INTO app_role_ok;
  IF NOT app_role_ok THEN
    RAISE EXCEPTION 'Enforcement: role aidvisora_app neexistuje nebo nemá správné atributy.';
  END IF;

  SELECT count(*)
    INTO force_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relforcerowsecurity = true;

  IF force_count < 20 THEN
    RAISE EXCEPTION 'Enforcement: FORCE RLS je aktivní jen na % tabulkách — očekáváno alespoň 20.', force_count;
  END IF;
END $$;

COMMIT;

-- =============================================================================
-- POST-DEPLOY INFRA STEPS (ručně, mimo SQL):
-- =============================================================================
-- 1. V Supabase SQL konzoli nastavit heslo pro `aidvisora_app`:
--      ALTER ROLE aidvisora_app PASSWORD '<dlouhe-nahodne-heslo>';
-- 2. Ve Vercel → Aidvisora → Settings → Environment Variables pro Production:
--      DATABASE_URL=postgresql://aidvisora_app.<ref>:<password>@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true
--    (staré heslo pro `postgres` nechat jako `SUPABASE_DB_URL` / admin-only).
-- 3. Před produkčním swapem otestovat staging — `apps/web/src/lib/db/with-tenant-context.ts`
--    musí obtékat VŠECHNY tenant-scoped dotazy. Pokud nějaký dotaz nepůjde přes tento helper,
--    pod `aidvisora_app` spadne na deny-all (0 rows / error). Rollback = swap env zpět.
-- 4. Po swapu re-run tohoto snapshotu pro potvrzení, že `current_user` = `aidvisora_app` a
--    `is_superuser = off`.
