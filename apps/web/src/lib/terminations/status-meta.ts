/**
 * Shared stavová mapa pro Termination request workflow.
 *
 * Pokrývá celou enum škálu z `packages/db/schema/termination-enums.ts`
 * (13 stavů) – jediný zdroj pravdy pro česká jména a barvy badge.
 *
 * Používáno v:
 * - /portal/terminations/page.tsx (list)
 * - /portal/terminations/[requestId]/TerminationRequestDetailClient.tsx (detail)
 * - další surface, které zobrazují stav žádosti
 */

import type { TerminationRequestStatus } from "./types";

export type TerminationStatusTone = "neutral" | "amber" | "blue" | "violet" | "emerald" | "rose";

export interface TerminationStatusMeta {
  label: string;
  tone: TerminationStatusTone;
}

const TONE_CLASSES: Record<TerminationStatusTone, string> = {
  neutral:
    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  amber:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  blue:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  violet:
    "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  emerald:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  rose:
    "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

const STATUS_META: Record<string, TerminationStatusMeta> = {
  draft: { label: "Koncept", tone: "neutral" },
  intake: { label: "Rozepsaná", tone: "neutral" },
  rules_evaluating: { label: "Vyhodnocování pravidel", tone: "amber" },
  awaiting_data: { label: "Čeká na data", tone: "amber" },
  awaiting_review: { label: "Čeká na kontrolu", tone: "amber" },
  pending_review: { label: "Čeká na kontrolu", tone: "amber" },
  ready_to_generate: { label: "Připraveno k dokumentu", tone: "blue" },
  ready: { label: "Připraveno", tone: "blue" },
  document_draft: { label: "Návrh dokumentu", tone: "blue" },
  final_review: { label: "Finální kontrola", tone: "blue" },
  dispatch_pending: { label: "Čeká na odeslání", tone: "violet" },
  dispatched: { label: "Odesláno", tone: "violet" },
  completed: { label: "Dokončeno", tone: "emerald" },
  cancelled: { label: "Zrušeno", tone: "rose" },
  failed: { label: "Selhání", tone: "rose" },
};

export function getTerminationStatusMeta(
  status: string | null | undefined,
): TerminationStatusMeta {
  if (!status) return STATUS_META.intake;
  return STATUS_META[status] ?? { label: status, tone: "neutral" };
}

export function getTerminationStatusLabel(status: string | null | undefined): string {
  return getTerminationStatusMeta(status).label;
}

export function getTerminationStatusBadgeClassName(
  status: string | null | undefined,
): string {
  const meta = getTerminationStatusMeta(status);
  return `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASSES[meta.tone]}`;
}

export type { TerminationRequestStatus };
