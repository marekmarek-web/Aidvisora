"use client";

import { useState, useTransition } from "react";
import {
  generateCampaignDraft,
  type GeneratedCampaignDraft,
} from "@/app/actions/email-ai-generator";

type Props = {
  /** Pokud je true, editor už má obsah — ukaž confirm před přepisem. */
  editorHasContent: boolean;
  /** Volitelné — ID uloženého draftu (pro logování do ai_generations). */
  campaignId?: string | null;
  onClose: () => void;
  onApply: (draft: GeneratedCampaignDraft) => void;
};

const TONE_OPTIONS = [
  { id: "formal", label: "Formální (vykání, zdvořilé)" },
  { id: "friendly", label: "Osobní (přátelský, ale stále profi)" },
  { id: "urgent", label: "Urgentní (nutná akce, termín)" },
];

const TEMPLATE_KINDS = [
  { id: "", label: "— bez šablony —" },
  { id: "blank", label: "Čistý email" },
  { id: "newsletter", label: "Newsletter s články" },
  { id: "birthday", label: "Narozeninové přání" },
  { id: "year_in_review", label: "Roční přehled" },
  { id: "referral_ask", label: "Žádost o doporučení" },
];

export default function AiDraftModal({ editorHasContent, campaignId, onClose, onApply }: Props) {
  const [goal, setGoal] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("friendly");
  const [templateKind, setTemplateKind] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratedCampaignDraft | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleGenerate = () => {
    setError(null);
    if (!goal.trim()) {
      setError("Uveďte cíl kampaně.");
      return;
    }
    startTransition(async () => {
      try {
        const draft = await generateCampaignDraft({
          goal: goal.trim(),
          audienceDescription: audience.trim() || null,
          baseTemplateKind: templateKind || null,
          toneHints: TONE_OPTIONS.find((t) => t.id === tone)?.label ?? tone,
          campaignId: campaignId ?? null,
        });
        setResult(draft);
      } catch (e) {
        setError(e instanceof Error ? e.message : "AI návrh se nezdařil.");
      }
    });
  };

  const handleApply = () => {
    if (!result) return;
    if (
      editorHasContent &&
      !confirm(
        "Editor obsahuje nějaký text — AI návrh ho přepíše. Opravdu chcete pokračovat?",
      )
    ) {
      return;
    }
    onApply(result);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[color:var(--wp-surface-card-border)] px-5 py-3">
          <h2 className="text-base font-black text-[color:var(--wp-text)]">
            AI návrh kampaně
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[color:var(--wp-text-tertiary)] hover:bg-[color:var(--wp-main-scroll-bg)]"
            aria-label="Zavřít"
          >
            ×
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-auto px-5 py-4">
          <div>
            <label className="mb-1 block text-xs font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">
              Cíl kampaně *
            </label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={3}
              placeholder="Např.: Pozvat klienty na revizi smlouvy a nabídnout jim schůzku v příštím týdnu."
              className="w-full rounded-xl border border-[color:var(--wp-surface-card-border)] bg-white px-3 py-2 text-sm font-bold"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">
              Cílová skupina (volitelné)
            </label>
            <input
              type="text"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="Např.: klienti nad 45 let s životní pojistkou"
              className="w-full rounded-xl border border-[color:var(--wp-surface-card-border)] bg-white px-3 py-2 text-sm font-bold"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">
                Tón
              </label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full rounded-xl border border-[color:var(--wp-surface-card-border)] bg-white px-3 py-2 text-sm font-bold"
              >
                {TONE_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">
                Vycházet ze šablony
              </label>
              <select
                value={templateKind}
                onChange={(e) => setTemplateKind(e.target.value)}
                className="w-full rounded-xl border border-[color:var(--wp-surface-card-border)] bg-white px-3 py-2 text-sm font-bold"
              >
                {TEMPLATE_KINDS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error ? (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
              {error}
            </p>
          ) : null}

          {result ? (
            <div className="space-y-2 rounded-xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-main-scroll-bg)] p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">
                Náhled návrhu
              </p>
              <p className="text-sm font-black text-[color:var(--wp-text)]">
                Předmět: {result.subject}
              </p>
              {result.preheader ? (
                <p className="text-xs italic text-[color:var(--wp-text-secondary)]">
                  {result.preheader}
                </p>
              ) : null}
              <div
                className="max-h-60 overflow-auto rounded-lg border border-[color:var(--wp-surface-card-border)] bg-white p-3 text-xs"
                dangerouslySetInnerHTML={{ __html: result.bodyHtml }}
              />
              {result.notes ? (
                <p className="text-xs text-[color:var(--wp-text-tertiary)]">
                  AI poznámka: {result.notes}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[color:var(--wp-surface-card-border)] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[color:var(--wp-surface-card-border)] bg-white px-4 py-2 text-sm font-bold hover:bg-[color:var(--wp-main-scroll-bg)]"
          >
            Zrušit
          </button>
          {result ? (
            <button
              type="button"
              onClick={handleApply}
              className="rounded-xl bg-[color:var(--wp-primary)] px-4 py-2 text-sm font-black text-white hover:brightness-110"
            >
              Použít návrh
            </button>
          ) : (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isPending || !goal.trim()}
              className="rounded-xl bg-[color:var(--wp-primary)] px-4 py-2 text-sm font-black text-white hover:brightness-110 disabled:opacity-50"
            >
              {isPending ? "Generuji…" : "Vygenerovat"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
