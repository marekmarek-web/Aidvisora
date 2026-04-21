-- Delta audit A4: sloupec pro idempotent grace-period reminder cron.
BEGIN;
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS grace_period_reminder_sent_at timestamptz;
COMMIT;
