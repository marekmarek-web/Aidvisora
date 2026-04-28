-- AI Review: advisor-declared modelation intent + audit-friendly correction events.
-- Safe/aditive: legacy review rows without user_declared_document_intent are treated in app code as final contracts.

ALTER TABLE public.contract_upload_reviews
  ADD COLUMN IF NOT EXISTS user_declared_document_intent jsonb;

ALTER TABLE public.contract_review_corrections
  ADD COLUMN IF NOT EXISTS field_path text,
  ADD COLUMN IF NOT EXISTS original_value jsonb,
  ADD COLUMN IF NOT EXISTS corrected_value jsonb,
  ADD COLUMN IF NOT EXISTS document_type text,
  ADD COLUMN IF NOT EXISTS institution text,
  ADD COLUMN IF NOT EXISTS product_name text,
  ADD COLUMN IF NOT EXISTS extraction_prompt_version text,
  ADD COLUMN IF NOT EXISTS model_name text,
  ADD COLUMN IF NOT EXISTS accepted_on_approval text DEFAULT 'false',
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_contract_review_corrections_tenant_lookup
  ON public.contract_review_corrections (tenant_id, institution, product_name, document_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contract_review_corrections_review_field
  ON public.contract_review_corrections (contract_review_id, field_path);
