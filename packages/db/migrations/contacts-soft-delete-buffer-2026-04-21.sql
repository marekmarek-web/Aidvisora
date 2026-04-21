-- Delta A21 — 30denní soft-delete buffer pro kontakty.
--
-- Motivace: advisor občas omylem smaže klienta v rámci "úklidu". Bez buffer window
-- to znamená nenávratnou ztrátu (aktivní smlouvy se přes CASCADE rozpadnou také).
-- Nový model:
--   1. advisor klikne "Smazat" → contacts.deleted_at = now(), kontakt zmizí z UI.
--   2. Po 30 dnech cron `trash-purge-contacts` smaže definitivně (CASCADE).
--   3. Během 30 dnů lze restore v /portal/admin/trash.
--
-- RLS / views / existing queries již filtrují `archived_at IS NULL`; přidáme další
-- podmínku `deleted_at IS NULL` v jednotlivých read-cestách a v UI.

BEGIN;

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS deleted_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS deleted_reason TEXT NULL;

-- Partial index: rychlé filtrování aktivních kontaktů + rychlý list trashi.
CREATE INDEX IF NOT EXISTS contacts_deleted_at_idx
  ON contacts (tenant_id, deleted_at)
  WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS contacts_active_idx
  ON contacts (tenant_id)
  WHERE deleted_at IS NULL AND archived_at IS NULL;

COMMIT;
