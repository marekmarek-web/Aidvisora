-- Tabulka pro Pokrytí produktů v kartě klienta (stav po položkách: hotovo / řeší se / nastavit).
-- Stejná struktura je v packages/db/src/apply-schema.ts (patchSql). Spusťte v Supabase SQL Editoru,
-- pokud nepoužíváte pnpm run db:apply-schema ani pnpm db:push.

CREATE TABLE IF NOT EXISTS contact_coverage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  segment_code text NOT NULL,
  status text NOT NULL,
  linked_contract_id uuid REFERENCES contracts(id) ON DELETE SET NULL,
  linked_opportunity_id uuid REFERENCES opportunities(id) ON DELETE SET NULL,
  notes text,
  is_relevant boolean DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  UNIQUE(tenant_id, contact_id, item_key)
);

-- Pokud aplikace stále hlásí chybu načítání: v Supabase je u nových tabulek často zapnuté RLS.
-- Přístup k tabulce má jen backend (server actions), takže RLS pro tento tabulku vypněte:
ALTER TABLE contact_coverage DISABLE ROW LEVEL SECURITY;

-- Sloupce pro vazbu na finanční analýzu (Drizzle schéma); u DB vytvořených ze starší migrace:
ALTER TABLE contact_coverage ADD COLUMN IF NOT EXISTS fa_analysis_id uuid REFERENCES financial_analyses(id) ON DELETE SET NULL;
ALTER TABLE contact_coverage ADD COLUMN IF NOT EXISTS fa_item_id uuid REFERENCES fa_plan_items(id) ON DELETE SET NULL;
