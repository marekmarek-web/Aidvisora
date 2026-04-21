-- WS-2 / M7 — Storage policies pro bucket `documents`
-- Datum: 2026-04-21
--
-- Kontext:
--   Bucket `documents` je private (viz snapshot 2026-04-19, sekce 6.1). Storage runtime
--   aplikace používá Supabase admin key (`SUPABASE_SERVICE_ROLE_KEY`) přes
--   `apps/web/src/lib/supabase/server.ts:createAdminClient`, takže aktuálně přistupujeme
--   jako service role → ignoruje RLS. Následující policies jsou **defense-in-depth** pro
--   případ, že:
--     a) se v budoucnu přepne část čtení na klientský `authenticated` token (PostgREST
--        storage endpointy),
--     b) se v budoucnu místo admin key použije impersonated JWT klienta,
--     c) server-side chyba propustí service_role request bez tenant scopu.
--
--   Konvence pro storage path v aplikaci (kontrolováno v server actions / API routes):
--     `<tenant_id>/<contact_id>/<file.ext>`            — kontaktní dokumenty
--     `<tenant_id>/avatars/<contact_id>/...`           — avatary kontaktů
--     `<tenant_id>/advisor-avatars/<user_id>/...`      — avatary poradců
--     `<tenant_id>/advisor-report-logos/<user_id>/...` — branding pro PDF
--     `uploads/<contact_id>/...`                        — legacy (bez tenant prefixu) — deprecated
--
-- Pravidla:
--   - `authenticated` role (i poradce v budoucí session-tokened cestě): smí SELECT / INSERT /
--     UPDATE / DELETE jen objekty, jejichž první segment `name` (`split_part(name, '/', 1)`)
--     odpovídá `app.tenant_id` GUC dané session.
--   - `aidvisora_app` (run-time role z `rls-app-role-and-force-2026-04-19.sql`) má stejné
--     omezení.
--   - `anon`: žádný přístup.
--   - `service_role`: beze změny (zůstává BYPASSRLS).
--
-- Idempotentní. Bezpečné re-run.

BEGIN;

-- =============================================================================
-- 1) Zapnout RLS na storage.objects (Supabase default je ON, ale ujišťujeme se).
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'storage' AND table_name = 'objects'
  ) THEN
    EXECUTE 'ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- =============================================================================
-- 2) Drop starých variant policies (idempotence)
-- =============================================================================
DROP POLICY IF EXISTS documents_tenant_select    ON storage.objects;
DROP POLICY IF EXISTS documents_tenant_insert    ON storage.objects;
DROP POLICY IF EXISTS documents_tenant_update    ON storage.objects;
DROP POLICY IF EXISTS documents_tenant_delete    ON storage.objects;

-- =============================================================================
-- 3) Nové tenant-path-prefix policies pro bucket `documents`
-- =============================================================================
-- Podmínka se opírá o fakt, že `storage.objects.name` je úplná cesta v bucketu.
-- `split_part(name, '/', 1)` → první segment, který u naší konvence = tenant UUID.
-- Pokud `app.tenant_id` není v session nastaven (`current_setting(..., true)` vrátí NULL
-- nebo prázdný string), policy dá DENY (NULL = NULL je NULL, USING NULL → skip).

-- SELECT
CREATE POLICY documents_tenant_select ON storage.objects
  FOR SELECT
  TO authenticated, aidvisora_app
  USING (
    bucket_id = 'documents'
    AND split_part(name, '/', 1) = (SELECT current_setting('app.tenant_id', true))
    AND (SELECT current_setting('app.tenant_id', true)) <> ''
  );

-- INSERT
CREATE POLICY documents_tenant_insert ON storage.objects
  FOR INSERT
  TO authenticated, aidvisora_app
  WITH CHECK (
    bucket_id = 'documents'
    AND split_part(name, '/', 1) = (SELECT current_setting('app.tenant_id', true))
    AND (SELECT current_setting('app.tenant_id', true)) <> ''
  );

-- UPDATE
CREATE POLICY documents_tenant_update ON storage.objects
  FOR UPDATE
  TO authenticated, aidvisora_app
  USING (
    bucket_id = 'documents'
    AND split_part(name, '/', 1) = (SELECT current_setting('app.tenant_id', true))
    AND (SELECT current_setting('app.tenant_id', true)) <> ''
  )
  WITH CHECK (
    bucket_id = 'documents'
    AND split_part(name, '/', 1) = (SELECT current_setting('app.tenant_id', true))
    AND (SELECT current_setting('app.tenant_id', true)) <> ''
  );

-- DELETE
CREATE POLICY documents_tenant_delete ON storage.objects
  FOR DELETE
  TO authenticated, aidvisora_app
  USING (
    bucket_id = 'documents'
    AND split_part(name, '/', 1) = (SELECT current_setting('app.tenant_id', true))
    AND (SELECT current_setting('app.tenant_id', true)) <> ''
  );

-- =============================================================================
-- 4) Sanity verifikace
-- =============================================================================
DO $$
DECLARE
  policy_count integer;
BEGIN
  SELECT count(*)
    INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname LIKE 'documents_tenant_%';
  IF policy_count <> 4 THEN
    RAISE EXCEPTION 'M7: očekávány 4 documents_tenant_* policies, nalezeno: %', policy_count;
  END IF;
END $$;

COMMIT;

-- =============================================================================
-- POZNÁMKY
-- =============================================================================
-- 1. Aplikace dnes pro storage používá `SUPABASE_SERVICE_ROLE_KEY` → RLS je bypassnuta.
--    Policy je tedy defense-in-depth, ne kritický gating. Reálnou tenant-path kontrolu
--    provádí server kód (upload route / server actions kontrolují `${tenantId}/...` prefix).
-- 2. Pro user-facing download používáme signed URL vygenerované admin klientem; signed URL
--    je krátkodobá a nezávisí na storage.objects policies.
-- 3. Žádná policy netýkající se bucketu `documents` není touto migrací dotčena (buckety
--    `attachments`, `contracts`, `reports`, `request_files`, `uploads` mají vlastní policies
--    mimo WS-2 Batch 5 scope; přidání tenant policies pro ně je follow-up).
