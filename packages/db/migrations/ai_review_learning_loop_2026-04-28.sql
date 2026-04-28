-- AI Review learning loop: auditovatelný event store, anonymizované patterny a eval cases.
-- Idempotentní; tenant izolace přes tenant_id + RLS policy na app.tenant_id.

BEGIN;

CREATE TABLE IF NOT EXISTS public.ai_review_correction_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  review_id uuid NOT NULL REFERENCES public.contract_upload_reviews(id) ON DELETE CASCADE,
  document_id uuid NULL REFERENCES public.documents(id) ON DELETE SET NULL,
  document_hash text NULL,
  extraction_run_id text NULL,
  institution_name text NULL,
  product_name text NULL,
  document_type text NULL,
  lifecycle_status text NULL,
  field_path text NOT NULL,
  field_label text NULL,
  original_value_json jsonb NULL,
  corrected_value_json jsonb NOT NULL,
  normalized_original_value text NULL,
  normalized_corrected_value text NULL,
  correction_type text NOT NULL,
  source_page integer NULL,
  evidence_snippet text NULL,
  prompt_version text NULL,
  schema_version text NULL,
  model_name text NULL,
  pipeline_version text NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_on_approval boolean NOT NULL DEFAULT false,
  accepted_at timestamptz NULL,
  rejected boolean NOT NULL DEFAULT false,
  rejected_reason text NULL,
  pii_level text NOT NULL DEFAULT 'contains_customer_data',
  CONSTRAINT ai_review_correction_events_type_check CHECK (
    correction_type IN (
      'missing_field_added',
      'wrong_value_replaced',
      'wrong_entity_mapping',
      'wrong_premium_aggregation',
      'wrong_document_classification',
      'wrong_publish_decision',
      'formatting_normalization',
      'manual_override'
    )
  ),
  CONSTRAINT ai_review_correction_events_pii_level_check CHECK (
    pii_level IN ('contains_customer_data', 'anonymized', 'aggregate_only')
  )
);

CREATE INDEX IF NOT EXISTS ai_review_correction_events_scope_idx
  ON public.ai_review_correction_events (tenant_id, institution_name, product_name, document_type);
CREATE INDEX IF NOT EXISTS ai_review_correction_events_field_idx
  ON public.ai_review_correction_events (tenant_id, field_path);
CREATE INDEX IF NOT EXISTS ai_review_correction_events_accepted_idx
  ON public.ai_review_correction_events (tenant_id, accepted_on_approval);
CREATE INDEX IF NOT EXISTS ai_review_correction_events_document_hash_idx
  ON public.ai_review_correction_events (document_hash);
CREATE INDEX IF NOT EXISTS ai_review_correction_events_review_idx
  ON public.ai_review_correction_events (review_id);

CREATE TABLE IF NOT EXISTS public.ai_review_learning_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  scope text NOT NULL,
  institution_name text NULL,
  product_name text NULL,
  document_type text NULL,
  field_path text NULL,
  pattern_type text NOT NULL,
  rule_text text NOT NULL,
  prompt_hint text NULL,
  validator_hint_json jsonb NULL,
  support_count integer NOT NULL DEFAULT 1,
  confidence numeric NOT NULL DEFAULT 0.5,
  severity text NOT NULL DEFAULT 'medium',
  enabled boolean NOT NULL DEFAULT true,
  source_correction_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NULL,
  CONSTRAINT ai_review_learning_patterns_scope_check CHECK (
    scope IN ('tenant', 'institution', 'product', 'document_type', 'global_safe')
  ),
  CONSTRAINT ai_review_learning_patterns_type_check CHECK (
    pattern_type IN (
      'extraction_hint',
      'validation_rule',
      'premium_aggregation_rule',
      'participant_detection_rule',
      'publish_decision_rule',
      'classification_hint',
      'field_alias'
    )
  )
);

CREATE INDEX IF NOT EXISTS ai_review_learning_patterns_lookup_idx
  ON public.ai_review_learning_patterns (tenant_id, scope, institution_name, product_name, document_type);
CREATE INDEX IF NOT EXISTS ai_review_learning_patterns_field_idx
  ON public.ai_review_learning_patterns (tenant_id, field_path);
CREATE INDEX IF NOT EXISTS ai_review_learning_patterns_enabled_idx
  ON public.ai_review_learning_patterns (tenant_id, enabled);

CREATE TABLE IF NOT EXISTS public.ai_review_eval_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  source_review_id uuid NULL REFERENCES public.contract_upload_reviews(id) ON DELETE SET NULL,
  source_correction_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  document_hash text NULL,
  anonymized_input_ref text NULL,
  institution_name text NULL,
  product_name text NULL,
  document_type text NULL,
  expected_output_json jsonb NOT NULL,
  critical_fields jsonb NOT NULL,
  pii_scrubbed boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_review_eval_cases_active_idx
  ON public.ai_review_eval_cases (tenant_id, active);
CREATE INDEX IF NOT EXISTS ai_review_eval_cases_review_idx
  ON public.ai_review_eval_cases (source_review_id);
CREATE INDEX IF NOT EXISTS ai_review_eval_cases_scope_idx
  ON public.ai_review_eval_cases (tenant_id, institution_name, product_name, document_type);

ALTER TABLE public.ai_review_correction_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_review_learning_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_review_eval_cases ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_review_correction_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ai_review_learning_patterns FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ai_review_eval_cases FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_review_correction_events_tenant_isolation ON public.ai_review_correction_events;
CREATE POLICY ai_review_correction_events_tenant_isolation ON public.ai_review_correction_events
  FOR ALL
  USING (
    NULLIF(current_setting('app.tenant_id', true), '') IS NOT NULL
    AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  )
  WITH CHECK (
    NULLIF(current_setting('app.tenant_id', true), '') IS NOT NULL
    AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

DROP POLICY IF EXISTS ai_review_learning_patterns_tenant_isolation ON public.ai_review_learning_patterns;
CREATE POLICY ai_review_learning_patterns_tenant_isolation ON public.ai_review_learning_patterns
  FOR ALL
  USING (
    NULLIF(current_setting('app.tenant_id', true), '') IS NOT NULL
    AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  )
  WITH CHECK (
    NULLIF(current_setting('app.tenant_id', true), '') IS NOT NULL
    AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

DROP POLICY IF EXISTS ai_review_eval_cases_tenant_isolation ON public.ai_review_eval_cases;
CREATE POLICY ai_review_eval_cases_tenant_isolation ON public.ai_review_eval_cases
  FOR ALL
  USING (
    NULLIF(current_setting('app.tenant_id', true), '') IS NOT NULL
    AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  )
  WITH CHECK (
    NULLIF(current_setting('app.tenant_id', true), '') IS NOT NULL
    AND tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_review_correction_events TO aidvisora_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_review_learning_patterns TO aidvisora_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_review_eval_cases TO aidvisora_app;

COMMIT;
