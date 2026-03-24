-- Odkaz obchodu na finanční analýzu (sloupec v Drizzle schématu opportunities.fa_source_id).
-- Spusť v Supabase SQL editoru, pokud detail obchodu padá na „column fa_source_id does not exist“.

ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS fa_source_id uuid REFERENCES financial_analyses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_opportunities_fa_source_id ON opportunities (fa_source_id)
  WHERE fa_source_id IS NOT NULL;
