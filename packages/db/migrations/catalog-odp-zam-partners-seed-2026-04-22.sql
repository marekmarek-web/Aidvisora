-- Globální katalog: seed partnerů + produktů pro segment ODP_ZAM
-- (Pojištění odpovědnosti zaměstnance). Idempotentní, tenant_id IS NULL.
-- Datum: 22.04.2026
--
-- Souvisí s:
--   - packages/db/src/catalog.json (segment ODP_ZAM, 6 partnerů)
--   - packages/db/migrations/catalog-odp-zam-segment-2026-04-22.sql
--     (backfill contracts ODP → ODP_ZAM — tato migrace doplňuje chybějící katalog,
--      který doposud záležel výhradně na `pnpm run db:seed-catalog`).
--
-- Motivace: v portále poradce byl při volbě segmentu „Odpovědnost zaměstnance"
-- prázdný dropdown partnerů, protože DB neobsahovala žádný řádek v `partners`
-- s `segment = 'ODP_ZAM'`. Seed skript existoval, ale nebyl spuštěn na všech
-- prostředích. Tato migrace to opravuje idempotentním INSERT ... WHERE NOT EXISTS.
--
-- Bezpečnost: vkládá pouze globální (tenant_id IS NULL) záznamy; tenant
-- overrides zůstanou beze změny.

BEGIN;

-- Partneři (6× ODP_ZAM)
INSERT INTO partners (tenant_id, name, segment)
SELECT NULL, p.name, 'ODP_ZAM'
FROM (
  VALUES
    ('Allianz pojišťovna'),
    ('ČPP'),
    ('ČSOB pojišťovna'),
    ('Generali Česká pojišťovna'),
    ('Kooperativa'),
    ('UNIQA')
) AS p(name)
WHERE NOT EXISTS (
  SELECT 1 FROM partners
   WHERE tenant_id IS NULL
     AND name = p.name
     AND segment = 'ODP_ZAM'
);

-- Produkty per partner (1:1 podle catalog.json)
INSERT INTO products (partner_id, name, category, is_tbd)
SELECT r.id, pp.product_name, 'ODP_ZAM', FALSE
FROM partners r
JOIN (
  VALUES
    ('Allianz pojišťovna',       'Pojištění profesní odpovědnosti zaměstnance'),
    ('ČPP',                      'Pojištění odpovědnosti zaměstnance za škodu'),
    ('ČSOB pojišťovna',          'Pojištění odpovědnosti zaměstnance'),
    ('Generali Česká pojišťovna','Pojištění odpovědnosti zaměstnance'),
    ('Kooperativa',              'Pojištění odpovědnosti zaměstnance za škodu'),
    ('UNIQA',                    'Pojištění odpovědnosti zaměstnance')
) AS pp(partner_name, product_name)
  ON pp.partner_name = r.name
WHERE r.tenant_id IS NULL
  AND r.segment = 'ODP_ZAM'
  AND NOT EXISTS (
    SELECT 1 FROM products p
     WHERE p.partner_id = r.id
       AND p.name = pp.product_name
  );

-- Escape-hatch „Vlastní produkt (zadejte název)" pro všechny ODP_ZAM partnery.
INSERT INTO products (partner_id, name, category, is_tbd)
SELECT r.id, 'Vlastní produkt (zadejte název)', 'ODP_ZAM', FALSE
FROM partners r
WHERE r.tenant_id IS NULL
  AND r.segment = 'ODP_ZAM'
  AND NOT EXISTS (
    SELECT 1 FROM products p
     WHERE p.partner_id = r.id
       AND p.name = 'Vlastní produkt (zadejte název)'
  );

-- Sanity report.
DO $$
DECLARE
  v_partner_count int;
  v_product_count int;
BEGIN
  SELECT COUNT(*) INTO v_partner_count FROM partners
   WHERE tenant_id IS NULL AND segment = 'ODP_ZAM';
  SELECT COUNT(*) INTO v_product_count FROM products p
   JOIN partners r ON r.id = p.partner_id
   WHERE r.tenant_id IS NULL AND r.segment = 'ODP_ZAM';
  RAISE NOTICE 'ODP_ZAM globální seed: % partnerů, % produktů.', v_partner_count, v_product_count;
END $$;

COMMIT;
