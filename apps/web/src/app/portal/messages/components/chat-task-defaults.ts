import type { AdvisorChatAiSummary } from "@/lib/advisor-chat/advisor-chat-ai-types";

/** Návrh názvu úkolu z chatu (bez AI volání). */
export function buildChatTaskSuggestedTitle(
  contactName: string,
  lastClientSnippet: string,
  aiSummary: AdvisorChatAiSummary | null,
  primaryOpportunityTitle: string | null,
): string {
  const name = contactName.trim() || "klient";
  const fromClient = lastClientSnippet.trim().replace(/\s+/g, " ");
  if (fromClient.length > 8) {
    return fromClient.length > 72 ? `Vyřídit: ${fromClient.slice(0, 69)}…` : `Vyřídit: ${fromClient}`;
  }
  const step = aiSummary?.recommendedNextStep?.trim();
  if (
    step &&
    step.length > 5 &&
    !/^nevyplývá z podkladů/i.test(step)
  ) {
    return step.length > 80 ? `${step.slice(0, 77)}…` : step;
  }
  const opp = primaryOpportunityTitle?.trim();
  if (opp) return `Úkol: ${opp}`;
  return `Úkol z chatu — ${name}`;
}

/** Kontext do popisu úkolu. */
export function buildChatTaskDescriptionSeed(
  contactName: string,
  lastClientSnippet: string,
): string {
  const lines = [`Založeno z poradenského chatu (${contactName.trim() || "klient"}).`];
  const snip = lastClientSnippet.trim();
  if (snip) {
    lines.push("");
    lines.push("Poslední zpráva od klienta:");
    lines.push(snip.length > 800 ? `${snip.slice(0, 797)}…` : snip);
  }
  return lines.join("\n");
}
