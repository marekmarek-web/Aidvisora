-- Calculator runs (historie propočtů z kalkulaček) + household shared goals (JSONB).
-- Tenant RLS sjednoceno s aktuální konvencí (`app.tenant_id`).

BEGIN;

-- 1. calculator_runs ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS calculator_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  created_by text NOT NULL,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  calculator_type text NOT NULL,
  label text,
  inputs jsonb,
  outputs jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS calculator_runs_tenant_created_idx
  ON calculator_runs (tenant_id, created_by, created_at DESC);

CREATE INDEX IF NOT EXISTS calculator_runs_contact_idx
  ON calculator_runs (contact_id);

ALTER TABLE calculator_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE calculator_runs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS calculator_runs_tenant_select ON calculator_runs;
CREATE POLICY calculator_runs_tenant_select ON calculator_runs
  FOR SELECT
  USING (tenant_id IS NOT NULL AND tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid);

DROP POLICY IF EXISTS calculator_runs_tenant_insert ON calculator_runs;
CREATE POLICY calculator_runs_tenant_insert ON calculator_runs
  FOR INSERT
  WITH CHECK (tenant_id IS NOT NULL AND tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid);

DROP POLICY IF EXISTS calculator_runs_tenant_update ON calculator_runs;
CREATE POLICY calculator_runs_tenant_update ON calculator_runs
  FOR UPDATE
  USING (tenant_id IS NOT NULL AND tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid)
  WITH CHECK (tenant_id IS NOT NULL AND tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid);

DROP POLICY IF EXISTS calculator_runs_tenant_delete ON calculator_runs;
CREATE POLICY calculator_runs_tenant_delete ON calculator_runs
  FOR DELETE
  USING (tenant_id IS NOT NULL AND tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid);

-- 2. households.shared_goals -------------------------------------------------
ALTER TABLE households
  ADD COLUMN IF NOT EXISTS shared_goals jsonb;

COMMIT;
