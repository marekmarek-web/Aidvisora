-- WS-2 Batch 5 / M5b + M5c — Column-level PII encryption (dual-column, application-side)
-- Datum: 2026-04-21
--
-- Kontext:
--   Snapshot `docs/security/rls-production-snapshot-2026-04-19.md` prokázal, že Supabase
--   pgsodium TCE je deprecated a na projektu není nainstalován, Supabase Vault 0.3.1
--   umí pouze secret storage (ne sloupcovou šifru). Jdeme tedy aplikační cestou:
--   AES-256-GCM v Node runtime (`apps/web/src/lib/pii/encrypt.ts`), klíč v env / KMS.
--
-- Tato migrace přidává dva páry sloupců na `public.contacts`:
--   - `personal_id_enc text`          — AES-256-GCM envelope (v1.keyId.iv.ct.tag)
--   - `personal_id_fingerprint text`  — HMAC-SHA256 fingerprint (base64url, 43 znaků)
--   - `id_card_number_enc text`
--   - `id_card_number_fingerprint text`
--
-- Pravidla během dual-read fáze:
--   - Nové zápisy: application writer (contacts.ts upsert) plní PLAINTEXT sloupec
--     (stávající kontrakt) i _enc/_fingerprint páry. Plaintext zůstává dokud neproběhne
--     backfill + drop plaintextu v další migraci.
--   - Čtení: primární zdroj je `_enc` sloupec (po decrypt). Pokud je `_enc` NULL, fallback
--     na plaintext. Po úplném backfillu se přepne na `_enc`-only a drop plaintext sloupců.
--   - Lookup (equality search): `personal_id_fingerprint = fingerprintPii(input)` — unique
--     kontext vyžaduje per-tenant unique constraint (níže v indexech).
--
-- Backfill:
--   Není součástí této migrace. Pro backfill existujících řádků spusť z Node runtime
--   (server action) skript `scripts/security/backfill-contacts-pii.ts` (not created yet).
--   SQL cesta backfillu nejde — šifrovací klíč v DB nedržíme.
--
-- Idempotentní. Neobsahuje žádné DROP plaintext sloupců (ty přijdou v pozdější migraci
-- po přechodu na `_enc`-only čtení).

BEGIN;

-- =============================================================================
-- M5b — personal_id
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'personal_id_enc'
  ) THEN
    ALTER TABLE public.contacts
      ADD COLUMN personal_id_enc text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'personal_id_fingerprint'
  ) THEN
    ALTER TABLE public.contacts
      ADD COLUMN personal_id_fingerprint text;
  END IF;
END $$;

-- Index pro equality lookup podle fingerprint v rámci tenantu.
-- (Globální unique by blokoval legitimní případ "ten samý RČ u různých tenantů".)
CREATE INDEX IF NOT EXISTS contacts_personal_id_fingerprint_tenant_idx
  ON public.contacts (tenant_id, personal_id_fingerprint)
  WHERE personal_id_fingerprint IS NOT NULL;

COMMENT ON COLUMN public.contacts.personal_id_enc IS
  'AES-256-GCM envelope (apps/web/src/lib/pii/encrypt.ts). AAD=''contact:personal_id''. WS-2 Batch 5.';
COMMENT ON COLUMN public.contacts.personal_id_fingerprint IS
  'HMAC-SHA256 fingerprint (base64url, 43 znaků). Pouze pro equality lookup, nelze z něj odvodit RČ. WS-2 Batch 5.';

-- =============================================================================
-- M5c — id_card_number
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'id_card_number_enc'
  ) THEN
    ALTER TABLE public.contacts
      ADD COLUMN id_card_number_enc text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'id_card_number_fingerprint'
  ) THEN
    ALTER TABLE public.contacts
      ADD COLUMN id_card_number_fingerprint text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS contacts_id_card_number_fingerprint_tenant_idx
  ON public.contacts (tenant_id, id_card_number_fingerprint)
  WHERE id_card_number_fingerprint IS NOT NULL;

COMMENT ON COLUMN public.contacts.id_card_number_enc IS
  'AES-256-GCM envelope (apps/web/src/lib/pii/encrypt.ts). AAD=''contact:id_card_number''. WS-2 Batch 5.';
COMMENT ON COLUMN public.contacts.id_card_number_fingerprint IS
  'HMAC-SHA256 fingerprint (base64url, 43 znaků). Pouze pro equality lookup. WS-2 Batch 5.';

-- =============================================================================
-- Verifikace
-- =============================================================================
DO $$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(col, ', ')
    INTO missing
  FROM (
    VALUES
      ('personal_id_enc'),
      ('personal_id_fingerprint'),
      ('id_card_number_enc'),
      ('id_card_number_fingerprint')
  ) AS expected(col)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = expected.col
  );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'M5b/M5c: chybí sloupce: %', missing;
  END IF;
END $$;

COMMIT;

-- =============================================================================
-- POST-DEPLOY kroky (mimo SQL):
-- =============================================================================
-- 1. V prostředí (Vercel Production / Staging):
--      PII_ENCRYPTION_KEY_ID=k1
--      PII_ENCRYPTION_KEY_BASE64=<base64 32 bajtů: `openssl rand -base64 32`>
--      PII_FINGERPRINT_KEY_BASE64=<base64 min. 32 bajtů>
--    Volitelně pro rotaci:
--      PII_ENCRYPTION_KEYS=k0:<base64>,k1:<base64>
-- 2. Ověřit self-test v shelly:
--      node -e "require('./apps/web/src/lib/pii/encrypt').__pii_self_test()"
-- 3. Backfill: po deployi spustit interně (server-only) skript, který pro všechny
--    contacts s ne-null `personal_id` / `id_card_number` naplní _enc + _fingerprint.
--    Script patří do `scripts/security/backfill-contacts-pii.ts` (follow-up task).
-- 4. Dual-read fáze: aplikace čte `_enc` → fallback plaintext dokud není 100% backfill.
-- 5. V samostatné migraci (po stabilizaci) dropnout plaintext sloupce.
