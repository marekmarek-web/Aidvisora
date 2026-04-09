-- Staff (advisor) team invitations: token in e-mail → /prihlaseni?staff_invite=… → signup/login → membership
CREATE TABLE IF NOT EXISTS staff_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  email text NOT NULL,
  auth_user_id text,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  invited_by_user_id text,
  email_sent_at timestamptz,
  last_email_error text,
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS staff_invitations_tenant_email_lower_idx
  ON staff_invitations (tenant_id, lower(email));

CREATE INDEX IF NOT EXISTS staff_invitations_token_idx ON staff_invitations (token);
