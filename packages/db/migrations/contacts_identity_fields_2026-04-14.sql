-- Fáze 1 / Slice 1: Rozšíření contacts o identity fields pro AI Review extraction
-- idCardIssuedBy, idCardValidUntil, idCardIssuedAt, generalPractitioner

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS id_card_issued_by TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS id_card_valid_until DATE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS id_card_issued_at DATE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS general_practitioner TEXT;
