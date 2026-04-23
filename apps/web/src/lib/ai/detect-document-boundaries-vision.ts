/**
 * Wave 4.B — Vision-based document boundary detection for multi-doc scans.
 *
 * Flag-gated behind `AI_REVIEW_VISION_BOUNDARY_DETECT=true`. Default OFF.
 *
 * Problem shape: advisor uploads one PDF scan that physically bundles several
 * subdocuments (e.g. smlouva + AML formulář + zdravotní dotazník + modelace).
 * The text-based `document-packet-types` pipeline already has candidate
 * detection, but on scans the OCR quality drops and boundary detection
 * regresses (too many candidates or missed sections). This module adds a
 * vision-first pass that asks the model to identify visible page ranges for
 * each distinct document by looking at rendered page images — headers,
 * letterheads, "strana 1 ze" stamps, form IDs, signature blocks.
 *
 * Design:
 * - Pure function + thin runner. No envelope mutation at this stage.
 * - Uses `buildUnifiedExtractionCall(mode="multi_page_vision")` from W2.
 * - Runs only when `pageCount >= 3` (below that bundles are uninteresting).
 * - Output is attached to the trace for review-queue diagnostics. Wave 4.C
 *   (not in this PR) will consume it to split the envelope per subdocument.
 */

import * as Sentry from "@sentry/nextjs";
import { buildUnifiedExtractionCall } from "./unified-multimodal-input";
import type { OpenAICallRoutingOptions } from "@/lib/openai";

export type DetectedDocumentBoundary = {
  /** 1-based page index where this subdocument starts (inclusive). */
  startPage: number;
  /** 1-based page index where this subdocument ends (inclusive). */
  endPage: number;
  /** Subdocument type — free-form string the model produced. */
  documentType: string;
  /** Short rationale (1 sentence) — e.g. "Strana 1 ze 4 smlouvy o ŽP". */
  rationale?: string | null;
  /** Model-reported confidence 0..1 for this boundary. */
  confidence?: number | null;
};

export type VisionBoundaryDetectionResult = {
  ran: boolean;
  skippedReason?:
    | "flag_off"
    | "page_count_below_threshold"
    | "no_page_images"
    | "provider_error"
    | "empty_output";
  boundaries: DetectedDocumentBoundary[];
  pagesUsed: number;
  durationMs: number;
  /** Sentry-friendly error string when provider failed. */
  errorCode?: string | null;
};

const VISION_BOUNDARY_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["boundaries"],
  properties: {
    boundaries: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["startPage", "endPage", "documentType"],
        properties: {
          startPage: { type: "integer", minimum: 1 },
          endPage: { type: "integer", minimum: 1 },
          documentType: { type: "string" },
          rationale: { type: ["string", "null"] },
          confidence: { type: ["number", "null"], minimum: 0, maximum: 1 },
        },
      },
    },
  },
};

const BOUNDARY_PROMPT = `Jsi vision analytik pro naskenované finanční dokumenty.

Úkol: Podívej se na sérii stran naskenovaných jako jeden PDF balíček a urči,
kde začínají a končí jednotlivé SUBDOKUMENTY (např. smlouva, AML/FATCA,
zdravotní dotazník, modelace, platební instrukce, přílohy).

Signály které používej:
- Změna hlavičky / loga / čísla formuláře.
- Explicitní označení "Strana 1 z N" pro nový dokument.
- Podpisové bloky na konci (typické zakončení subdokumentu).
- Prázdná strana nebo oddělovač mezi sekcemi.
- Změna šablony (smlouva vs. dotazník vs. formulář).

Pravidla:
- Stránkování je 1-based a odpovídá pořadí obrázků, které jsi dostal.
- Rozsahy se NESMÍ překrývat a musí pokrývat celou sekvenci.
- Pokud je celý dokument jeden subdokument, vrať jeden záznam pokrývající
  startPage=1 až endPage=poslední strana.
- documentType je volný string; preferuj: "contract", "aml_fatca_form",
  "health_questionnaire", "modelation", "payment_instructions", "attachment",
  "cover_letter", "unknown".
- rationale: jedna stručná věta, jaký vizuální signál to ohraničil.
- confidence: 0..1 — jak si jsi jistý hranicí.

Vrať pouze JSON dle schema. Žádný markdown, žádný komentář.`;

