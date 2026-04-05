-- Portal advisor ↔ client chat: messages + attachments (idempotent).
-- Spusť v Supabase SQL Editoru pokud chybí tabulky messages / message_attachments.
-- Odpovídá packages/db/src/schema/messages.ts a message-attachments.ts

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid NOT NULL,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  sender_type text NOT NULL,
  sender_id text NOT NULL,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_tenant_unread_client
  ON public.messages (tenant_id)
  WHERE sender_type = 'client' AND read_at IS NULL;

-- ---------------------------------------------------------------------------
-- Časté problémy na Supabase po ručních změnách / starším schématu
-- ---------------------------------------------------------------------------

-- Doplň read_at, pokud tabulka messages vznikla dřív bez tohoto sloupce
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS read_at timestamptz;

-- RLS bez politik = všechny SELECT/INSERT padají (i z pooleru v některých režimech)
ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_attachments DISABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.messages TO postgres;
GRANT ALL ON TABLE public.message_attachments TO postgres;
