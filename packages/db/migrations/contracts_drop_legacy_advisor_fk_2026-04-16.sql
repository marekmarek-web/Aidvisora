-- Migration: fix legacy FK constraints on contracts table
-- Both constraints reference legacy empty tables (advisors, clients) instead of
-- current tables (user_profiles, contacts). Drizzle schema already uses contacts.id.
-- These constraints blocked ALL AI-review contract inserts (ghost success bug).

-- Drop legacy advisor FK (advisors table is empty, Drizzle schema has no FK here)
ALTER TABLE contracts DROP CONSTRAINT IF EXISTS contracts_advisor_id_fkey;

-- Fix client FK: drop legacy reference to empty clients table, re-add to contacts
ALTER TABLE contracts DROP CONSTRAINT IF EXISTS contracts_client_id_fkey;
ALTER TABLE contracts ADD CONSTRAINT contracts_client_id_contacts_fkey
  FOREIGN KEY (client_id) REFERENCES contacts(id) ON DELETE CASCADE;
