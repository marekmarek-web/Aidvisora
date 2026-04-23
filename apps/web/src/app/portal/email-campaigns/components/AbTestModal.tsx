"use client";

import { useState, useTransition } from "react";
import { createAbVariant, launchAbTest } from "@/app/actions/email-ab-testing";

type Props = {
  /** Parent kampaň (varianta A) — musí být uloženým draftem. */
  parentCampaignId: string;
  /** Původní subject — jako výchozí hodnota pro B. */
  originalSubject: string;
  originalPreheader: string;
  onClose: () => void;
  /** Po spuštění voláme callback, aby stránka mohla přesměrovat na detail. */
  onLaunched: (parentCampaignId: string) => void;
};

export default function AbTestModal({
  parentCampaignId,
  originalSubject,
  originalPreheader,
  onClose,
  onLaunched,
}: Props) {
  const [subjectB, setSubjectB] = useState(originalSubject);
  const [preheaderB, setPreheaderB] = useState(originalPreheader);
  const [splitPercent, setSplitPercent] = useState(20);
  const [finalizeMinutes, setFinalizeMinutes] = useState(240);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleLaunch = () => {
    setError(null);
    if (!subjectB.trim()) {
      setError("Vyplňte subject pro variantu B.");
      return;
    }
    if (subjectB.trim() === originalSubject.trim()) {
      setError("Subject B musí být odlišný od varianty A.");
      return;
    }
    startTransition(async () => {
      try {
        await createAbVariant({
          parentCampaignId,
          subjectB: subjectB.trim(),
          preheaderB: preheaderB.trim() || null,
        });
        await launchAbTest({
          parentCampaignId,
          splitPercent,
          pickWinnerAfterMinutes: finalizeMinutes,
        });
        onLaunched(parentCampaignId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Spuštění A/B testu selhalo.");
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[color:var(--wp-surface-card-border)] px-5 py-3">
          <h2 className="text-base font-black text-[color:var(--wp-text)]">A/B test kampaně</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[color:var(--wp-text-tertiary)] hover:bg-[color:var(--wp-main-scroll-bg)]"
            aria-label="Zavřít"
          >
            ×
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div className="rounded-xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-main-scroll-bg)] p-3 text-xs">
            <p className="font-bold text-[color:var(--wp-text)]">Jak A/B test funguje?</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-[color:var(--wp-text-secondary)]">
              <li>
                Variantu A (původní subject) dostane {splitPercent} % příjemců,
                variantu B dalších {splitPercent} %.
              </li>
              <li>
                Po {finalizeMinutes} min cron vybere vítěze podle open rate a
                pošle ho zbývajícím {100 - splitPercent * 2} % (holdout).
              </li>
              <li>Můžete také finalizovat dříve ručně z detailu kampaně.</li>
            </ul>
          </div>

          <div>
            <label className="mb-1 block text-xs font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">
              Subject varianty B
            </label>
            <input
              type="text"
              value={subjectB}
              onChange={(e) => setSubjectB(e.target.value)}
              className="w-full rounded-xl border border-[color:var(--wp-surface-card-border)] bg-white px-3 py-2 text-sm font-bold"
            />
            <p className="mt-1 text-[11px] text-[color:var(--wp-text-tertiary)]">
              Subject A: <span className="font-bold">{originalSubject}</span>
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">
              Preheader varianty B (volitelné)
            </label>
            <input
              type="text"
              value={preheaderB}
              onChange={(e) => setPreheaderB(e.target.value)}
              className="w-full rounded-xl border border-[color:var(--wp-surface-card-border)] bg-white px-3 py-2 text-sm font-bold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">
                Split (%) — A i B dostane
              </label>
              <input
                type="number"
                min={10}
                max={40}
                value={splitPercent}
                onChange={(e) => setSplitPercent(Number(e.target.value))}
                className="w-full rounded-xl border border-[color:var(--wp-surface-card-border)] bg-white px-3 py-2 text-sm font-bold"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">
                Finalizovat po (minutách)
              </label>
              <input
                type="number"
                min={30}
                max={1440}
                value={finalizeMinutes}
                onChange={(e) => setFinalizeMinutes(Number(e.target.value))}
                className="w-full rounded-xl border border-[color:var(--wp-surface-card-border)] bg-white px-3 py-2 text-sm font-bold"
              />
            </div>
          </div>

          {error ? (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
              {error}
            </p>
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
          <button
            type="button"
            onClick={handleLaunch}
            disabled={isPending}
            className="rounded-xl bg-[color:var(--wp-primary)] px-4 py-2 text-sm font-black text-white hover:brightness-110 disabled:opacity-50"
          >
            {isPending ? "Spouštím…" : "Spustit A/B test"}
          </button>
        </div>
      </div>
    </div>
  );
}
