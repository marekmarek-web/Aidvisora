-- Email Campaigns v2 — RLS policies
--
-- Konvence (viz 0023_email_campaigns_rls.sql):
--   tenant_id IN (SELECT tenant_id FROM memberships WHERE user_id = auth.uid()::text)
--
-- Server actions se připojují přes service role a používají `withTenantContext*`,
-- takže RLS je druhá obrana (defense in depth) proti přímému PostgREST přístupu.

-- ─── email_templates ─────────────────────────────────────────────────────────
-- Globální šablony (tenant_id IS NULL) jsou čitelné všem authenticated uživatelům.
-- Per-tenant šablony jen členům daného tenantu.
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_templates_read ON email_templates;
CREATE POLICY email_templates_read ON email_templates
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IS NULL
    OR tenant_id IN (SELECT tenant_id FROM memberships WHERE user_id = (auth.uid())::text)
  );

DROP POLICY IF EXISTS email_templates_write ON email_templates;
CREATE POLICY email_templates_write ON email_templates
  FOR ALL
  TO authenticated
  USING (
    tenant_id IS NOT NULL
    AND tenant_id IN (SELECT tenant_id FROM memberships WHERE user_id = (auth.uid())::text)
  )
  WITH CHECK (
    tenant_id IS NOT NULL
    AND tenant_id IN (SELECT tenant_id FROM memberships WHERE user_id = (auth.uid())::text)
  );

-- ─── email_campaign_events ───────────────────────────────────────────────────
ALTER TABLE email_campaign_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_campaign_events_membership ON email_campaign_events;
CREATE POLICY email_campaign_events_membership ON email_campaign_events
  FOR ALL
  TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM memberships WHERE user_id = (auth.uid())::text)
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM memberships WHERE user_id = (auth.uid())::text)
  );

-- ─── email_send_queue ────────────────────────────────────────────────────────
ALTER TABLE email_send_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_send_queue_membership ON email_send_queue;
CREATE POLICY email_send_queue_membership ON email_send_queue
  FOR ALL
  TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM memberships WHERE user_id = (auth.uid())::text)
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM memberships WHERE user_id = (auth.uid())::text)
  );

-- ─── email_automation_rules ──────────────────────────────────────────────────
ALTER TABLE email_automation_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_automation_rules_membership ON email_automation_rules;
CREATE POLICY email_automation_rules_membership ON email_automation_rules
  FOR ALL
  TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM memberships WHERE user_id = (auth.uid())::text)
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM memberships WHERE user_id = (auth.uid())::text)
  );

-- ─── email_automation_runs ───────────────────────────────────────────────────
ALTER TABLE email_automation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_automation_runs_membership ON email_automation_runs;
CREATE POLICY email_automation_runs_membership ON email_automation_runs
  FOR ALL
  TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM memberships WHERE user_id = (auth.uid())::text)
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM memberships WHERE user_id = (auth.uid())::text)
  );

-- ─── email_content_sources ───────────────────────────────────────────────────
ALTER TABLE email_content_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_content_sources_membership ON email_content_sources;
CREATE POLICY email_content_sources_membership ON email_content_sources
  FOR ALL
  TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM memberships WHERE user_id = (auth.uid())::text)
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM memberships WHERE user_id = (auth.uid())::text)
  );

-- ─── referral_requests ───────────────────────────────────────────────────────
ALTER TABLE referral_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS referral_requests_membership ON referral_requests;
CREATE POLICY referral_requests_membership ON referral_requests
  FOR ALL
  TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM memberships WHERE user_id = (auth.uid())::text)
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM memberships WHERE user_id = (auth.uid())::text)
  );
