-- F2 Slice D: additive provenance column on contacts.
-- Tracks how a contact row was created (manual | document | ai_review | import).
-- DEFAULT 'manual' ensures safe rollout — existing rows retain their implicit provenance.
-- No FK constraint; the enum is enforced at application layer (ContactSourceKind TS type).

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS source_kind TEXT DEFAULT 'manual';
