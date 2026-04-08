"use client";

import { FileSignature, Mail, Printer } from "lucide-react";
import { TerminationLetterPreviewPanel } from "./TerminationLetterPreviewPanel";
import type { TerminationLetterBuildResult } from "@/lib/terminations/termination-letter-types";
import { terminationDeliveryChannelLabel } from "@/lib/terminations/client";

type LeftPanelData = {
  clientName: string | null;
  clientSubline?: string | null;
  insurerName: string | null;
  insurerAddress?: string | null;
  contractNumber: string | null;
  terminationModeLabel: string | null;
  effectiveDateLabel: string | null;
  /** Režim do 2 měsíců – datum podání výpovědi. */
  submissionDateLabel?: string | null;
  deliveryChannelHint?: string | null;
};

type Props = {
  requestId: string;
  leftPanel: LeftPanelData;
  onBuildResult?: (data: TerminationLetterBuildResult) => void;
  showPersistButtons?: boolean;
  letterPlainTextDraft: string;
  onLetterPlainTextDraftChange: (plain: string) => void;
  /** ISO yyyy-mm-dd; prázdné = při generování dnešní datum. */
  letterHeaderDateIso: string;
  onLetterHeaderDateIsoChange: (iso: string) => void;
};

export function TerminationFinishOutputLayout({
  requestId,
  leftPanel,
  onBuildResult,
  showPersistButtons = true,
  letterPlainTextDraft,
  onLetterPlainTextDraftChange,
  letterHeaderDateIso,
  onLetterHeaderDateIsoChange,
}: Props) {
  const deliveryLabel = leftPanel.deliveryChannelHint
    ? terminationDeliveryChannelLabel(leftPanel.deliveryChannelHint)
    : null;

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
      {/* Header */}
      <div className="border-b border-slate-100 px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-slate-950">Dokončit výstup</div>
            <div className="mt-1 text-sm text-slate-500">
              Upravte text výpovědi v poli vpravo. „Rychlý náhled tisku“ otevře okno tisku z aktuálního náhledu. Tlačítkem
              „Dokončit žádost“ dole uložíte žádost přes pravidla; „Exportovat PDF“ jen vytiskne / uloží PDF bez změny
              stavu žádosti.
            </div>
          </div>
          <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            Náhled dokumentu
          </div>
        </div>
      </div>

      {/* Grid: left info + right letter preview */}
      <div className="grid gap-6 p-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        {/* Left column */}
        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Klient</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{leftPanel.clientName || "—"}</div>
            {leftPanel.clientSubline ? (
              <div className="mt-1 text-xs text-slate-500">{leftPanel.clientSubline}</div>
            ) : null}
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Instituce</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{leftPanel.insurerName || "—"}</div>
            {leftPanel.insurerAddress ? (
              <div className="mt-1 text-xs leading-5 text-slate-500">{leftPanel.insurerAddress}</div>
            ) : null}
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Souhrn</div>
            <div className="mt-2 space-y-2 text-sm text-slate-700">
              <div>
                <span className="font-medium">Číslo smlouvy:</span> {leftPanel.contractNumber || "—"}
              </div>
              <div>
                <span className="font-medium">Typ ukončení:</span> {leftPanel.terminationModeLabel || "—"}
              </div>
              {leftPanel.submissionDateLabel ? (
                <div>
                  <span className="font-medium">Datum podání:</span> {leftPanel.submissionDateLabel}
                </div>
              ) : null}
              <div>
                <span className="font-medium">Datum účinnosti / podle pravidel:</span>{" "}
                {leftPanel.effectiveDateLabel || "—"}
              </div>
              {deliveryLabel ? (
                <div>
                  <span className="font-medium">Kanál:</span> {deliveryLabel}
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900 p-4 text-white">
            <div className="text-sm font-semibold">Jak postupovat dál</div>
            <div className="mt-3 space-y-3 text-sm text-slate-300">
              <div className="flex gap-3">
                <FileSignature className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
                <span>Zkontrolujte dopis v náhledu vpravo</span>
              </div>
              <div className="flex gap-3">
                <Printer className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
                <span>Export PDF vytiskne aktuální náhled; dokončení žádosti je samostatné tlačítko</span>
              </div>
              <div className="flex gap-3">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
                <span>Po dokončení bude žádost přesunuta ke kontrole nebo k odeslání</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: letter preview */}
        <div className="min-w-0">
          <div className="mb-4">
            <label
              htmlFor="termination-letter-header-date"
              className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Datum v záhlaví dopisu
            </label>
            <input
              id="termination-letter-header-date"
              type="date"
              value={letterHeaderDateIso}
              onChange={(e) => onLetterHeaderDateIsoChange(e.target.value)}
              className="h-11 w-full max-w-xs rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
            />
            <p className="mt-1 text-xs text-slate-500">
              Volitelné – kalendář v prohlížeči. Prázdné pole = v generovaném textu se použije dnešní datum; po výběru
              se první řádek dopisu přepíše.
            </p>
          </div>
          <TerminationLetterPreviewPanel
            requestId={requestId}
            layout="wizardFinish"
            suppressValidityBanner
            onBuildResult={onBuildResult}
            showPersistButtons={showPersistButtons}
            wizardLetterDraft={letterPlainTextDraft}
            onWizardLetterDraftChange={onLetterPlainTextDraftChange}
          />
        </div>
      </div>
    </div>
  );
}
