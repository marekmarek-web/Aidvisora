-- Email Campaigns v2 (F1-F6 platform foundations)
-- Viz docs/EMAIL_CAMPAIGNS_STATUS.md a .cursor/plans/komplexní_email_kampaně_platforma_*.plan.md
--
-- Tato migrace:
--  1) rozšíří email_campaigns a email_campaign_recipients o nová pole (scheduling, tracking, A/B, template vazba, preheader, from_name override)
--  2) vytvoří nové tabulky: email_templates, email_campaign_events, email_send_queue,
--     email_automation_rules, email_automation_runs, email_content_sources, referral_requests
--  3) seedne globální šablony (tenant_id IS NULL) z původního CAMPAIGN_TEMPLATES

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) email_campaigns — rozšíření
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE email_campaigns
  ADD COLUMN IF NOT EXISTS segment_id         text,
  ADD COLUMN IF NOT EXISTS segment_filter     jsonb,
  ADD COLUMN IF NOT EXISTS template_id        uuid,
  ADD COLUMN IF NOT EXISTS scheduled_at       timestamptz,
  ADD COLUMN IF NOT EXISTS from_name_override text,
  ADD COLUMN IF NOT EXISTS tracking_enabled   boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS parent_campaign_id uuid,
  ADD COLUMN IF NOT EXISTS automation_rule_id uuid,
  ADD COLUMN IF NOT EXISTS preheader          text,
  ADD COLUMN IF NOT EXISTS ab_variant         text, -- 'a' | 'b' | null
  ADD COLUMN IF NOT EXISTS ab_winner_at       timestamptz,
  ADD COLUMN IF NOT EXISTS recipient_count    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS queued_at          timestamptz;

-- Přidej enum-free CHECK pro status: draft|queued|scheduled|sending|sent|failed|cancelled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_campaigns_status_check'
  ) THEN
    ALTER TABLE email_campaigns
      ADD CONSTRAINT email_campaigns_status_check
      CHECK (status IN ('draft', 'scheduled', 'queued', 'sending', 'sent', 'failed', 'cancelled'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS email_campaigns_scheduled_at_idx
  ON email_campaigns (scheduled_at)
  WHERE scheduled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS email_campaigns_parent_idx
  ON email_campaigns (parent_campaign_id)
  WHERE parent_campaign_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS email_campaigns_automation_rule_idx
  ON email_campaigns (automation_rule_id)
  WHERE automation_rule_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) email_campaign_recipients — rozšíření (tracking)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE email_campaign_recipients
  ADD COLUMN IF NOT EXISTS tracking_token   text,
  ADD COLUMN IF NOT EXISTS opened_at        timestamptz,
  ADD COLUMN IF NOT EXISTS first_click_at   timestamptz,
  ADD COLUMN IF NOT EXISTS click_count      integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bounced_at       timestamptz,
  ADD COLUMN IF NOT EXISTS bounce_type      text,
  ADD COLUMN IF NOT EXISTS complaint_at     timestamptz,
  ADD COLUMN IF NOT EXISTS unsubscribed_at  timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at     timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS email_campaign_recipients_token_uidx
  ON email_campaign_recipients (tracking_token)
  WHERE tracking_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS email_campaign_recipients_provider_message_idx
  ON email_campaign_recipients (provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS email_campaign_recipients_contact_idx
  ON email_campaign_recipients (tenant_id, contact_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) email_templates — per-tenant + globální (tenant_id IS NULL = globální)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid REFERENCES tenants(id) ON DELETE CASCADE, -- NULL = globální
  name          text NOT NULL,
  kind          text NOT NULL, -- 'blank' | 'birthday' | 'newsletter' | 'consultation' | 'year_in_review' | 'referral_ask' | 'custom'
  category      text,
  subject       text NOT NULL,
  preheader     text,
  body_html     text NOT NULL,
  thumbnail_url text,
  merge_fields  text[] NOT NULL DEFAULT ARRAY[]::text[],
  icon_name     text,
  accent_class  text,
  style_key     text,
  description   text,
  compliance_note text,
  is_archived   boolean NOT NULL DEFAULT false,
  is_system     boolean NOT NULL DEFAULT false, -- systémová (auto-gen) šablona
  sort_order    integer NOT NULL DEFAULT 0,
  created_by_user_id text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_templates_tenant_idx ON email_templates (tenant_id);
CREATE INDEX IF NOT EXISTS email_templates_kind_idx ON email_templates (kind);
CREATE INDEX IF NOT EXISTS email_templates_active_idx ON email_templates (tenant_id, is_archived, sort_order);

-- FK z email_campaigns.template_id (až po vytvoření tabulky)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_campaigns_template_id_fkey'
  ) THEN
    ALTER TABLE email_campaigns
      ADD CONSTRAINT email_campaigns_template_id_fkey
      FOREIGN KEY (template_id) REFERENCES email_templates(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) email_campaign_events — append-only tracking events
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_campaign_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id  uuid NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES email_campaign_recipients(id) ON DELETE CASCADE,
  event_type   text NOT NULL, -- 'queued'|'sent'|'delivered'|'opened'|'clicked'|'bounced'|'complained'|'unsubscribed'|'failed'
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  ip_address   text,
  user_agent   text,
  url          text,      -- pro 'clicked'
  metadata     jsonb
);

