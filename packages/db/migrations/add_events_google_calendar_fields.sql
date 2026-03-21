-- Srovnání tabulky `events` (a závislostí) s aktuálním Drizzle schématem + Google Calendar sync.
-- Spusť v Supabase SQL Editoru nebo: psql $DATABASE_URL -f packages/db/migrations/add_events_google_calendar_fields.sql
--
-- Řeší mimo jiné:
-- - team_events / team_tasks (pokud chybí z drizzle/0005_team_events.sql)
-- - events.team_event_id, tasks.team_task_id
-- - events.google_event_id, events.google_calendar_id

-- 1) Tabulky pro týmové události/úkoly (musí existovat před FK z events.tasks)
CREATE TABLE IF NOT EXISTS team_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by text NOT NULL,
  title text NOT NULL,
  event_type text DEFAULT 'schuzka',
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  all_day boolean DEFAULT false,
  location text,
  notes text,
  meeting_link text,
  reminder_at timestamptz,
  target_type text NOT NULL,
  target_user_ids text[] NOT NULL,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS team_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by text NOT NULL,
  title text NOT NULL,
  description text,
  due_date timestamptz,
  target_type text NOT NULL,
  target_user_ids text[] NOT NULL,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Sloupce na events / tasks
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS team_event_id uuid REFERENCES team_events(id) ON DELETE SET NULL;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS team_task_id uuid REFERENCES team_tasks(id) ON DELETE SET NULL;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS google_event_id text,
  ADD COLUMN IF NOT EXISTS google_calendar_id text;
