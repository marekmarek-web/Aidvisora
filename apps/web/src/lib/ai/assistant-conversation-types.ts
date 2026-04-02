/**
 * Types for assistant conversation persistence.
 * Backed by assistant_conversations / assistant_messages tables.
 */

import type { CanonicalIntent, ExecutionPlan, AssistantChannel, AssistantMode } from "./assistant-domain-model";

export interface AssistantConversation {
  id: string;
  tenantId: string;
  userId: string;
  channel: AssistantChannel | null;
  assistantMode: AssistantMode;
  lockedContactId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssistantMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  intentSnapshot: CanonicalIntent | null;
  executionPlanSnapshot: ExecutionPlan | null;
  referencedEntities: { type: string; id: string; label?: string }[] | null;
  meta: Record<string, unknown> | null;
  createdAt: Date;
}
