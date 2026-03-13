/**
 * Types for optional persistence of assistant conversations (Phase 5).
 * TODO: Implement assistant_conversations / assistant_messages tables and repository
 * when persisting chat history is required.
 */

export interface AssistantConversation {
  id: string;
  tenantId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssistantMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
  /** Optional: suggested actions returned with this message (stored as JSON). */
  meta?: Record<string, unknown>;
}