export function isVisionBoundaryDetectEnabled(): boolean {
  return process.env.AI_REVIEW_VISION_BOUNDARY_DETECT === "true";
}

export type DetectDocumentBoundariesInput = {
  /** Array of data: image URLs (PNG/JPEG base64) for rendered pages, 1-based order. */
  pageImageUrls: string[];
  /** Total page count of the source PDF (≥ pageImageUrls.length). */
  pageCount: number;
  /** Minimum pages required to run the pass. Default 3. */
  minPages?: number;
  /** Cap on how many pages to actually send to the model. Default 8. */
  maxPages?: number;
  /** Optional routing override (tenantId / userId etc.) for OpenAI call. */
  routing?: OpenAICallRoutingOptions;
};

/**
 * Run the vision boundary detection pass. Never throws — errors are returned
 * via `skippedReason` / `errorCode`. The caller is expected to attach the
 * result to the extraction trace and emit a Sentry breadcrumb.
 */
export async function detectDocumentBoundariesVision(
  input: DetectDocumentBoundariesInput,
): Promise<VisionBoundaryDetectionResult> {
  const start = Date.now();
  const base = {
    ran: false,
    boundaries: [] as DetectedDocumentBoundary[],
    pagesUsed: 0,
    durationMs: 0,
  };

  if (!isVisionBoundaryDetectEnabled()) {
    return { ...base, skippedReason: "flag_off", durationMs: Date.now() - start };
  }
  const minPages = input.minPages ?? 3;
  if (input.pageCount < minPages) {
    return {
      ...base,
      skippedReason: "page_count_below_threshold",
      durationMs: Date.now() - start,
    };
  }
  if (!Array.isArray(input.pageImageUrls) || input.pageImageUrls.length === 0) {
    return { ...base, skippedReason: "no_page_images", durationMs: Date.now() - start };
  }
  const maxPages = input.maxPages ?? 8;
  const pages = input.pageImageUrls.slice(0, maxPages);

  const unified = await buildUnifiedExtractionCall<{ boundaries?: DetectedDocumentBoundary[] }>({
    mode: "multi_page_vision",
    prompt: BOUNDARY_PROMPT,
    routing: input.routing ?? { category: "ai_review" },
    schemaName: "vision_boundary_detection",
    schema: VISION_BOUNDARY_SCHEMA,
    pageUrls: pages,
    maxImages: pages.length,
  });

  const durationMs = Date.now() - start;
  if (unified.error) {
    try {
      Sentry.addBreadcrumb({
        category: "ai_review.vision_boundary_detect",
        level: "warning",
        message: "vision_boundary_detect_failed",
        data: { code: unified.error.code, pagesUsed: pages.length, durationMs },
      });
    } catch {
      /* telemetry best-effort */
    }
    return {
      ran: true,
      skippedReason: "provider_error",
      boundaries: [],
      pagesUsed: pages.length,
      durationMs,
      errorCode: unified.error.code,
    };
  }
  const boundaries = unified.parsed?.boundaries ?? [];
  if (boundaries.length === 0) {
    return {
      ran: true,
      skippedReason: "empty_output",
      boundaries: [],
      pagesUsed: pages.length,
      durationMs,
    };
  }

  const clamped = boundaries
    .map((b) => ({
      startPage: Math.max(1, Math.min(input.pageCount, Number(b.startPage) || 1)),
      endPage: Math.max(1, Math.min(input.pageCount, Number(b.endPage) || 1)),
      documentType: String(b.documentType ?? "unknown").trim() || "unknown",
      rationale: b.rationale ?? null,
      confidence:
        typeof b.confidence === "number" && b.confidence >= 0 && b.confidence <= 1
          ? b.confidence
          : null,
    }))
    .filter((b) => b.endPage >= b.startPage);

  try {
    Sentry.addBreadcrumb({
      category: "ai_review.vision_boundary_detect",
      level: "info",
      message: "vision_boundary_detect_ok",
      data: {
        pagesUsed: pages.length,
        boundaryCount: clamped.length,
        durationMs,
        types: clamped.map((b) => b.documentType).slice(0, 10),
      },
    });
  } catch {
    /* telemetry best-effort */
  }

  return {
    ran: true,
    boundaries: clamped,
    pagesUsed: pages.length,
    durationMs,
  };
}
