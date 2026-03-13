import { listContractReviews } from "./review-queue-repository";
import { computePriorityItems } from "./dashboard-priority";
import type { UrgentItem } from "./dashboard-types";

const MAX_CONTEXT_CHARS = 5500;

function trimLine(s: string, maxLen: number): string {
  const t = s.trim();
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen - 3) + "...";
}

/**
 * Build a safe, trimmed context string for the assistant model.
 * No raw documents, no full DB dumps. Tenant-scoped.
 */
export async function buildAssistantContext(
  tenantId: string,
  _options?: { maxChars?: number }
): Promise<string> {
  const maxChars = _options?.maxChars ?? MAX_CONTEXT_CHARS;
  const sections: string[] = [];

  const [priorityItems, pendingReviews] = await Promise.all([
    computePriorityItems(tenantId),
    listContractReviews(tenantId, { reviewStatus: "pending", limit: 10 }),
  ]);

  const topUrgent = priorityItems.slice(0, 5);
  if (topUrgent.length > 0) {
    const lines = topUrgent.map(
      (u: UrgentItem) =>
        `- [${u.type}] ${trimLine(u.title, 60)}: ${trimLine(u.recommendedAction ?? u.description, 80)}`
    );
    sections.push("Urgentní položky:\n" + lines.join("\n"));
  }

  if (pendingReviews.length > 0) {
    const fileNames = pendingReviews
      .slice(0, 3)
      .map((r) => r.fileName)
      .map((f) => trimLine(f, 50));
    sections.push(
      `Smlouvy čekající na review: ${pendingReviews.length} položek. Soubory: ${fileNames.join(", ")}.`
    );
  }

  const tasks = priorityItems.filter((i) => i.type === "task").slice(0, 5);
  if (tasks.length > 0) {
    const taskTitles = tasks.map((t) => trimLine(t.title, 50)).join("; ");
    sections.push(`Úkoly (due/overdue): ${taskTitles}`);
  }

  const clients = priorityItems.filter((i) => i.type === "client").slice(0, 3);
  if (clients.length > 0) {
    const clientLines = clients.map(
      (c) => `${trimLine(c.title, 40)} (${trimLine(c.description, 40)})`
    );
    sections.push("Klienti vyžadující pozornost: " + clientLines.join("; "));
  }

  const raw = sections.join("\n\n");
  if (raw.length > maxChars) {
    return raw.slice(0, maxChars - 20) + "\n...[zkráceno]";
  }
  return raw || "Žádná speciální data k zobrazení.";
}
