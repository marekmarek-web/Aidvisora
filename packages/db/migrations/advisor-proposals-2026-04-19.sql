-- Advisor proposals (Návrhy od poradce) — ruční návrhy úspor / modelací publikované klientovi do portálu.
-- Poradce vytvoří záznam v CRM, klient ho vidí ve své Klientské zóně. Není to AI doporučení.
-- Datum: 2026-04-19

BEGIN;

CREATE TABLE IF NOT EXISTS public.advisor_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  household_id uuid REFERENCES public.households(id) ON DELETE SET NULL,
  created_by text NOT NULL,
  segment text NOT NULL,
  -- povolené hodnoty: insurance_auto|insurance_property|insurance_life|mortgage|credit|investment|pension|other
  title text NOT NULL,
  summary text,
  current_annual_cost numeric(12,2),
  proposed_annual_cost numeric(12,2),
  savings_annual numeric(12,2) GENERATED ALWAYS AS (
    COALESCE(current_annual_cost, 0) - COALESCE(proposed_annual_cost, 0)
  ) STORED,
  currency text NOT NULL DEFAULT 'CZK',
  -- benefits: [{label:string, delta?:string}] — volitelný JSON seznam zlepšení
  benefits jsonb,
  valid_until date,
  status text NOT NULL DEFAULT 'draft',
  -- povolené: draft|published|viewed|accepted|declined|expired|withdrawn
  published_at timestamptz,
  first_viewed_at timestamptz,
  responded_at timestamptz,
  response_request_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
  source_calculator_run_id uuid REFERENCES public.calculator_runs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT advisor_proposals_status_chk CHECK (
    status IN ('draft','published','viewed','accepted','declined','expired','withdrawn')
  ),
  CONSTRAINT advisor_proposals_segment_chk CHECK (
    segment IN ('insurance_auto','insurance_property','insurance_life','mortgage','credit','investment','pension','other')
  )
);

CREATE INDEX IF NOT EXISTS advisor_proposals_tenant_contact_status_idx
  ON public.advisor_proposals (tenant_id, contact_id, status);
CREATE INDEX IF NOT EXISTS advisor_proposals_tenant_status_validity_idx
  ON public.advisor_proposals (tenant_id, status, valid_until);
CREATE INDEX IF NOT EXISTS advisor_proposals_contact_published_idx
  ON public.advisor_proposals (contact_id, published_at DESC);

-- ==========================================================================
-- RLS: tenant scope (poradce) + participant scope (klient přes client_contacts)
-- ==========================================================================
ALTER TABLE public.advisor_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisor_proposals FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS advisor_proposals_tenant_select ON public.advisor_proposals;
DROP POLICY IF EXISTS advisor_proposals_tenant_insert ON public.advisor_proposals;
DROP POLICY IF EXISTS advisor_proposals_tenant_update ON public.advisor_proposals;
DROP POLICY IF EXISTS advisor_proposals_tenant_delete ON public.advisor_proposals;
DROP POLICY IF EXISTS advisor_proposals_client_select ON public.advisor_proposals;
DROP POLICY IF EXISTS advisor_proposals_client_update ON public.advisor_proposals;

-- Poradce: přístup v rámci svého tenantu přes GUC app.tenant_id
CREATE POLICY advisor_proposals_tenant_select ON public.advisor_proposals
  FOR SELECT TO authenticated, aidvisora_app
  USING (tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid);

CREATE POLICY advisor_proposals_tenant_insert ON public.advisor_proposals
  FOR INSERT TO authenticated, aidvisora_app
  WITH CHECK (tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid);

CREATE POLICY advisor_proposals_tenant_update ON public.advisor_proposals
  FOR UPDATE TO authenticated, aidvisora_app
  USING (tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid)
  WITH CHECK (tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid);

CREATE POLICY advisor_proposals_tenant_delete ON public.advisor_proposals
  FOR DELETE TO authenticated, aidvisora_app
  USING (tenant_id = (SELECT current_setting('app.tenant_id', true))::uuid);

-- Klient: vidí jen publikované/historické návrhy pro svůj kontakt (nezveřejněné drafty nikdy nevidí)
CREATE POLICY advisor_proposals_client_select ON public.advisor_proposals
  FOR SELECT TO authenticated
  USING (
    status IN ('published','viewed','accepted','declined','expired')
    AND contact_id IN (
      SELECT cc.contact_id FROM public.client_contacts cc
      WHERE cc.user_id = (SELECT auth.uid()::text)
    )
  );

-- Klient: může updatovat jen status/viewed/accepted/declined u publikovaných pro svůj kontakt
-- (server action validuje přesný přechod; RLS je další vrstva).
CREATE POLICY advisor_proposals_client_update ON public.advisor_proposals
  FOR UPDATE TO authenticated
  USING (
    status IN ('published','viewed','accepted','declined')
    AND contact_id IN (
      SELECT cc.contact_id FROM public.client_contacts cc
      WHERE cc.user_id = (SELECT auth.uid()::text)
    )
  )
  WITH CHECK (
    status IN ('published','viewed','accepted','declined')
    AND contact_id IN (
      SELECT cc.contact_id FROM public.client_contacts cc
      WHERE cc.user_id = (SELECT auth.uid()::text)
    )
  );

-- updated_at trigger (best-effort, pokud helper existuje)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS advisor_proposals_set_updated_at ON public.advisor_proposals';
    EXECUTE 'CREATE TRIGGER advisor_proposals_set_updated_at ' ||
            'BEFORE UPDATE ON public.advisor_proposals ' ||
            'FOR EACH ROW EXECUTE FUNCTION set_updated_at()';
  END IF;
END $$;

COMMIT;
