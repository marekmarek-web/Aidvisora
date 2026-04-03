import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/auth/get-membership";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createResponseSafe } from "@/lib/openai";
import { logOpenAICall } from "@/lib/openai";
import {
  computePriorityItems,
  getTasksDueAndOverdue,
  getClientsNeedingAttention,
  buildSuggestedActionsFromUrgent,
  getBlockedPaymentSetups,
  getBlockedReviews,
} from "@/lib/ai/dashboard-priority";
import { listContractReviews } from "@/lib/ai/review-queue-repository";
import type {
  DashboardSummary,
  ContractWaitingForReview,
  MissingDataWarning,
} from "@/lib/ai/dashboard-types";

export const dynamic = "force-dynamic";

function buildFallbackSummary(
  urgentCount: number,
  reviewCount: number,
  overdueCount: number,
  dueTodayCount: number
): string {
  const parts: string[] = [];
  if (overdueCount > 0) parts.push(`${overdueCount} úkolů po termínu`);
  if (dueTodayCount > 0) parts.push(`${dueTodayCount} úkolů na dnes`);
  if (reviewCount > 0) parts.push(`${reviewCount} smluv ke kontrole`);
  if (urgentCount > 0 && parts.length === 0) parts.push(`${urgentCount} prioritních položek`);
  if (parts.length === 0) return "Dnes nemáte urgentní položky. Prohlédněte si kalendář nebo úkoly.";
  return `Máte ${parts.join(", ")}. Interní návrh priority: nejdříve vyřešit ${overdueCount > 0 ? "zpožděné úkoly" : reviewCount > 0 ? "review smluv" : "dnešní agendu"}.`;
}

/** Fallback pro „Připomeň mi“ — nedodělky a věci neodeslané / neuzavřené klientovi. */
function buildRemindersFallbackSummary(params: {
  overdueCount: number;
  dueTodayCount: number;
  pendingReviewCount: number;
  blockedReviewCount: number;
  blockedPaymentCount: number;
  clientsAttentionCount: number;
  overdueSamples: { title: string }[];
  pendingSamples: { fileName: string }[];
}): string {
  const lines: string[] = [];
  const {
    overdueCount,
    dueTodayCount,
    pendingReviewCount,
    blockedReviewCount,
    blockedPaymentCount,
    clientsAttentionCount,
    overdueSamples,
    pendingSamples,
  } = params;

  if (overdueCount > 0) {
    const extra =
      overdueSamples.length > 0
        ? ` Např. „${overdueSamples[0].title.slice(0, 48)}${overdueSamples[0].title.length > 48 ? "…" : ""}“.`
        : "";
    lines.push(`Úkoly po termínu (${overdueCount}) — ještě nejsou dokončené.${extra}`);
  }
  if (dueTodayCount > 0) {
    lines.push(`Na dnes máte ${dueTodayCount} otevřený${dueTodayCount === 1 ? " úkol" : dueTodayCount < 5 ? "é úkoly" : "ých úkolů"}, které nejsou hotové.`);
  }
  if (pendingReviewCount > 0) {
    const samp =
      pendingSamples[0]?.fileName != null
        ? ` Jedna z nich: „${pendingSamples[0].fileName.slice(0, 40)}${pendingSamples[0].fileName.length > 40 ? "…" : ""}“.`
        : "";
    const reviewPhrase =
      pendingReviewCount === 1
        ? "Jedna nahraná smlouva čeká na vaši kontrolu v review."
        : pendingReviewCount < 5
          ? `${pendingReviewCount} smlouvy čekají na vaši kontrolu v review.`
          : `${pendingReviewCount} smluv čeká na vaši kontrolu v review.`;
    lines.push(`${reviewPhrase}${samp}`);
  }
  if (blockedReviewCount > 0) {
    lines.push(
      `${blockedReviewCount} review blokuje dokončení nebo zveřejnění u klienta — chybí údaje nebo schválení.`
    );
  }
  if (blockedPaymentCount > 0) {
    lines.push(
      `${blockedPaymentCount} platební${blockedPaymentCount === 1 ? " nastavení" : blockedPaymentCount < 5 ? " nastavení" : "ch nastavení"} čeká na vaši kontrolu před odesláním do klientského portálu.`
    );
  }
  if (clientsAttentionCount > 0) {
    lines.push(
      `${clientsAttentionCount} klientů má zadaný servis na nejbližší dny — je potřeba se ozvat (neodeslaný kontakt).`
    );
  }

  if (lines.length === 0) {
    return "Nemám co výrazně připomenout: nevidím otevřené úkoly po termínu ani nevyřízená review blokující odeslání. Můžete zkontrolovat úkoly a kalendář ručně.";
  }
  return `Připomínám nedodělky a neodeslané věci:\n\n${lines.map((l) => `– ${l}`).join("\n")}`;
}

