CREATE TABLE IF NOT EXISTS "email_campaigns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "created_by_user_id" text NOT NULL,
  "name" text NOT NULL,
  "subject" text NOT NULL,
  "body_html" text NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "sent_at" timestamptz
);

CREATE TABLE IF NOT EXISTS "email_campaign_recipients" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "campaign_id" uuid NOT NULL REFERENCES "email_campaigns"("id") ON DELETE CASCADE,
  "contact_id" uuid NOT NULL REFERENCES "contacts"("id") ON DELETE CASCADE,
  "email" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "error_message" text,
  "provider_message_id" text,
  "sent_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "email_campaigns_tenant_id_idx" ON "email_campaigns" ("tenant_id");
CREATE INDEX IF NOT EXISTS "email_campaign_recipients_campaign_id_idx" ON "email_campaign_recipients" ("campaign_id");
