-- Plan 3 §9 — structured payment setups from AI / advisor for client portal

CREATE TABLE IF NOT EXISTS client_payment_setups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  source_contract_review_id uuid REFERENCES contract_upload_reviews(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft',
  payment_type text NOT NULL DEFAULT 'other',
  provider_name text,
  product_name text,
  contract_number text,
  beneficiary_name text,
  account_number text,
  bank_code text,
  iban text,
  bic text,
  variable_symbol text,
  specific_symbol text,
  constant_symbol text,
  amount numeric(14, 2),
  currency text,
  frequency text,
  first_payment_date text,
  due_day_of_month integer,
  payment_instructions_text text,
  confidence numeric(4, 3),
  needs_human_review boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_payment_setups_tenant_contact_idx
  ON client_payment_setups (tenant_id, contact_id);

CREATE INDEX IF NOT EXISTS client_payment_setups_review_idx
  ON client_payment_setups (source_contract_review_id);
