-- Delta audit A2/A3: rozšíření notification_log o provider_message_id a webhook
-- status sloupce, aby Resend bounce/complaint webhook mohl korelovat a updatovat
-- záznamy podle ID, které nám Resend vrátí při odeslání.

BEGIN;

ALTER TABLE public.notification_log
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS last_status text,
  ADD COLUMN IF NOT EXISTS last_status_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text;

CREATE INDEX IF NOT EXISTS notification_log_provider_message_id_idx
  ON public.notification_log (provider_message_id);

CREATE INDEX IF NOT EXISTS notification_log_tenant_sent_at_idx
  ON public.notification_log (tenant_id, sent_at);

COMMIT;
