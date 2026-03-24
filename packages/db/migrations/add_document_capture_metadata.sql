-- Plan 3 §10.3 — mobile scan capture metadata on documents

ALTER TABLE documents ADD COLUMN IF NOT EXISTS capture_mode text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS capture_quality_warnings jsonb;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS manual_crop_applied boolean;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS rotation_adjusted boolean;
