ALTER TABLE client_invitations
  ADD COLUMN IF NOT EXISTS auth_user_id text,
  ADD COLUMN IF NOT EXISTS temporary_password_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS password_change_required_at timestamptz,
  ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;
