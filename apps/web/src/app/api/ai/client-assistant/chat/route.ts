import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireAuthInAction } from "@/lib/auth/require-auth";
import { createResponseSafe, logOpenAICall } from "@/lib/openai";
import { getClientRequests } from "@/app/actions/client-portal-requests";
import { getPortalNotificationsForClient } from "@/app/actions/portal-notifications";
import { getUnreadAdvisorMessagesForClientCount } from "@/app/actions/messages";
import { getDocumentsForClient } from "@/app/actions/documents";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { CLIENT_PORTAL_AI_SYSTEM_PROMPT_CS } from "@/lib/ai/compliance-prompt-suffix";
import { createClient } from "@/lib/supabase/server";
import { assertCapability } from "@/lib/billing/plan-access-guards";
import { assertQuotaAvailable } from "@/lib/billing/subscription-usage";
import { nextResponseFromPlanOrQuotaError } from "@/lib/billing/plan-access-http";
import { captureAssistantApiError } from "@/lib/observability/assistant-sentry";
import { logAudit } from "@/lib/audit";
import { mapErrorForAdvisor } from "@/lib/ai/assistant-error-mapping";

export const dynamic = "force-dynamic";

function buildClientContextSummary(params: {
  requestsCount: number | null;
  unreadMessages: number | null;
  unreadNotifications: number | null;
  documentCount: number | null;
}) {
  // M17: `null` encodes "this source of truth failed to load" — do NOT emit
  // "0" to the model, it would treat a loader failure as a factual zero count.
  const fmt = (v: number | null) => (v == null ? "neznámo" : String(v));
  return [
    `Požadavky: ${fmt(params.requestsCount)}`,
    `Nepřečtené zprávy od poradce: ${fmt(params.unreadMessages)}`,
    `Nepřečtené notifikace: ${fmt(params.unreadNotifications)}`,
    `Dokumenty: ${fmt(params.documentCount)}`,
  ].join("\n");
}

export async function POST(request: Request) {
  const start = Date.now();
  const traceId = randomUUID();
  const assistantRunId = randomUUID();
  try {
    if (process.env.NEXT_PUBLIC_DISABLE_CLIENT_PORTAL_AI === "true") {
      return NextResponse.json({ error: "Tato funkce je vypnutá." }, { status: 403 });
    }
    const auth = await requireAuthInAction();
    if (auth.roleName !== "Client" || !auth.contactId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const email = user?.id === auth.userId ? user.email ?? null : null;
    try {
      await assertCapability({
        tenantId: auth.tenantId,
        userId: auth.userId,
        email,
        capability: "ai_assistant_basic",
      });
      await assertCapability({
        tenantId: auth.tenantId,
        userId: auth.userId,
        email,
        capability: "client_portal_documents",
      });
      await assertQuotaAvailable({
        tenantId: auth.tenantId,
        userId: auth.userId,
        email,
        dimension: "assistant_actions",
      });
    } catch (e) {
      const r = nextResponseFromPlanOrQuotaError(e);
      if (r) return r;
      throw e;
    }

    const rate = checkRateLimit(request, "ai-client-assistant-chat", auth.userId, {
      windowMs: 60_000,
      maxRequests: 10,
    });
    if (!rate.ok) {
      return NextResponse.json(
        { error: "Příliš mnoho požadavků. Zkuste to znovu za chvíli." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
      );
    }

    const body = await request.json().catch(() => ({}));
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) {
      return NextResponse.json({ error: "Chybí zpráva." }, { status: 400 });
    }

    let partialContextFailure = false;
    const loaderFailures: Record<string, boolean> = {
      requests: false,
      notifications: false,
      unreadMessages: false,
      documents: false,
    };
    const [requests, notifications, unreadMessages, documents] = await Promise.all([
      getClientRequests().catch((e) => {
        partialContextFailure = true;
        loaderFailures.requests = true;
        console.error("[client-assistant] getClientRequests failed", e);
        return [];
      }),
      getPortalNotificationsForClient().catch((e) => {
        partialContextFailure = true;
        loaderFailures.notifications = true;
        console.error("[client-assistant] getPortalNotificationsForClient failed", e);
        return [];
      }),
      getUnreadAdvisorMessagesForClientCount().catch((e) => {
        partialContextFailure = true;
        loaderFailures.unreadMessages = true;
        console.error("[client-assistant] getUnreadAdvisorMessagesForClientCount failed", e);
        return 0;
      }),
      getDocumentsForClient(auth.contactId).catch((e) => {
        partialContextFailure = true;
        loaderFailures.documents = true;
        console.error("[client-assistant] getDocumentsForClient failed", e);
        return [];
      }),
    ]);

    // M17: when a loader failed, surface `null` so the summary text reads
    // "neznámo" instead of a false "0".
    const context = buildClientContextSummary({
      requestsCount: loaderFailures.requests ? null : requests.length,
      unreadMessages: loaderFailures.unreadMessages ? null : unreadMessages,
      unreadNotifications: loaderFailures.notifications
        ? null
        : notifications.filter((n) => !n.readAt).length,
      documentCount: loaderFailures.documents ? null : documents.length,
    });

    const fullPrompt = `${CLIENT_PORTAL_AI_SYSTEM_PROMPT_CS}\n\nStav v portálu (jen počty, bez rad):\n${context}\n\nDotaz uživatele: ${message}\n\nOdpověď (pouze nápověda k aplikaci, bez finančního poradenství):`;
    const ai = await createResponseSafe(fullPrompt);

    if (!ai.ok) {
      logOpenAICall({
        endpoint: "client-assistant/chat",
        model: "—",
        latencyMs: Date.now() - start,
        success: false,
        error: ai.error,
      });
      return NextResponse.json({
        message: "Teď se nepodařilo připravit AI odpověď. Zkuste to prosím znovu.",
        suggestions: [
          { id: "openMessages", label: "Napsat poradci", href: "/client/messages" },
          { id: "openRequests", label: "Vytvořit požadavek", href: "/client/requests" },
          { id: "openDocuments", label: "Nahrát dokument", href: "/client/documents" },
        ],
        warnings: ["AI služba je dočasně nedostupná."],
      });
    }

    const baseSuggestions = [
      { id: "openMessages", label: "Napsat poradci", href: "/client/messages" },
      { id: "openRequests", label: "Vytvořit požadavek", href: "/client/requests" },
      { id: "openDocuments", label: "Nahrát dokument", href: "/client/documents" },
    ];

    logOpenAICall({
      endpoint: "client-assistant/chat",
      model: "—",
      latencyMs: Date.now() - start,
      success: true,
    });

    await logAudit({
      userId: auth.userId,
      tenantId: auth.tenantId,
      action: "client_assistant.chat",
      entityType: "assistant_message",
      meta: {
        traceId,
        assistantRunId,
        partialContextFailure,
        messageLen: message.length,
      },
    }).catch((e) => {
      console.error("[client-assistant] logAudit failed", e);
    });

    const warnings: string[] = [];
    if (partialContextFailure) {
      warnings.push(
        "Některé údaje v portálu se teď nepodařilo načíst — odpověď nemusí být přesná.",
      );
    }

    return NextResponse.json({
      message: ai.text.slice(0, 2000),
      suggestions: baseSuggestions,
      warnings,
    });
  } catch (err) {
    captureAssistantApiError(err, {
      traceId,
      assistantRunId,
      channel: "client_portal",
    });
    const rawMessage = err instanceof Error ? err.message : "AI požadavek selhal.";
    const safeMessage = mapErrorForAdvisor(rawMessage, null, "client-assistant/chat");
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}
