-- Per-advisor uložené pozice karet na Vision boardu Zápisků (synchronizace mezi zařízeními).
ALTER TABLE advisor_preferences ADD COLUMN IF NOT EXISTS notes_board_positions jsonb;
