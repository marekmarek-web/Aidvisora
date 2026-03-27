-- Zabrání opakovanému odeslání stejného kalendářního připomenutí (cron).
ALTER TABLE events ADD COLUMN IF NOT EXISTS reminder_notified_at TIMESTAMPTZ;
