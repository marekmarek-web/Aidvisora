import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-request context for advisor assistant observability (Phase 2A).
 * Populated in POST /api/ai/assistant/chat and read from router / execution engine.
 */
export type AssistantRunStore = {
  traceId: string;
  assistantRunId: string;
  tenantId: string;
  userId: string;
  sessionId?: string;
  channel?: string | null;
  orchestration?: "canonical" | "legacy" | null;
};

const storage = new AsyncLocalStorage<AssistantRunStore>();

export function getAssistantRunStore(): AssistantRunStore | undefined {
  return storage.getStore();
}

export function runWithAssistantRunStore<T>(store: AssistantRunStore, fn: () => Promise<T>): Promise<T> {
  return storage.run(store, fn);
}
