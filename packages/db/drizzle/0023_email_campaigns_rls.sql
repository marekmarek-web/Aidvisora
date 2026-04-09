-- Row level security pro přímý přístup přes Supabase (PostgREST).
-- Aplikace přes server actions používá připojení s oprávněním mimo RLS podle nasazení.

ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaign_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_campaigns_membership ON email_campaigns;
CREATE POLICY email_campaigns_membership ON email_campaigns
  FOR ALL
  TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM memberships WHERE user_id = (auth.uid())::text)
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM memberships WHERE user_id = (auth.uid())::text)
  );

DROP POLICY IF EXISTS email_campaign_recipients_membership ON email_campaign_recipients;
CREATE POLICY email_campaign_recipients_membership ON email_campaign_recipients
  FOR ALL
  TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM memberships WHERE user_id = (auth.uid())::text)
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM memberships WHERE user_id = (auth.uid())::text)
  );
