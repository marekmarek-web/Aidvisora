-- F3 Slice 3: Partial unique index na contracts pro dedupe hardening.
-- Databázová pojistka proti duplicitním smlouvám se stejným číslem smlouvy a partnerem.
-- Pouze pro aktivní (nearchivované) záznamy s vyplněným contractNumber.
-- CONCURRENTLY = žádný lock na produkci; IF NOT EXISTS = idempotentní migrace.
--
-- Duplicate-safe preflight (spusť pro verifikaci před aplikací migrace):
-- SELECT contract_number, partner_name, tenant_id, COUNT(*)
--   FROM contracts
--  WHERE contract_number IS NOT NULL AND archived_at IS NULL
--  GROUP BY 1,2,3
--  HAVING COUNT(*) > 1;
--
-- Pokud vrátí řádky = existují duplikáty. Nutno dedupovat před přidáním indexu.

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS
  idx_contracts_tenant_number_partner
  ON contracts (tenant_id, contract_number, partner_name)
  WHERE contract_number IS NOT NULL
    AND archived_at IS NULL;