CREATE INDEX IF NOT EXISTS email_campaign_events_campaign_idx
  ON email_campaign_events (campaign_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS email_campaign_events_recipient_idx
  ON email_campaign_events (recipient_id, event_type);
CREATE INDEX IF NOT EXISTS email_campaign_events_tenant_type_idx
  ON email_campaign_events (tenant_id, event_type);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) email_send_queue — asynchronní send worker (F2)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_send_queue (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id      uuid NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  recipient_id     uuid NOT NULL REFERENCES email_campaign_recipients(id) ON DELETE CASCADE,
  scheduled_for    timestamptz NOT NULL DEFAULT now(),
  attempts         integer NOT NULL DEFAULT 0,
  max_attempts     integer NOT NULL DEFAULT 3,
  next_attempt_at  timestamptz NOT NULL DEFAULT now(),
  status           text NOT NULL DEFAULT 'pending', -- pending|processing|sent|failed|cancelled
  locked_at        timestamptz,
  locked_by        text,
  last_error       text,
  payload          jsonb NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_send_queue_due_idx
  ON email_send_queue (status, next_attempt_at)
  WHERE status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS email_send_queue_campaign_idx
  ON email_send_queue (campaign_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6) email_automation_rules + runs (F4)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_automation_rules (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by_user_id  text NOT NULL,
  name                text NOT NULL,
  description         text,
  trigger_type        text NOT NULL, -- 'birthday'|'service_due'|'contract_anniversary'|'proposal_accepted'|'contract_activated'|'analysis_completed'|'inactive_client'|'referral_ask_after_proposal'|'year_in_review'
  trigger_config      jsonb NOT NULL DEFAULT '{}'::jsonb,
  segment_filter      jsonb,
  template_id         uuid REFERENCES email_templates(id) ON DELETE SET NULL,
  schedule_offset_days integer NOT NULL DEFAULT 0, -- +/- days relative to trigger event
  send_hour           integer NOT NULL DEFAULT 9,  -- hour of day (0-23)
  is_active           boolean NOT NULL DEFAULT false,
  last_run_at         timestamptz,
  last_matched_count  integer NOT NULL DEFAULT 0,
  stats               jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_automation_rules_tenant_idx
  ON email_automation_rules (tenant_id);
CREATE INDEX IF NOT EXISTS email_automation_rules_active_idx
  ON email_automation_rules (is_active, trigger_type)
  WHERE is_active = true;

CREATE TABLE IF NOT EXISTS email_automation_runs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rule_id      uuid NOT NULL REFERENCES email_automation_rules(id) ON DELETE CASCADE,
  contact_id   uuid REFERENCES contacts(id) ON DELETE CASCADE,
  campaign_id  uuid REFERENCES email_campaigns(id) ON DELETE SET NULL,
  run_at       timestamptz NOT NULL DEFAULT now(),
  status       text NOT NULL, -- 'queued'|'sent'|'skipped'|'failed'
  skip_reason  text,
  metadata     jsonb
);

CREATE INDEX IF NOT EXISTS email_automation_runs_rule_idx
  ON email_automation_runs (rule_id, run_at DESC);
CREATE INDEX IF NOT EXISTS email_automation_runs_contact_idx
  ON email_automation_runs (contact_id, rule_id, run_at DESC);

-- FK z email_campaigns.automation_rule_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_campaigns_automation_rule_id_fkey'
  ) THEN
    ALTER TABLE email_campaigns
      ADD CONSTRAINT email_campaigns_automation_rule_id_fkey
      FOREIGN KEY (automation_rule_id) REFERENCES email_automation_rules(id) ON DELETE SET NULL;
  END IF;
