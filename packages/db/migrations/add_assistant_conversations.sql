-- Assistant conversations & messages for persistent chat history
-- Part of AI assistant rebuild Phase 2

CREATE TABLE IF NOT EXISTS assistant_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  channel TEXT,
  assistant_mode TEXT DEFAULT 'quick_assistant',
  locked_contact_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assistant_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES assistant_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  intent_snapshot JSONB,
  execution_plan_snapshot JSONB,
  referenced_entities JSONB,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assistant_conversations_tenant_user
  ON assistant_conversations (tenant_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_assistant_messages_conversation
  ON assistant_messages (conversation_id, created_at ASC);

ALTER TABLE assistant_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY assistant_conversations_tenant_isolation ON assistant_conversations
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY assistant_messages_tenant_isolation ON assistant_messages
  FOR ALL
  USING (
    conversation_id IN (
      SELECT id FROM assistant_conversations
      WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
    )
  );