const USER_ID_HEADER = "x-user-id";

export async function GET(request: Request) {
  const start = Date.now();
  try {
    let userId: string | null = request.headers.get(USER_ID_HEADER);
    if (!userId) {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      userId = user.id;
    }
    const membership = await getMembership(userId);
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(request.url);
    const remindersMode = url.searchParams.get("mode") === "reminders";

    const limiter = checkRateLimit(request, "ai-dashboard-summary", `${membership.tenantId}:${userId}`, { windowMs: 60_000, maxRequests: 20 });
    if (!limiter.ok) {
      return NextResponse.json({ error: "Too many requests. Please retry later." }, { status: 429, headers: { "Retry-After": String(limiter.retryAfterSec) } });
    }

    const tenantId = membership.tenantId;

    const [
      urgentItems,
      pendingReviews,
      tasksData,
      clientsNeedingAttention,
      blockedPayments,
      blockedReviews,
    ] = await Promise.all([
      computePriorityItems(tenantId),
      listContractReviews(tenantId, { reviewStatus: "pending", limit: 20 }),
      getTasksDueAndOverdue(tenantId),
      getClientsNeedingAttention(tenantId),
      getBlockedPaymentSetups(tenantId),
      getBlockedReviews(tenantId),
    ]);

    const contractsWaitingForReview: ContractWaitingForReview[] = pendingReviews.map((r) => ({
      id: r.id,
      fileName: r.fileName,
      createdAt: r.createdAt.toISOString(),
      confidence: r.confidence ?? null,
      processingStatus: r.processingStatus,
    }));

    const missingDataWarnings: MissingDataWarning[] = [];
    for (const r of pendingReviews) {
      const payload = r.extractedPayload as { missingFields?: string[] } | null;
      const hasMissing = payload?.missingFields?.length;
      const lowConf = r.confidence != null && r.confidence < 0.7;
      if (hasMissing || lowConf) {
        missingDataWarnings.push({
          source: "contract_review",
          entityId: r.id,
          message: hasMissing
            ? `Chybějící pole: ${(payload!.missingFields as string[]).slice(0, 3).join(", ")}`
            : lowConf
              ? "Nízká confidence extrakce"
              : "Vyžaduje kontrolu",
        });
      }
    }

    const suggestedActions = buildSuggestedActionsFromUrgent(urgentItems);

    const blockedReviewCount = blockedReviews.length;
    const blockedPaymentCount = blockedPayments.length;

    let assistantSummaryText: string;
    const hasKey = Boolean(process.env.OPENAI_API_KEY?.trim());

    const remindersContext = [
      `Úkoly po termínu: ${tasksData.overdueTasks.length}, úkoly na dnes (nehotové): ${tasksData.tasksDueToday.length}.`,
      `Review pending: ${pendingReviews.length}, review blokující apply/klienta: ${blockedReviewCount}.`,
      `Platební nastavení k schválení (ne u klienta): ${blockedPaymentCount}.`,
      `Klienti servis do 7 dní: ${clientsNeedingAttention.length}.`,
      tasksData.overdueTasks
        .slice(0, 3)
        .map((t) => `Úkol po termínu: ${t.title}${t.contactName ? ` (${t.contactName})` : ""}`)
        .join("; "),
      pendingReviews
        .slice(0, 3)
        .map((r) => `Review: ${r.fileName}`)
        .join("; "),
    ].join(" ");

    const urgentContext = [
      `Urgentní: ${urgentItems.length}, Review: ${pendingReviews.length}, Úkoly po termínu: ${tasksData.overdueTasks.length}, Dnes: ${tasksData.tasksDueToday.length}.`,
      urgentItems
        .slice(0, 5)
        .map((u) => `${u.type}: ${u.title} (${u.recommendedAction})`)
        .join(". "),
    ].join(" ");

    if (hasKey) {
      const prompt = remindersMode
        ? `Jsi asistent poradce v CRM. Poradce chce připomenout, co ještě neudělal, nevyřídil nebo neposlal klientovi.
Stručně odpověz česky (2–5 krátkých vět nebo řádky začínající „– "). Zaměř se na: nedokončené úkoly po termínu a na dnes, nevydaná review smluv, věci blokující zobrazení klientovi v portálu, klienty k zastižení před servisem.
Kontext: ${remindersContext}
Buď konkrétní, bez úvodních frází typu „jistě“.`
        : `Jsi asistent poradce v CRM. Stručně (1-2 věty) shrň prioritní práci na dnešek. Kontext: ${urgentContext}. Odpověz pouze textem, bez odrážek.`;

      const result = await createResponseSafe(prompt);
      if (result.ok) {
        assistantSummaryText = result.text.slice(0, remindersMode ? 1200 : 500).trim();
      } else {
        logOpenAICall({
          endpoint: remindersMode ? "dashboard-summary-reminders" : "dashboard-summary",
          model: "—",
          latencyMs: Date.now() - start,
          success: false,
          error: (result as { error?: string }).error?.slice(0, 80),
        });
        assistantSummaryText = remindersMode
          ? buildRemindersFallbackSummary({
              overdueCount: tasksData.overdueTasks.length,
              dueTodayCount: tasksData.tasksDueToday.length,
              pendingReviewCount: pendingReviews.length,
              blockedReviewCount,
              blockedPaymentCount,
              clientsAttentionCount: clientsNeedingAttention.length,
              overdueSamples: tasksData.overdueTasks,
              pendingSamples: pendingReviews.map((r) => ({ fileName: r.fileName })),
            })
          : buildFallbackSummary(
              urgentItems.length,
              pendingReviews.length,
              tasksData.overdueTasks.length,
              tasksData.tasksDueToday.length
            );
      }
    } else {
      assistantSummaryText = remindersMode
        ? buildRemindersFallbackSummary({
            overdueCount: tasksData.overdueTasks.length,
            dueTodayCount: tasksData.tasksDueToday.length,
            pendingReviewCount: pendingReviews.length,
            blockedReviewCount,
            blockedPaymentCount,
            clientsAttentionCount: clientsNeedingAttention.length,
            overdueSamples: tasksData.overdueTasks,
            pendingSamples: pendingReviews.map((r) => ({ fileName: r.fileName })),
          })
        : buildFallbackSummary(
            urgentItems.length,
            pendingReviews.length,
            tasksData.overdueTasks.length,
            tasksData.tasksDueToday.length
          );
    }

    const blockedItems = [...blockedReviews, ...blockedPayments];
    const communicationSuggestions: string[] = [];
    if (blockedPayments.length > 0)
      communicationSuggestions.push("Vyžádat chybějící platební údaje od klienta.");
    if (clientsNeedingAttention.length > 0)
      communicationSuggestions.push("Kontaktovat klienty s blížícím se servisem.");

    const summary: DashboardSummary = {
      urgentItems,
      contractsWaitingForReview,
      tasksDueToday: tasksData.tasksDueToday,
      overdueTasks: tasksData.overdueTasks,
      clientsNeedingAttention,
      missingDataWarnings,
      suggestedActions,
      assistantSummaryText,
      blockedItems,
      paymentsBlockedForPortal: blockedPayments,
      communicationSuggestions,
    };

    return NextResponse.json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Načtení shrnutí selhalo.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
