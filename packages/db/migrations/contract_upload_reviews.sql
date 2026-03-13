-- Tabulka pro frontu smluv (review queue).
-- Když API vrací: relation "contract_upload_reviews" does not exist:
--   1. Otevři Supabase Dashboard → SQL Editor
--   2. Vlož tento soubor a spusť (Run)
-- Alternativa z repo: DATABASE_URL z .env.local nastav v shellu a spusť: pnpm db:migrate

CREATE TABLE IF NOT EXISTS "contract_upload_reviews" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "file_name" text NOT NULL,
  "storage_path" text NOT NULL,
  "mime_type" text,
  "size_bytes" bigint,
  "processing_status" text NOT NULL,
  "error_message" text,
  "extracted_payload" jsonb,
  "client_match_candidates" jsonb,
  "draft_actions" jsonb,
  "confidence" jsonb,
  "reasons_for_review" jsonb,
  "review_status" text DEFAULT 'pending',
  "uploaded_by" text,
  "reviewed_by" text,
  "reviewed_at" timestamp with time zone,
  "reject_reason" text,
  "applied_by" text,
  "applied_at" timestamp with time zone,
  "matched_client_id" uuid REFERENCES "public"."contacts"("id") ON DELETE SET NULL,
  "create_new_client_confirmed" text,
  "apply_result_payload" jsonb,
  "review_decision_reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
