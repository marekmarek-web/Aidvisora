-- 2026-04-20 · WS-1 Billing: audit log + dunning state + VAT capture
--
-- Tři nezávislé části, spouštět v uvedeném pořadí. Všechno je idempotentní
-- (IF NOT EXISTS) → bezpečné i pro opakované spuštění v Supabase SQL editoru.
--
-- 1) billing_audit_log — append-only log změn billingu (kdo, co, kdy, odkud),
--    spojený s workspace (tenant) a s konkrétním Stripe objektem. Používá se
--    pro dohledatelnost dunning kroků, coupon aplikací, převodu trial→paid,
--    a ruční úpravy fakturace z administrace.
--
-- 2) subscriptions — doplnění polí pro dunning state (grace period, počet
--    neúspěšných pokusů, datum poslední selhané platby, přepnutí do restricted)
--    a promo_code (pro audit / retenční analýzy PB kohorty).
--
-- 3) tenants — volitelná fakturační identita workspace (IČO, DIČ, název
--    a adresa) pro VAT faktury. Drží je aplikace, Stripe Tax je používá
--    jako zdroj pravdy při tvorbě faktury (tax_ids / customer_update).
--
-- ─── 1) billing_audit_log ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.billing_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  -- action: stabilní kód události; full list v lib/stripe/billing-audit.ts
  --   subscription.created / subscription.updated / subscription.deleted
  --   invoice.paid / invoice.payment_failed / invoice.finalized
  --   checkout.completed / coupon.applied
  --   trial.converted / billing.details.updated / dunning.restricted
  action text NOT NULL,
  -- actor_kind: 'user' (kliknutí v UI), 'system' (cron / background), 'webhook' (Stripe event)
  actor_kind text NOT NULL CHECK (actor_kind IN ('user', 'system', 'webhook')),
  actor_user_id text,
  from_state jsonb,
  to_state jsonb,
  -- odkaz na Stripe event.id pro spárování s stripe_webhook_events (idempotence)
  stripe_event_id text,
  -- konkrétní Stripe objekt, kterého se to týká (sub_…, in_…, cus_…, cs_…)
  stripe_object_id text,
  metadata jsonb,
  ip_address inet,
  at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS billing_audit_log_tenant_at_idx
  ON public.billing_audit_log (tenant_id, at DESC);

CREATE INDEX IF NOT EXISTS billing_audit_log_stripe_event_idx
  ON public.billing_audit_log (stripe_event_id)
  WHERE stripe_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS billing_audit_log_action_at_idx
  ON public.billing_audit_log (action, at DESC);

-- Append-only na úrovni DB: revoke UPDATE/DELETE od běžných rolí.
-- Service-role smí vše (pro migrace/GDPR delete bychom museli explicitně povolit).
DO $$
BEGIN
  EXECUTE 'REVOKE UPDATE, DELETE ON public.billing_audit_log FROM PUBLIC';
  EXECUTE 'REVOKE UPDATE, DELETE ON public.billing_audit_log FROM authenticated';
  EXECUTE 'REVOKE UPDATE, DELETE ON public.billing_audit_log FROM anon';
EXCEPTION WHEN undefined_object OR undefined_table THEN
  -- role nemusí v daném prostředí existovat (např. čistý Postgres bez Supabase)
  NULL;
END$$;

-- RLS: čtení jen pro členy tenantu; zápis jen přes service-role (serverový kód).
ALTER TABLE public.billing_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_audit_log_select_tenant ON public.billing_audit_log;
CREATE POLICY billing_audit_log_select_tenant ON public.billing_audit_log
  FOR SELECT
  USING (
    tenant_id::text = current_setting('app.tenant_id', true)
  );

-- Žádná INSERT/UPDATE/DELETE policy → klient (authenticated / anon) nezapíše nic.
-- Server (service_role) obchází RLS.

COMMENT ON TABLE public.billing_audit_log IS
  'Append-only log billingových událostí (WS-1). Zápisy výhradně přes service-role.';
COMMENT ON COLUMN public.billing_audit_log.action IS
  'Stabilní kód: subscription.*, invoice.*, checkout.completed, coupon.applied, trial.converted, billing.details.updated, dunning.restricted.';

-- ─── 2) subscriptions — dunning state + promo_code ───────────────────────

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS grace_period_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_payment_failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_payment_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promo_code text,
  ADD COLUMN IF NOT EXISTS restricted_at timestamptz;

CREATE INDEX IF NOT EXISTS subscriptions_tenant_status_idx
  ON public.subscriptions (tenant_id, status);

CREATE INDEX IF NOT EXISTS subscriptions_grace_ends_idx
  ON public.subscriptions (grace_period_ends_at)
  WHERE grace_period_ends_at IS NOT NULL;

COMMENT ON COLUMN public.subscriptions.grace_period_ends_at IS
  'Po selhání opakovaných pokusů Stripe: aplikační grace period, po které workspace přejde do restricted.';
COMMENT ON COLUMN public.subscriptions.failed_payment_attempts IS
  'Lokální čítač neúspěšných pokusů o platbu (invoice.payment_failed). Reset na 0 při invoice.payment_succeeded.';
COMMENT ON COLUMN public.subscriptions.promo_code IS
  'Interní stopa aplikovaného promokódu (např. PREMIUM-BROKERS-2026). Autoritativním zdrojem je Stripe subscription.discount.';

-- ─── 3) tenants — VAT capture pro CZ faktury ─────────────────────────────

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS billing_company_name text,
  ADD COLUMN IF NOT EXISTS billing_ico text,
  ADD COLUMN IF NOT EXISTS billing_dic text,
  ADD COLUMN IF NOT EXISTS billing_address_line text,
  ADD COLUMN IF NOT EXISTS billing_notes text;

COMMENT ON COLUMN public.tenants.billing_ico IS
  'IČO pro fakturaci; předává se do Stripe Customer tax_ids při vytvoření/aktualizaci.';
COMMENT ON COLUMN public.tenants.billing_dic IS
  'DIČ (eu_vat pro CZ plátce DPH). Používá se Stripe Tax pro správné zdanění / reverse charge.';

-- ─── Kontrola ─────────────────────────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns WHERE table_name='subscriptions' AND column_name IN
--   ('grace_period_ends_at','last_payment_failed_at','failed_payment_attempts','promo_code','restricted_at');
-- SELECT column_name FROM information_schema.columns WHERE table_name='tenants' AND column_name LIKE 'billing_%';
-- SELECT count(*) FROM public.billing_audit_log;
