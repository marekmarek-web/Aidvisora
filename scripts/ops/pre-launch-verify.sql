-- B2.19 — Pre-launch verification SQL queries.
--
-- Spustit proti produkční Supabase DB (read-only) před B1 merge a po každém
-- batch deploy. Každý query vrátí COUNT; očekávané hodnoty jsou v komentáři.
-- Pokud query vrátí vyšší hodnotu, rozhodnout se podle plánu (docs/audit).
--
-- Používat jako: `psql $DATABASE_URL_SERVICE -f scripts/ops/pre-launch-verify.sql`
-- nebo vkládat do Supabase SQL editoru.

-- ─── 1. Memberships: 1 auth user → 1 membership (před B3.10 multi-tenant) ───
-- Očekávaná hodnota: 0. Jinak má někdo víc než jednu roli → blocker pro B3.10.
SELECT
  'memberships_duplicate_users' AS check_name,
  COUNT(*) AS violations,
  'expected=0' AS expected
FROM (
  SELECT auth_user_id
  FROM memberships
  GROUP BY auth_user_id
  HAVING COUNT(*) > 1
) s;

-- ─── 2. Household duplicates (před migrace household-unique-contact) ───
-- Očekávaná hodnota: 0 po nasazení migrace B2.7.
SELECT
  'household_members_duplicates' AS check_name,
  COUNT(*) AS violations,
  'expected=0 after household-unique-contact-2026-04-22' AS expected
FROM (
  SELECT contact_id
  FROM household_members
  GROUP BY contact_id
  HAVING COUNT(*) > 1
) s;

-- ─── 3. contracts.note leak risk ───
-- Očekávaná hodnota: 0 po B1.2 (klient nesmí vidět interní poznámky).
SELECT
  'contracts_note_leaked_to_client' AS check_name,
  COUNT(*) AS violations,
  'expected=0' AS expected
FROM contracts
WHERE visible_to_client = true
  AND note IS NOT NULL
  AND btrim(note) <> '';

-- ─── 4. PII backfill ───
-- Očekávaná hodnota: 0 po dokončení pii-encrypt-contacts-columns-2026-04-21.
SELECT
  'contacts_personal_id_unencrypted' AS check_name,
  COUNT(*) AS violations,
  'expected=0 after pii-encrypt backfill' AS expected
FROM contacts
WHERE personal_id IS NOT NULL
  AND personal_id_ciphertext IS NULL;

-- ─── 5. ZDRAV segment cleanup ───
-- Očekávaná hodnota: 0 (segment byl přejmenován/mergován).
SELECT
  'contracts_segment_zdrav_stragglers' AS check_name,
  COUNT(*) AS violations,
  'expected=0' AS expected
FROM contracts
WHERE segment = 'ZDRAV';

-- ─── 6. Ghost payment setups ───
-- Očekávaná hodnota: 0 po B2.12 (active && !visibleToClient by nemělo vzniknout
-- u nových záznamů; staré se mohou vyskytnout).
SELECT
  'client_payment_setups_ghost_active' AS check_name,
  COUNT(*) AS violations,
  'expected<5 (older rows may exist before B2.12)' AS expected
FROM client_payment_setups
WHERE visible_to_client = false
  AND status = 'active'
  AND created_at > now() - interval '30 days';

-- ─── 7. Stuck AI reviews ───
-- Očekávaná hodnota: 0 po B1.9 stuck-contract-reviews cron.
SELECT
  'contract_upload_reviews_stuck_processing' AS check_name,
  COUNT(*) AS violations,
  'expected=0' AS expected
FROM contract_upload_reviews
WHERE processing_status = 'processing'
  AND created_at < now() - interval '30 minutes';

-- ─── 8. Applied migrations sanity check ───
-- V Aidvisora repozitáři:
--   - Drizzle Kit migrace → tabulka `__drizzle_migrations`
--   - Custom SQL migrace v `packages/db/migrations/*.sql` → trackované ad-hoc.
-- Pro kritické ad-hoc migrace neexistuje centrální log, proto tady pouze
-- checklist pro manual verify. Pokud jsi migraci pustil přes `psql -f ...`,
-- ověř vizuálně existenci nové tabulky/indexu v DB (např. pg_indexes pro
-- `household_members_unique_contact`).

-- 8a) Household unique index (migrace household-unique-contact-2026-04-22)
SELECT
  'household_unique_index_applied' AS check_name,
  COUNT(*) AS exists_count,
  'expected=1' AS expected
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'household_members'
  AND indexname = 'household_members_unique_contact';

-- 8b) subscriptions.grace_period_ends_at column (migrace subscriptions-grace-reminder-2026-04-21)
SELECT
  'subscriptions_grace_column' AS check_name,
  COUNT(*) AS exists_count,
  'expected=1' AS expected
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'subscriptions'
  AND column_name = 'grace_period_ends_at';

-- 8c) Stripe webhook idempotency table (migrace stripe-webhook-idempotency-2026-04-20)
SELECT
  'stripe_webhook_idempotency_table' AS check_name,
  COUNT(*) AS exists_count,
  'expected=1' AS expected
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('stripe_webhook_events', 'stripe_webhook_log');

-- 8d) PII encryption columns (migrace pii-encrypt-contacts-columns-2026-04-21)
SELECT
  'pii_encrypted_columns' AS check_name,
  COUNT(*) AS exists_count,
  'expected>=1' AS expected
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'contacts'
  AND column_name = 'personal_id_ciphertext';

-- 8e) Storage documents tenant policies (migrace storage-documents-tenant-policies-2026-04-21)
SELECT
  'storage_documents_policy' AS check_name,
  COUNT(*) AS exists_count,
  'expected>=1' AS expected
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname ILIKE '%documents%';
