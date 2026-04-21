-- Delta audit A10: důkazní tabulka pro souhlas s podmínkami + zpracovatelskou
-- smlouvou + AI disclaimer. Drží `version`, timestamp, IP a kontext (register /
-- checkout / staff-invite / client-invite / beta-terms).
-- Při GDPR dotazu nebo enterprise DD musíme prokázat, že konkrétní user v
-- konkrétním čase odsouhlasil konkrétní verzi dokumentů.

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_terms_acceptance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  /** Supabase auth.users.id — text, protože z proxy jsme dostávali string uuid. */
  user_id text,
  /** Pro klientská přijetí (pozvání do portálu) — reference na contacts row. */
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  /** Pokud je kontext tenant-scoped (staff-invite, checkout) — držíme explicitně. */
  tenant_id uuid,
  /** Typ kontextu — viz LEGAL_ACCEPTANCE_CONTEXTS. */
  context text NOT NULL,
  /** Verze publikovaných textů (LEGAL_DOCUMENT_VERSION). */
  version text NOT NULL,
  /** Které dokumenty uživatel v tomto kontextu akceptoval (pole slugů). */
  documents text[] NOT NULL,
  /** Klientské prostředí v čase přijetí (user-agent, lang). */
  user_agent text,
  locale text,
  /** IP adresa odesílatele (masked — viz privacy). */
  ip_address text,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (context IN ('register','checkout','staff-invite','client-invite','beta-terms')),
  CHECK (user_id IS NOT NULL OR contact_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS user_terms_acceptance_user_idx
  ON public.user_terms_acceptance (user_id, accepted_at DESC);
CREATE INDEX IF NOT EXISTS user_terms_acceptance_contact_idx
  ON public.user_terms_acceptance (contact_id, accepted_at DESC);
CREATE INDEX IF NOT EXISTS user_terms_acceptance_tenant_idx
  ON public.user_terms_acceptance (tenant_id, accepted_at DESC);

-- Append-only guard: žádné update / delete (stejně jako WS-2 audit logs).
CREATE OR REPLACE FUNCTION public.user_terms_acceptance_append_only()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'user_terms_acceptance is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_terms_acceptance_block_update ON public.user_terms_acceptance;
CREATE TRIGGER user_terms_acceptance_block_update
BEFORE UPDATE OR DELETE ON public.user_terms_acceptance
FOR EACH ROW EXECUTE FUNCTION public.user_terms_acceptance_append_only();

COMMIT;
