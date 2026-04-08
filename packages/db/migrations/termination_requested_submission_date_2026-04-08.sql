-- Datum podání / odeslání žádosti (odděleně od požadovaného data účinnosti).
ALTER TABLE termination_requests
  ADD COLUMN IF NOT EXISTS requested_submission_date DATE;

COMMENT ON COLUMN termination_requests.requested_submission_date IS
  'Plánované nebo skutečné datum podání výpovědi; u režimu do 2 měsíců od sjednání vstup pro výpočet účinnosti.';
