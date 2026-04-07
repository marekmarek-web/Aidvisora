-- AI Výpověď smlouvy – termination modul (tabulky + partial unique indexy)
-- Spusť celý skript v Supabase SQL Editoru (nebo psql). Vyžaduje existující tabulky:
--   contacts, contracts, documents, assistant_conversations
-- Idempotentní: IF NOT EXISTS u tabulek a indexů.

-- -----------------------------------------------------------------------------
-- Katalogy
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS insurer_termination_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  catalog_key TEXT NOT NULL,
  insurer_name TEXT NOT NULL,
  aliases JSONB,
  supported_segments JSONB,
  mailing_address JSONB,
  email TEXT,
  data_box TEXT,
  web_form_url TEXT,
  client_portal_url TEXT,
  freeform_letter_allowed BOOLEAN NOT NULL DEFAULT true,
  requires_official_form BOOLEAN NOT NULL DEFAULT false,
  official_form_name TEXT,
  official_form_storage_path TEXT,
  official_form_notes TEXT,
  allowed_channels JSONB,
  rule_overrides JSONB,
  attachment_rules JSONB,
  registry_needs_verification BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS termination_reason_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  reason_code TEXT NOT NULL,
  label_cs TEXT NOT NULL,
  supported_segments JSONB,
  default_date_computation TEXT NOT NULL,
  required_fields JSONB,
  attachment_required BOOLEAN NOT NULL DEFAULT false,
  always_review BOOLEAN NOT NULL DEFAULT false,
  instructions TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unikátnost pro globální řádky (tenant_id IS NULL) vs per-tenant
CREATE UNIQUE INDEX IF NOT EXISTS insurer_termination_registry_global_catalog_key_uq
  ON insurer_termination_registry (catalog_key)
  WHERE tenant_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS insurer_termination_registry_tenant_catalog_key_uq
  ON insurer_termination_registry (tenant_id, catalog_key)
  WHERE tenant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS termination_reason_catalog_global_reason_code_uq
  ON termination_reason_catalog (reason_code)
  WHERE tenant_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS termination_reason_catalog_tenant_reason_code_uq
  ON termination_reason_catalog (tenant_id, reason_code)
  WHERE tenant_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Workflow
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS termination_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
  source_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  source_conversation_id UUID REFERENCES assistant_conversations(id) ON DELETE SET NULL,
  advisor_id TEXT NOT NULL,
  insurer_name TEXT NOT NULL,
  insurer_registry_id UUID REFERENCES insurer_termination_registry(id) ON DELETE SET NULL,
  contract_number TEXT,
  product_segment TEXT,
  termination_mode TEXT NOT NULL,
  termination_reason_code TEXT NOT NULL,
  reason_catalog_id UUID REFERENCES termination_reason_catalog(id) ON DELETE SET NULL,
  requested_effective_date DATE,
  computed_effective_date DATE,
  contract_start_date DATE,
  contract_anniversary_date DATE,
  freeform_letter_allowed BOOLEAN,
  requires_insurer_form BOOLEAN,
  required_attachments JSONB,
  delivery_channel TEXT NOT NULL DEFAULT 'not_yet_set',
  delivery_address_snapshot JSONB,
  status TEXT NOT NULL DEFAULT 'draft',
  review_required_reason TEXT,
  confidence NUMERIC(5, 4),
  source_kind TEXT NOT NULL DEFAULT 'manual_intake',
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS termination_request_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  request_id UUID NOT NULL REFERENCES termination_requests(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB,
  actor_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS termination_required_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  request_id UUID NOT NULL REFERENCES termination_requests(id) ON DELETE CASCADE,
  requirement_code TEXT NOT NULL,
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'required',
  satisfied_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS termination_generated_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  request_id UUID NOT NULL REFERENCES termination_requests(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  version_label TEXT,
  is_current BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS termination_dispatch_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  request_id UUID NOT NULL REFERENCES termination_requests(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  carrier_or_provider TEXT,
  tracking_reference TEXT,
  payload JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Vyhledávání / reporty
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_termination_requests_tenant_status
  ON termination_requests (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_termination_requests_contract
  ON termination_requests (contract_id)
  WHERE contract_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_termination_request_events_request
  ON termination_request_events (request_id, created_at);

CREATE INDEX IF NOT EXISTS idx_termination_required_attachments_request
  ON termination_required_attachments (request_id);

CREATE INDEX IF NOT EXISTS idx_termination_generated_documents_request
  ON termination_generated_documents (request_id);

CREATE INDEX IF NOT EXISTS idx_termination_dispatch_log_request
  ON termination_dispatch_log (request_id, created_at);
