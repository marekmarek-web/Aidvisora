/**
 * P5: deterministic, read-only “next best” hints for the advisor when a client is in context.
 * No extra LLM calls — uses the same data sources as context builder (best-effort).
 */

const MAX_HINTS = 4;

/**
 * Short bullet hints to append to the assistant reply when a single client is resolved.
 */
export async function loadProactiveHintsForContact(
  tenantId: string,
  contactId: string,
): Promise<string[]> {
  const hints: string[] = [];

  try {
    const { getClientAiContext } = await import("../client-ai-context");
    const ctx = await getClientAiContext(contactId, tenantId);
    if (ctx) {
      const openTasks = ctx.open_tasks_count ?? 0;
      if (openTasks >= 5) {
        hints.push(`Klient má ${openTasks} otevřených úkolů — zvažte vyčištění nebo prioritizaci.`);
      } else if (openTasks > 0) {
        hints.push(`Jsou otevřené úkoly (${openTasks}) — můžete je zkontrolovat nebo doplnit follow-up.`);
      }
      if (ctx.next_service_due) {
        hints.push(`Servis / výročí v dohledu: ${ctx.next_service_due}.`);
      }
      const opp = ctx.open_opportunities_count ?? 0;
      if (opp > 3) {
        hints.push(`Více otevřených obchodů (${opp}) — ověřte stav pipeline.`);
      }
    }
  } catch {
    /* best-effort */
  }

  try {
    const { listContractReviews } = await import("./review-queue-repository");
    const reviews = (await listContractReviews(tenantId, { limit: 25 })).filter(
      (r) => r.matchedClientId === contactId,
    );
    const pending = reviews.filter((r) => r.reviewStatus === "pending");
    if (pending.length > 0) {
      hints.push(
        `${pending.length} smlouva(y) u tohoto klienta čeká na AI review — lze schválit, aplikovat nebo propojit dokumenty.`,
      );
    }
  } catch {
    /* best-effort */
  }

  return hints.slice(0, MAX_HINTS);
}

export function formatProactiveHintsBlock(hints: string[]): string {
  if (hints.length === 0) return "";
  return `\n\n**Tipy k další práci:**\n${hints.map((h) => `- ${h}`).join("\n")}`;
}
