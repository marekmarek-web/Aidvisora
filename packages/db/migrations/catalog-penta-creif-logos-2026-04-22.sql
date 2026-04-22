-- Catalog: doplnění Penta Investments (INV) a zajištění log pro CREIF (DRFG) / Efekta
-- Datum: 22.04.2026
-- Souvisí s:
--   - packages/db/src/catalog.json (přidán partner "Penta Investments" v segmentu INV
--     s produkty "Penta Equity Fund SICAV" a "Penta Real Estate Fund SICAV")
--   - apps/web/src/lib/institutions/institution-logo.ts (přidány klíčová slova
--     creif / drfg / efekta / czech real estate fund → /logos/creif.png)
--
-- Co migrace dělá:
--   Pouze dokumentuje změnu katalogu. Skutečné doplnění partnerů/produktů do DB
--   provádí idempotentní seed `pnpm run db:seed-catalog`, který načte catalog.json
--   a vloží nové globální (tenant_id IS NULL) záznamy bez duplicit.
--
-- Idempotentní no-op migrace; lze spustit opakovaně.

BEGIN;

-- Sanity: pokud partner existuje, zkontrolujeme přítomnost produktů (log-only).
DO $$
DECLARE
  v_partner_id uuid;
BEGIN
  SELECT id INTO v_partner_id
    FROM partners
   WHERE tenant_id IS NULL
     AND name = 'Penta Investments'
     AND segment = 'INV'
   LIMIT 1;

  IF v_partner_id IS NULL THEN
    RAISE NOTICE 'Penta Investments (INV) zatím není v DB — spusť `pnpm run db:seed-catalog`.';
  ELSE
    RAISE NOTICE 'Penta Investments (INV) partner_id=%', v_partner_id;
  END IF;
END $$;

COMMIT;
