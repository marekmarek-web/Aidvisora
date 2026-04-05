-- Fondová knihovna: poradce (advisor_preferences) + požadavky na nové fondy
--
-- Pořadí: na prázdné DB spusťte tento soubor jako první pro fondovou knihovnu.
-- Volitelně poté `fund_library_z_status_normalize_2026-04-07.sql` (jen duplicitní UPDATE, idempotentní).
--
ALTER TABLE advisor_preferences ADD COLUMN IF NOT EXISTS fund_library jsonb;

CREATE TABLE IF NOT EXISTS fund_add_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  fund_name text NOT NULL,
  provider text,
  isin_or_ticker text,
  factsheet_url text,
  category text,
  note text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fund_add_requests_tenant_created_idx
  ON fund_add_requests (tenant_id, created_at DESC);

-- Normalizace starších stavů fronty (idempotentní; na nové tabulce nic nezmění)
UPDATE fund_add_requests SET status = 'in_progress' WHERE status IN ('under_review', 'need_info');
UPDATE fund_add_requests SET status = 'added' WHERE status = 'approved';
UPDATE fund_add_requests SET status = 'new' WHERE status NOT IN ('new', 'in_progress', 'added', 'rejected');
