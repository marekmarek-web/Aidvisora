-- Document review redesign persistence patch (idempotent).
-- Run in Supabase SQL Editor for production hotfix if drizzle migrate is not available.

ALTER TABLE public.contract_upload_reviews
  ADD COLUMN IF NOT EXISTS detected_document_subtype text,
  ADD COLUMN IF NOT EXISTS lifecycle_status text,
  ADD COLUMN IF NOT EXISTS data_completeness jsonb,
  ADD COLUMN IF NOT EXISTS sensitivity_profile text,
  ADD COLUMN IF NOT EXISTS corrected_document_type text,
  ADD COLUMN IF NOT EXISTS corrected_lifecycle_status text,
  ADD COLUMN IF NOT EXISTS field_marked_not_applicable jsonb,
  ADD COLUMN IF NOT EXISTS linked_client_override uuid,
  ADD COLUMN IF NOT EXISTS linked_deal_override uuid,
  ADD COLUMN IF NOT EXISTS confidence_override jsonb,
  ADD COLUMN IF NOT EXISTS ignored_warnings jsonb;

CREATE TABLE IF NOT EXISTS public.contract_review_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid NOT NULL,
  contract_review_id uuid NOT NULL,
  corrected_document_type text,
  corrected_lifecycle_status text,
  corrected_field_values jsonb,
  field_marked_not_applicable jsonb,
  linked_client_override uuid,
  linked_deal_override uuid,
  confidence_override jsonb,
  ignored_warnings jsonb,
  corrected_by text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'contract_review_corrections_contract_review_id_fk'
  ) THEN
    ALTER TABLE public.contract_review_corrections
      ADD CONSTRAINT contract_review_corrections_contract_review_id_fk
      FOREIGN KEY (contract_review_id)
      REFERENCES public.contract_upload_reviews(id)
      ON DELETE CASCADE;
  END IF;
END $$;

