"use client";

import { useState } from "react";

type ProcessingStatusBadgeProps = {
  documentId: string;
  processingStatus: string | null;
  processingStage: string | null;
  aiInputSource: string | null;
  isScanLike: boolean | null;
  compact?: boolean;
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  none: { label: "Nezpracováno", className: "bg-slate-100 text-slate-600" },
  queued: { label: "Ve frontě", className: "bg-amber-100 text-amber-700" },
  processing: { label: "Zpracovává se", className: "bg-blue-100 text-blue-700 animate-pulse" },
  preprocessing_pending: { label: "Čeká na start", className: "bg-amber-100 text-amber-700" },
  preprocessing_running: { label: "Připravuji", className: "bg-blue-100 text-blue-700 animate-pulse" },
  normalized: { label: "Připraveno", className: "bg-sky-100 text-sky-700" },
  extraction_running: { label: "Extrahuji", className: "bg-blue-100 text-blue-700 animate-pulse" },
  extracted: { label: "Extrahováno", className: "bg-emerald-100 text-emerald-700" },
  review_required: { label: "K revizi", className: "bg-amber-100 text-amber-800" },
  completed: { label: "Zpracováno", className: "bg-emerald-100 text-emerald-700" },
  failed: { label: "Selhalo", className: "bg-red-100 text-red-700" },
  preprocessing_failed: { label: "Příprava selhala", className: "bg-red-100 text-red-700" },
  skipped: { label: "Přeskočeno", className: "bg-slate-100 text-slate-500" },
};

const STAGE_LABELS: Record<string, string> = {
  none: "",
  preprocessing: "Příprava",
  ocr: "OCR",
  markdown: "Markdown",
  extract: "Extrakce",
  extraction: "Extrakce",
  classification: "Klasifikace",
  completed: "Hotovo",
};

const AI_SOURCE_LABELS: Record<string, string> = {
  markdown: "Markdown",
  extract: "Strukturovaná data",
  ocr_text: "OCR text",
  native_text: "Textový PDF",
  none: "Bez zpracování",
};

export function ProcessingStatusBadge({
  documentId,
  processingStatus,
  processingStage,
  aiInputSource,
  isScanLike,
  compact = false,
}: ProcessingStatusBadgeProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const status = processingStatus ?? "none";
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.none;
  const stageLabel = STAGE_LABELS[processingStage ?? "none"] ?? "";
  const aiLabel = AI_SOURCE_LABELS[aiInputSource ?? "none"] ?? "";
  const canRetry = status === "failed" || status === "preprocessing_failed";
  const canTrigger = status === "none" || status === "failed" || status === "preprocessing_failed" || status === "skipped";
  const showStage = status === "processing" || status === "preprocessing_running" || status === "extraction_running";

  async function triggerProcessing() {
    setIsProcessing(true);
    setError(null);
    setInfo(null);
    try {
      const response = await fetch(`/api/documents/${documentId}/process`, { method: "POST" });
      const data = await response.json().catch(() => ({} as { error?: string; message?: string; alreadyProcessing?: boolean }));
      if (response.status === 202 || data.alreadyProcessing) {
        setInfo(data.message ?? "Zpracování už běží.");
        return;
      }
      if (!response.ok) {
        setError(data.error ?? "Zpracování selhalo");
      }
    } catch {
      setError("Síťová chyba");
    } finally {
      setIsProcessing(false);
    }
  }

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${config.className}`}>
        {config.label}
        {showStage && stageLabel ? ` · ${stageLabel}` : ""}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${config.className}`}>
        {config.label}
        {showStage && stageLabel ? ` · ${stageLabel}` : ""}
      </span>

      {status === "completed" && aiLabel ? (
        <span className="text-xs text-slate-500">AI vstup: {aiLabel}</span>
      ) : null}

      {isScanLike ? (
        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">Sken</span>
      ) : null}

      {canTrigger ? (
        <button
          type="button"
          onClick={() => void triggerProcessing()}
          disabled={isProcessing}
          className="min-h-[36px] rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {isProcessing ? "Spouštím…" : canRetry ? "Zkusit znovu" : "Spustit zpracování"}
        </button>
      ) : null}

      {info ? <span className="text-xs text-slate-500">{info}</span> : null}
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
