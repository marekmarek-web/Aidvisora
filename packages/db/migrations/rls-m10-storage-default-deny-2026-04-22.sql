-- WS-2 / M10 — Storage default-deny pro non-documents buckety
-- Datum: 2026-04-22
--
-- Kontext (follow-up na rls-app-role-and-force + storage-documents-tenant-policies-2026-04-21):
--   Aplikace aktivně používá JEDEN bucket `documents` (viz audit
--   `rg storage.from` napříč `apps/web/src`). Všechna kontaktní dokumentace,
--   smluvní upload, AI review přílohy, message attachmenty, avatary i branding
--   logos se ukládají pod tenant-prefix strukturou:
--
--     documents/<tenant_id>/<contact_id>/<file>              — kontaktní dokumenty
--     documents/<tenant_id>/messages/<msg_id>/<file>         — message attachmenty
--     documents/<tenant_id>/avatars/<contact_id>/...         — avatary kontaktů
--     documents/<tenant_id>/advisor-avatars/<user_id>/...    — avatary poradců
--     documents/<tenant_id>/advisor-report-logos/<user>/...  — branding
--     documents/<tenant_id>/termination-submissions/...      — výpovědi
--
--   Pro bucket `documents` platí tenant-path-prefix policies z migrace
--   `storage-documents-tenant-policies-2026-04-21.sql`.
--
--   Původní WS-2 Batch plán počítal s policiemi pro buckety `attachments`,
--   `contracts`, `reports`, `request_files`, `uploads` — po M4 auditu repozitáře
--   potvrzeno, že **žádný** z těchto názvů bucketu aplikace nepoužívá.
--   Mohou ale existovat jako stopy po historických pokusech v některých
--   Supabase projektech (staging / preview), takže:
--
--     1) Místo per-bucket tenant policies přidáváme jeden catch-all
--        `storage_non_documents_deny` policy, který explicitně zamítne
--        `authenticated` + `aidvisora_app` přístup k jakémukoli jinému bucketu.
--     2) `service_role` zůstává BYPASSRLS a může pokračovat legacy/adminskými
--        operacemi (cleanup, migration utilities).
--     3) `anon` nemá v Supabase defaultně žádný grant na `storage.objects`.
--
--   Důsledek pro cutover:
--     Když aplikace po cutoveru omylem upload-uje pod jiný bucket než
--     `documents` (regrese v kódu) nebo když se jiný bucket zobrazí z důvodu
--     běžícího scriptu, klient-side operace (která by dnes šla přes
--     service_role) spadne na RLS a v Sentry uvidíme breadcrumbu. Tím chráníme
--     proti nezamýšlenému cross-bucket leaku.
--
--   Idempotentní. Bezpečné re-run.
--
-- Předpoklad:
--   RLS na `storage.objects` je ON (ověřeno v `storage-documents-tenant-policies-
--   2026-04-21.sql` — v Supabase dashboardu je to defaultní stav; migrace spadne,
--   pokud by RLS byla vypnutá).

BEGIN;

-- =============================================================================
-- 1) Ověření RLS (defenzivní guard — stejný jako v M7)
-- =============================================================================
DO $$
DECLARE
  rls_enabled boolean;
BEGIN
  SELECT c.relrowsecurity
    INTO rls_enabled
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'storage' AND c.relname = 'objects';

  IF rls_enabled IS NULL THEN
    RAISE EXCEPTION 'M10: storage.objects neexistuje — ověř, že projekt má povolené Storage.';
  END IF;

  IF rls_enabled = false THEN
    RAISE EXCEPTION 'M10: RLS není zapnutá na storage.objects. Zapnout přes Supabase Dashboard → Storage → Policies.';
  END IF;
END $$;

-- =============================================================================
-- 2) Drop starých variant (idempotence)
-- =============================================================================
DROP POLICY IF EXISTS storage_non_documents_deny_select ON storage.objects;
DROP POLICY IF EXISTS storage_non_documents_deny_insert ON storage.objects;
DROP POLICY IF EXISTS storage_non_documents_deny_update ON storage.objects;
DROP POLICY IF EXISTS storage_non_documents_deny_delete ON storage.objects;

-- =============================================================================
-- 3) Catch-all deny pro bucket != 'documents'
--
-- Pozn.: RLS pro `storage.objects` je permissive model — více policies se OR-uje.
-- Proto aby DENY fungoval, vytvoříme RESTRICTIVE policy (PG 14+) s USING false.
-- Restrictive policies se kombinují přes AND → efektivně zamítnou všechny
-- přístupy na non-documents buckety.
--
-- Pokud Postgres verze nepodporuje RESTRICTIVE (< PG 14), policy spadne s
-- "ERROR:  syntax error at or near RESTRICTIVE" — Supabase je na PG 15+, takže
-- tohle je bezpečné.
-- =============================================================================

-- SELECT restrictive deny
CREATE POLICY storage_non_documents_deny_select ON storage.objects
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated, aidvisora_app
  USING ( bucket_id = 'documents' );

-- INSERT restrictive deny
CREATE POLICY storage_non_documents_deny_insert ON storage.objects
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated, aidvisora_app
  WITH CHECK ( bucket_id = 'documents' );

-- UPDATE restrictive deny
CREATE POLICY storage_non_documents_deny_update ON storage.objects
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated, aidvisora_app
  USING ( bucket_id = 'documents' )
  WITH CHECK ( bucket_id = 'documents' );

-- DELETE restrictive deny
CREATE POLICY storage_non_documents_deny_delete ON storage.objects
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated, aidvisora_app
  USING ( bucket_id = 'documents' );

-- =============================================================================
-- 4) Sanity verifikace
-- =============================================================================
DO $$
DECLARE
  documents_count  integer;
  deny_count       integer;
BEGIN
  -- documents_tenant_* z M7 migrace musí stále existovat
  SELECT count(*)
    INTO documents_count
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname LIKE 'documents_tenant_%';
  IF documents_count < 4 THEN
    RAISE EXCEPTION 'M10: chybí documents_tenant_* policies (M7). Nalezeno: %, očekáváno: 4. Spustit storage-documents-tenant-policies-2026-04-21.sql.', documents_count;
  END IF;

  -- Restrictive deny policies
  SELECT count(*)
    INTO deny_count
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname LIKE 'storage_non_documents_deny_%';
  IF deny_count <> 4 THEN
    RAISE EXCEPTION 'M10: očekávány 4 storage_non_documents_deny_* policies, nalezeno: %', deny_count;
  END IF;
END $$;

COMMIT;

-- =============================================================================
-- POZNÁMKY
-- =============================================================================
-- 1. Aplikace dnes pro storage používá `SUPABASE_SERVICE_ROLE_KEY` přes
--    `apps/web/src/lib/supabase/server.ts::createAdminClient`, takže RLS je
--    aktuálně bypassed. Tato migrace je defense-in-depth pro budoucí přepnutí
--    na anon/authenticated JWT, stejně jako M7.
-- 2. Pokud aplikace v budoucnu bude chtít **další** bucket než `documents`
--    (třeba `public-assets` pro marketing), je potřeba:
--      a) přidat per-bucket tenant-prefix policy,
--      b) rozšířit tuto M10 restrictive policy o whitelist (bucket_id IN
--         ('documents', 'public-assets')).
-- 3. Catch-all kontroluje jen `bucket_id`, nikoli tenant-prefix — tenant
--    izolace v `documents` se řeší přes `documents_tenant_*` permissive
--    policies (M7). M10 jen chrání proti „leak do jiného bucketu".
