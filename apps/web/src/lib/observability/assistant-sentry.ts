import * as Sentry from "@sentry/nextjs";

/**
 * Report assistant HTTP handler failures to Sentry with stable tags for triage.
 * Safe no-op if Sentry throws (e.g. init race).
 */
export type AssistantApiErrorContext = {
  traceId: string;
  assistantRunId: string;
  channel?: string;
  orchestration?: "canonical" | "legacy";
  tenantId?: string;
  // L8: added richer correlation keys so Sentry issues can be pivoted by
  // user, conversation, active client, and the specific action that blew up.
  userId?: string;
  sessionId?: string;
  conversationId?: string;
  clientId?: string;
  actionId?: string;
};

export function captureAssistantApiError(error: unknown, ctx: AssistantApiErrorContext): void {
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    Sentry.withScope((scope) => {
      scope.setTag("api_route", "ai_assistant_chat");
      scope.setTag("trace_id", ctx.traceId.slice(0, 64));
      scope.setTag("assistant_run_id", ctx.assistantRunId.slice(0, 64));
      if (ctx.channel) scope.setTag("assistant_channel", ctx.channel.slice(0, 64));
      if (ctx.orchestration) scope.setTag("assistant_orchestration", ctx.orchestration);
      if (ctx.tenantId) scope.setTag("tenant_id", ctx.tenantId.slice(0, 36));
      if (ctx.userId) scope.setTag("user_id", ctx.userId.slice(0, 64));
      if (ctx.sessionId) scope.setTag("assistant_session_id", ctx.sessionId.slice(0, 64));
      if (ctx.conversationId) scope.setTag("assistant_conversation_id", ctx.conversationId.slice(0, 64));
      if (ctx.clientId) scope.setTag("assistant_client_id", ctx.clientId.slice(0, 64));
      if (ctx.actionId) scope.setTag("assistant_action_id", ctx.actionId.slice(0, 64));
      if (ctx.userId) scope.setUser({ id: ctx.userId });
      scope.setContext("assistant_request", {
        traceId: ctx.traceId,
        assistantRunId: ctx.assistantRunId,
        channel: ctx.channel,
        orchestration: ctx.orchestration,
        userId: ctx.userId,
        sessionId: ctx.sessionId,
        conversationId: ctx.conversationId,
        clientId: ctx.clientId,
        actionId: ctx.actionId,
      });
      Sentry.captureException(err);
    });
  } catch {
    /* ignore */
  }
}
