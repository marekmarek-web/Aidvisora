-- Požadavky poradce na podklady od klienta (material requests) + zprávy + vazba na dokumenty.
-- Spusť v Supabase SQL Editor po nasazení kódu (Drizzle schéma odpovídá těmto tabulkám).

CREATE TABLE IF NOT EXISTS public.advisor_material_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  created_by_user_id text NOT NULL,
  category text NOT NULL,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'normal',
  due_at timestamptz,
  response_mode text NOT NULL DEFAULT 'both',
  status text NOT NULL DEFAULT 'new',
  internal_note text,
  read_by_client_at timestamptz,
  advisor_last_read_at timestamptz,
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS advisor_material_requests_tenant_contact_idx
  ON public.advisor_material_requests(tenant_id, contact_id);
CREATE INDEX IF NOT EXISTS advisor_material_requests_tenant_status_idx
  ON public.advisor_material_requests(tenant_id, status);

CREATE TABLE IF NOT EXISTS public.advisor_material_request_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  request_id uuid NOT NULL REFERENCES public.advisor_material_requests(id) ON DELETE CASCADE,
  author_role text NOT NULL,
  author_user_id text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS advisor_material_request_messages_request_idx
  ON public.advisor_material_request_messages(request_id);

CREATE TABLE IF NOT EXISTS public.advisor_material_request_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  request_id uuid NOT NULL REFERENCES public.advisor_material_requests(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  attachment_role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT advisor_material_request_documents_req_doc_uid UNIQUE (request_id, document_id)
);

CREATE INDEX IF NOT EXISTS advisor_material_request_documents_document_idx
  ON public.advisor_material_request_documents(document_id);

-- RLS: členové tenanta (poradci) + klient přes client_contacts
ALTER TABLE public.advisor_material_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisor_material_request_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisor_material_request_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS advisor_material_requests_tenant_select ON public.advisor_material_requests;
DROP POLICY IF EXISTS advisor_material_requests_client_select ON public.advisor_material_requests;
DROP POLICY IF EXISTS advisor_material_request_messages_tenant_select ON public.advisor_material_request_messages;
DROP POLICY IF EXISTS advisor_material_request_messages_client_select ON public.advisor_material_request_messages;
DROP POLICY IF EXISTS advisor_material_request_documents_tenant_select ON public.advisor_material_request_documents;
DROP POLICY IF EXISTS advisor_material_request_documents_client_select ON public.advisor_material_request_documents;

CREATE POLICY advisor_material_requests_tenant_select ON public.advisor_material_requests
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT m.tenant_id FROM public.memberships m WHERE m.user_id = (SELECT auth.uid()::text)
    )
  );

CREATE POLICY advisor_material_requests_client_select ON public.advisor_material_requests
  FOR SELECT TO authenticated
  USING (
    contact_id IN (
      SELECT cc.contact_id FROM public.client_contacts cc WHERE cc.user_id = (SELECT auth.uid()::text)
    )
  );

CREATE POLICY advisor_material_request_messages_tenant_select ON public.advisor_material_request_messages
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT m.tenant_id FROM public.memberships m WHERE m.user_id = (SELECT auth.uid()::text)
    )
  );

CREATE POLICY advisor_material_request_messages_client_select ON public.advisor_material_request_messages
  FOR SELECT TO authenticated
  USING (
    request_id IN (
      SELECT r.id FROM public.advisor_material_requests r
      WHERE r.contact_id IN (
        SELECT cc.contact_id FROM public.client_contacts cc WHERE cc.user_id = (SELECT auth.uid()::text)
      )
    )
  );

CREATE POLICY advisor_material_request_documents_tenant_select ON public.advisor_material_request_documents
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT m.tenant_id FROM public.memberships m WHERE m.user_id = (SELECT auth.uid()::text)
    )
  );

CREATE POLICY advisor_material_request_documents_client_select ON public.advisor_material_request_documents
  FOR SELECT TO authenticated
  USING (
    request_id IN (
      SELECT r.id FROM public.advisor_material_requests r
      WHERE r.contact_id IN (
        SELECT cc.contact_id FROM public.client_contacts cc WHERE cc.user_id = (SELECT auth.uid()::text)
      )
    )
  );