END $$;

-- FK parent_campaign_id (self-ref pro A/B testing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_campaigns_parent_campaign_id_fkey'
  ) THEN
    ALTER TABLE email_campaigns
      ADD CONSTRAINT email_campaigns_parent_campaign_id_fkey
      FOREIGN KEY (parent_campaign_id) REFERENCES email_campaigns(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7) email_content_sources (F6 — manual article curation)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_content_sources (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  url           text NOT NULL,
  canonical_url text,
  title         text,
  description   text,
  image_url     text,
  source_name   text,
  is_evergreen  boolean NOT NULL DEFAULT false,
  captured_by   text,
  captured_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at  timestamptz,
  tags          text[] NOT NULL DEFAULT ARRAY[]::text[],
  metadata      jsonb
);

CREATE INDEX IF NOT EXISTS email_content_sources_tenant_idx
  ON email_content_sources (tenant_id, captured_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS email_content_sources_tenant_url_uidx
  ON email_content_sources (tenant_id, lower(canonical_url))
  WHERE canonical_url IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8) referral_requests (F5)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referral_requests (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  requested_by_user_id text NOT NULL,
  contact_id           uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE, -- klient, kterému posíláme žádost
  campaign_id          uuid REFERENCES email_campaigns(id) ON DELETE SET NULL,
  token                text NOT NULL UNIQUE,
  status               text NOT NULL DEFAULT 'sent', -- sent|opened|submitted|expired
  opened_at            timestamptz,
  submitted_at         timestamptz,
  submitted_contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL, -- nový kontakt, který vznikl submitnutím
  expires_at           timestamptz NOT NULL,
  rewarded_at          timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS referral_requests_tenant_idx
  ON referral_requests (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS referral_requests_contact_idx
  ON referral_requests (contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS referral_requests_status_idx
  ON referral_requests (status);

-- ─────────────────────────────────────────────────────────────────────────────
-- 9) Seed globálních šablon (migrace z static CAMPAIGN_TEMPLATES)
--    Idempotentní přes (tenant_id IS NULL, kind, is_system).
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO email_templates (tenant_id, name, kind, subject, preheader, body_html, description, icon_name, accent_class, style_key, merge_fields, is_system, sort_order)
SELECT * FROM (VALUES
  (NULL::uuid, 'Prázdný email',
   'blank',
   '',
   NULL::text,
   '<p>Napište svou zprávu zde...</p>',
   'Začni z čistého listu.',
   'Mail', 'text-wp-primary', 'blank',
   ARRAY['jmeno','cele_jmeno','unsubscribe_url']::text[], true, 0),

  (NULL::uuid, 'Narozeninové přání',
   'birthday',
   'Vše nejlepší, {{jmeno}}!',
   'Přeju Vám klidné svátky.',
   '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h1 style="color:#0B3A7A;">Vše nejlepší, {{jmeno}}!</h1>
      <p>Přeji Vám hlavně zdraví, radost a úspěch ve všem, do čeho se pustíte.</p>
      <p>Váš finanční poradce</p>
      <p style="margin-top:32px;font-size:12px;color:#64748b;">
        <a href="{{unsubscribe_url}}">Odhlásit odběr</a>
      </p>
    </div>',
   'Personalizované přání pro klienta.',
   'Cake', 'text-pink-600', 'birthday',
   ARRAY['jmeno','cele_jmeno','unsubscribe_url']::text[], true, 10),

  (NULL::uuid, 'Newsletter',
   'newsletter',
   'Novinky z finančního světa',
   'Výběr toho nejzajímavějšího za tento týden.',
   '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h1 style="color:#0B3A7A;">Novinky z finančního světa</h1>
      <p>Dobrý den, {{jmeno}},</p>
      <p>přináším Vám výběr toho nejzajímavějšího, co tento týden hýbalo financemi.</p>
      <!-- articles:start -->
      <!-- articles:end -->
      <p>Kdybyste chtěli cokoliv probrat osobně, ozvěte se mi.</p>
      <p style="margin-top:32px;font-size:12px;color:#64748b;">
        <a href="{{unsubscribe_url}}">Odhlásit odběr</a>
      </p>
    </div>',
   'Pravidelné novinky pro celou databázi.',
   'Newspaper', 'text-emerald-600', 'newsletter',
   ARRAY['jmeno','cele_jmeno','unsubscribe_url']::text[], true, 20),

  (NULL::uuid, 'Pozvánka na konzultaci',
   'consultation',
   'Čas na roční revizi, {{jmeno}}?',
   'Navrhněte si termín, který Vám vyhovuje.',
   '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h1 style="color:#0B3A7A;">Čas na společný přehled</h1>
      <p>Dobrý den, {{jmeno}},</p>
      <p>od naší poslední schůzky už uplynulo pár měsíců. Rád bych se s Vámi potkal a prošli jsme, jak se Vám daří — a jestli Vám portfolio stále sedí.</p>
      <p><a href="#" style="display:inline-block;padding:12px 24px;background:#0B3A7A;color:#fff;text-decoration:none;border-radius:8px;">Navrhnout termín</a></p>
      <p style="margin-top:32px;font-size:12px;color:#64748b;">
        <a href="{{unsubscribe_url}}">Odhlásit odběr</a>
      </p>
    </div>',
   'Servisní schůzka pro stávající klienty.',
   'Calendar', 'text-blue-600', 'consultation',
   ARRAY['jmeno','cele_jmeno','unsubscribe_url']::text[], true, 30),

  (NULL::uuid, 'Shrnutí roku s poradcem',
   'year_in_review',
   'Náš společný rok, {{jmeno}}',
   'Přehled toho, co jsme spolu za rok dokázali.',
   '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h1 style="color:#0B3A7A;">Náš společný rok, {{jmeno}}</h1>
      <p>Dobrý den, {{jmeno}},</p>
      <p>rád bych se s Vámi ohlédl za uplynulým rokem a shrnul, co jsme spolu zvládli:</p>
      <ul>
        <li><strong>Roční úspora:</strong> {{year_savings_total}}</li>
        <li><strong>Uzavřené produkty:</strong> {{products_list}}</li>
        <li><strong>Osobních schůzek:</strong> {{meetings_count}}</li>
      </ul>
      <p>{{advisor_note}}</p>
      <p>Děkuji za Vaši důvěru a těším se na další rok spolupráce.</p>
      <p style="margin-top:32px;font-size:12px;color:#64748b;">
        <a href="{{unsubscribe_url}}">Odhlásit odběr</a>
      </p>
    </div>',
   'Year-in-review s konkrétními čísly z CRM.',
   'TrendingUp', 'text-amber-600', 'year_in_review',
   ARRAY['jmeno','cele_jmeno','unsubscribe_url','year_savings_total','products_list','meetings_count','advisor_note']::text[], true, 40),

  (NULL::uuid, 'Žádost o doporučení',
   'referral_ask',
   'Znáte někoho, komu můžu pomoct?',
   'Doporučení od Vás je největší uznání.',
   '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h1 style="color:#0B3A7A;">Dobrý den, {{jmeno}}</h1>
      <p>když se na naši spolupráci podíváme zpětně, jsem rád, že pro Vás mám konkrétní výsledky. Pokud se Vám naše spolupráce osvědčila, možná znáte někoho ve svém okolí, komu bych mohl pomoct podobně.</p>
      <p><a href="{{referral_url}}" style="display:inline-block;padding:12px 24px;background:#0B3A7A;color:#fff;text-decoration:none;border-radius:8px;">Doporučit mě</a></p>
      <p>Žádný tlak — stačí, když pošlete jméno a kontakt, zbytek vyřídím sám.</p>
      <p style="margin-top:32px;font-size:12px;color:#64748b;">
        <a href="{{unsubscribe_url}}">Odhlásit odběr</a>
      </p>
    </div>',
   'Požádání o doporučení od spokojeného klienta.',
   'Users', 'text-violet-600', 'referral_ask',
   ARRAY['jmeno','cele_jmeno','unsubscribe_url','referral_url']::text[], true, 50)
) AS seed(tenant_id, name, kind, subject, preheader, body_html, description, icon_name, accent_class, style_key, merge_fields, is_system, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM email_templates et
  WHERE et.tenant_id IS NULL
    AND et.kind = seed.kind
    AND et.is_system = true
);

COMMIT;
