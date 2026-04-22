-- ODP_ZAM segment introduction + backfill
-- Datum: 22.04.2026
-- Souvisí s: catalog.json v2026-04-22 (nový segment ODP_ZAM pro pojištění odpovědnosti zaměstnance)
--
-- Co migrace dělá:
--   1) Backfill contracts: kde segment='ODP' a product.name nebo partner_name obsahuje
--      'zaměstnanec' nebo 'zamestnanec' → přepne segment na 'ODP_ZAM'.
--   2) Stejný backfill v client_payment_setups.segment (pokud existuje).
--   3) Nové partnery/produkty ODP_ZAM (Allianz pojišťovna, ČPP, ČSOB pojišťovna,
--      Generali Česká pojišťovna, Kooperativa, UNIQA) doplní pnpm run db:seed-catalog.
--
-- Idempotentní — lze spustit opakovaně. V transakci.

BEGIN;

-- 1. Backfill contracts: ODP → ODP_ZAM podle product.name (join přes products)
--    nebo přes partner_name fallback na historické manuální smlouvy.
DO $$
DECLARE
  v_contracts_updated int;
  v_setups_updated int;
BEGIN
  -- Contracts přes product_id → products.name
  UPDATE contracts AS c
     SET segment = 'ODP_ZAM'
   WHERE c.segment = 'ODP'
     AND (
       EXISTS (
         SELECT 1 FROM products p
          WHERE p.id = c.product_id
            AND (p.name ILIKE '%zaměstnanec%' OR p.name ILIKE '%zamestnanec%')
       )
       OR (c.partner_name ILIKE '%zaměstnanec%' OR c.partner_name ILIKE '%zamestnanec%')
     );
  GET DIAGNOSTICS v_contracts_updated = ROW_COUNT;

  -- client_payment_setups, pokud tabulka existuje a má segment sloupec
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'client_payment_setups' AND column_name = 'segment'
  ) THEN
    EXECUTE $sql$
      UPDATE client_payment_setups
         SET segment = 'ODP_ZAM'
       WHERE segment = 'ODP'
         AND (
           product_name ILIKE '%zaměstnanec%'
           OR product_name ILIKE '%zamestnanec%'
           OR provider_name ILIKE '%zaměstnanec%'
           OR provider_name ILIKE '%zamestnanec%'
         )
    $sql$;
    GET DIAGNOSTICS v_setups_updated = ROW_COUNT;
  ELSE
    v_setups_updated := 0;
  END IF;

  RAISE NOTICE 'ODP_ZAM backfill report:';
  RAISE NOTICE '  • Contracts přepnuté ODP → ODP_ZAM: %', v_contracts_updated;
  RAISE NOTICE '  • client_payment_setups přepnuté ODP → ODP_ZAM: %', v_setups_updated;
  RAISE NOTICE 'Další krok: spustit pnpm run db:seed-catalog pro doplnění ODP_ZAM partnerů/produktů.';
END $$;

COMMIT;
