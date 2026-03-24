"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import {
  buildCalculatorPdf,
  buildCalculatorPdfFilename,
  CALCULATOR_PDF_DISCLAIMER_LINES,
  downloadPdfBytes,
  type CalculatorPdfSection,
} from "@/lib/calculators/pdf";

export interface CalculatorPdfExportButtonProps {
  documentTitle: string;
  /** `aidvisora-{prefix}-{timestamp}.pdf` */
  filePrefix: string;
  getSections: () => CalculatorPdfSection[];
  disabled?: boolean;
}

export function CalculatorPdfExportButton({
  documentTitle,
  filePrefix,
  getSections,
  disabled = false,
}: CalculatorPdfExportButtonProps) {
  const [loading, setLoading] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        if (loading || disabled) return;
        void (async () => {
          setLoading(true);
          try {
            const sections = getSections();
            const bytes = await buildCalculatorPdf({
              documentTitle,
              sections,
              disclaimerLines: [...CALCULATOR_PDF_DISCLAIMER_LINES],
            });
            downloadPdfBytes(bytes, buildCalculatorPdfFilename(filePrefix));
          } catch (e) {
            console.error(e);
          } finally {
            setLoading(false);
          }
        })();
      }}
      disabled={disabled || loading}
      className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-[#e2e8f0] bg-white px-4 py-2.5 text-sm font-semibold text-[#0d1f4e] shadow-sm transition-colors hover:border-blue-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 md:w-auto"
    >
      {loading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : <FileDown className="h-4 w-4 shrink-0" aria-hidden />}
      <span>{loading ? "Generuji…" : "Uložit PDF"}</span>
    </button>
  );
}
