-- Plan 4: correction learning — store structured diff on correction rows
ALTER TABLE contract_review_corrections
  ADD COLUMN IF NOT EXISTS comparison_delta jsonb;
