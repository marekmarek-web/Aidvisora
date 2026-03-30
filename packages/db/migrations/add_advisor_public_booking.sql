-- Veřejná rezervace schůzek: tajný odkaz, dostupnost (JSON), délka slotu.
ALTER TABLE advisor_preferences ADD COLUMN IF NOT EXISTS public_booking_token text;
ALTER TABLE advisor_preferences ADD COLUMN IF NOT EXISTS public_booking_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE advisor_preferences ADD COLUMN IF NOT EXISTS booking_availability jsonb;
ALTER TABLE advisor_preferences ADD COLUMN IF NOT EXISTS booking_slot_minutes integer NOT NULL DEFAULT 30;
ALTER TABLE advisor_preferences ADD COLUMN IF NOT EXISTS booking_buffer_minutes integer NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS advisor_preferences_public_booking_token_uidx
  ON advisor_preferences (public_booking_token)
  WHERE public_booking_token IS NOT NULL;
