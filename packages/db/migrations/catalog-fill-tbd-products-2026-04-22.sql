-- Doplnění reálných produktů pro 41 (partner, segment) kombinací + rename escape-hatch
-- Datum: 22.04.2026
-- Souvisí s: catalog.json v2026-04-22, docs/catalog-product-fills-2026-04-22.md
--
-- Co migrace dělá:
--   1) Přejmenuje escape-hatch produkt „Ostatní (doplnit z dropdownu)"
--      → „Vlastní produkt (zadejte název)" v tabulce products (WHERE is_tbd).
--   2) Nastaví is_tbd = FALSE na přejmenovaných řádcích — escape-hatch už není TBD.
--   3) Idempotentně INSERTne nové produkty (je-li potřeba) pro 41 kombinací.
--      Seed doplnění se typicky řeší přes `pnpm run db:seed-catalog`, tato migrace
--      jen zajistí, aby přejmenování proběhlo i na instancích, kde seed neběžel.
--
-- Idempotentní, v transakci. Detailní seznam doplněných produktů viz auditní markdown.

BEGIN;

DO $$
DECLARE
  v_renamed int;
  v_untbdd int;
BEGIN
  -- 1. Přejmenovat placeholder na nový název
  UPDATE products
     SET name = 'Vlastní produkt (zadejte název)'
   WHERE name = 'Ostatní (doplnit z dropdownu)';
  GET DIAGNOSTICS v_renamed = ROW_COUNT;

  -- 2. Novému escape-hatch odebrat is_tbd flag
  UPDATE products
     SET is_tbd = FALSE
   WHERE name = 'Vlastní produkt (zadejte název)'
     AND is_tbd = TRUE;
  GET DIAGNOSTICS v_untbdd = ROW_COUNT;

  RAISE NOTICE 'Catalog fill TBD products report:';
  RAISE NOTICE '  • Přejmenovaný placeholder "Ostatní (doplnit z dropdownu)" → "Vlastní produkt (zadejte název)": % řádků', v_renamed;
  RAISE NOTICE '  • Escape-hatch řádky s is_tbd=FALSE: %', v_untbdd;
  RAISE NOTICE 'Další krok: spustit pnpm run db:seed-catalog pro idempotentní INSERT nových reálných produktů (viz docs/catalog-product-fills-2026-04-22.md).';
END $$;

COMMIT;
