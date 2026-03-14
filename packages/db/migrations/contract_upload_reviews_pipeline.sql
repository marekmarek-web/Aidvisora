-- Contract understanding pipeline: new columns for extraction trace, diagnostics, and human corrections.
-- Run in Supabase SQL Editor or: pnpm db:migrate (if configured)

ALTER TABLE "contract_upload_reviews"
  ADD COLUMN IF NOT EXISTS "input_mode" text,
  ADD COLUMN IF NOT EXISTS "extraction_mode" text,
  ADD COLUMN IF NOT EXISTS "detected_document_type" text,
  ADD COLUMN IF NOT EXISTS "extraction_trace" jsonb,
  ADD COLUMN IF NOT EXISTS "validation_warnings" jsonb,
  ADD COLUMN IF NOT EXISTS "field_confidence_map" jsonb,
  ADD COLUMN IF NOT EXISTS "classification_reasons" jsonb,
  ADD COLUMN IF NOT EXISTS "original_extracted_payload" jsonb,
  ADD COLUMN IF NOT EXISTS "corrected_payload" jsonb,
  ADD COLUMN IF NOT EXISTS "corrected_fields" jsonb,
  ADD COLUMN IF NOT EXISTS "correction_reason" text,
  ADD COLUMN IF NOT EXISTS "corrected_by" text,
  ADD COLUMN IF NOT EXISTS "corrected_at" timestamp with time zone;
