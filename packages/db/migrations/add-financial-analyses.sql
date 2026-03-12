-- Tabulky pro Finanční analýzy (spusť v Supabase SQL Editoru, pokud pnpm db:push neproběhne)
-- Vyžaduje existující tabulky: contacts, households (companies vytvoříme jako první)

-- companies (potřeba pro FK z financial_analyses)
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  ico text,
  name text NOT NULL,
  industry text,
  employees integer,
  cat3 integer,
  avg_wage integer,
  top_client integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- financial_analyses
CREATE TABLE IF NOT EXISTS financial_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  household_id uuid REFERENCES households(id) ON DELETE SET NULL,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  primary_contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'financial',
  status text NOT NULL DEFAULT 'draft',
  source_type text NOT NULL DEFAULT 'native',
  version integer NOT NULL DEFAULT 1,
  payload jsonb NOT NULL,
  created_by text,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_exported_at timestamptz,
  linked_company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  last_refreshed_from_shared_at timestamptz
);
