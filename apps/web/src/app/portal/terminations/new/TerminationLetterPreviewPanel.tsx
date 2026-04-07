"use client";

import { useEffect, useState } from "react";
import { getTerminationLetterPreview } from "@/app/actions/terminations";
import type { TerminationLetterBuildResult } from "@/lib/terminations/termination-letter-types";

function badgeClasses(badge: TerminationLetterBuildResult["badge"]): string {
  switch (badge) {
    case "free_form":
      return "bg-emerald-100 text-emerald-950 border-emerald-200";
    case "official_form":
      return "bg-indigo-100 text-indigo-950 border-indigo-200";
    case "review_required":
      return "bg-amber-100 text-amber-950 border-amber-200";
    default:
      return "bg-[color:var(--wp-surface-muted)] text-[color:var(--wp-text)] border-[color:var(--wp-border)]";
  }
}

function badgeLabel(badge: TerminationLetterBuildResult["badge"]): string {
  switch (badge) {
    case "free_form":
      return "Volná forma";
    case "official_form":
      return "Oficiální formulář";
    case "review_required":
      return "Vyžaduje kontrolu";
    default:
      return badge;
  }
}

function channelLabel(ch: TerminationLetterBuildResult["viewModel"]["deliveryChannel"]): string {
  switch (ch) {
    case "post":
      return "Pošta / písemně";
    case "email":
      return "E-mail";
    case "databox":
      return "Datová schránka";
    case "portal":
      return "Portál pojišťovny";
    case "form":
      return "Formulář pojišťovny";
    default:
      return ch;
  }
}

function publishLabel(state: TerminationLetterBuildResult["publishState"]): string {
  switch (state) {
    case "ready_to_send":
      return "Lze považovat za připravené k odeslání (po kontrole poradce).";
    case "draft_only":
      return "Pouze koncept – není finální k odeslání.";
    case "review_required":
      return "Vyžaduje kontrolu před odesláním.";
    default:
      return state;
  }
}

export function TerminationLetterPreviewPanel({ requestId }: { requestId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TerminationLetterBuildResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getTerminationLetterPreview(requestId).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setData(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  if (loading) {
    return (
      <div className="rounded-[var(--wp-radius)] border border-[color:var(--wp-border)] bg-[color:var(--wp-surface-muted)] p-4 text-sm text-[color:var(--wp-text-secondary)]">
        Načítám náhled dokumentu…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-[var(--wp-radius)] border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        {error ?? "Náhled se nepodařilo načíst."}
      </div>
    );
  }

  const { viewModel: vm, badge, publishState, letterPlainText, officialForm, validityReasons } = data;
  const eff = vm.computedEffectiveDate ?? vm.requestedEffectiveDate ?? "—";
  const attachmentsUi =
    vm.attachments.length > 0 ? vm.attachmentsSummaryText : "Bez příloh";

  return (
    <div className="space-y-4 rounded-[var(--wp-radius)] border border-[color:var(--wp-border)] bg-[color:var(--wp-surface-muted)]/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${badgeClasses(badge)}`}
        >
          {badgeLabel(badge)}
        </span>
        <span className="text-xs text-[color:var(--wp-text-secondary)]">{publishLabel(publishState)}</span>
      </div>

      <div className="rounded-[var(--wp-radius)] border border-[color:var(--wp-border)] bg-[color:var(--wp-surface)] p-3 text-xs space-y-1.5 text-[color:var(--wp-text-secondary)]">
        <p>
          <span className="font-semibold text-[color:var(--wp-text)]">Klient:</span>{" "}
          {vm.policyholderName.trim() || "—"}
        </p>
        <p>
          <span className="font-semibold text-[color:var(--wp-text)]">Pojišťovna:</span> {vm.insurerName}
        </p>
        <p>
          <span className="font-semibold text-[color:var(--wp-text)]">Smlouva:</span> {vm.contractNumber}
        </p>
        <p>
          <span className="font-semibold text-[color:var(--wp-text)]">Režim:</span> {vm.terminationModeLabel}
        </p>
        <p>
          <span className="font-semibold text-[color:var(--wp-text)]">Datum účinnosti (zobrazení):</span>{" "}
          {eff}
        </p>
        <p>
          <span className="font-semibold text-[color:var(--wp-text)]">Kanál odeslání:</span>{" "}
          {channelLabel(vm.deliveryChannel)}
        </p>
        <p>
          <span className="font-semibold text-[color:var(--wp-text)]">Přílohy:</span> {attachmentsUi}
        </p>
        {vm.legalBasisShort ? (
          <p className="pt-1 border-t border-[color:var(--wp-border)] text-[10px] leading-snug">
            <span className="font-semibold">Interní právní poznámka:</span> {vm.legalBasisShort}
          </p>
        ) : null}
      </div>

      {validityReasons.length > 0 ? (
        <ul className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-[var(--wp-radius)] px-3 py-2 list-disc pl-5">
          {validityReasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      ) : null}

      {officialForm ? (
        <div className="rounded-[var(--wp-radius)] border border-indigo-200 bg-indigo-50/80 p-4 text-sm space-y-3 text-indigo-950">
          <p className="font-bold text-base">{officialForm.title}</p>
          <p className="whitespace-pre-wrap">{officialForm.body}</p>
          <ul className="list-disc pl-5 space-y-1">
            {officialForm.instructionLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="text-xs text-indigo-800/90">
            Doporučené akce: {officialForm.ctaHints.join(" · ")}
          </p>
        </div>
      ) : null}

      {letterPlainText ? (
        <div>
          <p className="text-xs font-semibold text-[color:var(--wp-text-muted)] mb-2">Náhled dopisu</p>
          <pre className="whitespace-pre-wrap rounded-[var(--wp-radius)] border border-[color:var(--wp-border)] bg-[color:var(--wp-surface)] p-4 text-sm text-[color:var(--wp-text)] max-h-[min(480px,55vh)] overflow-y-auto font-sans">
            {letterPlainText}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
