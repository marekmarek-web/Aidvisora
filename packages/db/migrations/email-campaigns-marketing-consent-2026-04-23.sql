-- Email Campaigns v2 — marketing_emails processing purpose seed + birth_greeting_opt_out
--
-- Součást plánu „Gap closure — email campaigns v2" (B1.2 + B1.4):
--  1) pro každého tenantu založí row `processing_purposes.marketing_emails` (legal basis = consent),
--     aby `hasValidConsent(... "marketing_emails")` fungoval napříč všemi tenanty.
--  2) přidá sloupec `contacts.birth_greeting_opt_out` aby birthday automation mohla
--     respektovat preference kontaktu (opt-out z přání k narozeninám).
--
-- Idempotent: `ON CONFLICT DO NOTHING` respektive `IF NOT EXISTS` ochránce před dvojím spuštěním.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Seed `marketing_emails` processing_purpose per tenant
-- ─────────────────────────────────────────────────────────────────────────────

-- Unique index na (tenant_id, name) — pokud ho schéma ještě nemá, přidáme ho
-- aby ON CONFLICT fungoval deterministicky.
CREATE UNIQUE INDEX IF NOT EXISTS processing_purposes_tenant_name_idx
  ON processing_purposes (tenant_id, name);

-- Vloží row pro všechny existující tenanty (tenants tabulka existuje).
-- Pro novo-vytvořené tenanty je třeba přidat seed do provisioning flow separátně.
INSERT INTO processing_purposes (tenant_id, name, legal_basis, retention_months)
SELECT t.id, 'marketing_emails', 'consent', 36
FROM tenants t
ON CONFLICT (tenant_id, name) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) contacts.birth_greeting_opt_out (B1.4)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS birth_greeting_opt_out boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN contacts.birth_greeting_opt_out IS
  'Kontakt si vyžádal, aby nedostával automatické přání k narozeninám. Respektováno v automation-worker birthday triggeru.';

COMMIT;
