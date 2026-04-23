/**
 * Unified multimodal input builder (Wave 2 of Premium Scan Closeout).
 *
 * Thin routing layer over the 3 multimodal cestas in the OpenAI client:
 *
 *  - `hybrid_pdf_file`     → `createResponseWithFile` (PDF + text prompt)
 *  - `single_page_rescue`  → `createResponseStructuredWithImage` (1 page image + text prompt + JSON schema)
 *  - `multi_page_vision`   → `createResponseStructuredWithImages` (N page images + text prompt + JSON schema)
 *
 * Purpose:
 *
 *  - Give the AI Review pipeline a single place to decide how a given multimodal
 *    call is assembled. Today each cesta has its own call-site with subtly
 *    different options (`schemaName` required/optional, errors thrown vs
 *    swallowed, etc.), which is why Wave 3 (vision-primary) and Wave 4 (AML +
 *    boundary detection) would otherwise add a 4th / 5th call-site with yet
 *    another prompt/schema combination.
 *
 *  - Normalize the output so callers get `{ parsed | null, rawText, sourceKind,
 *    evidenceTier, pagesUsed, durationMs, error? }` regardless of mode.
 *
 * Non-goals (explicitly out of scope for Wave 2):
 *
 *  - Does NOT decide when to call vision / text — that stays in
 *    `ai-review-pipeline-v2.ts` + `vision-fallback-gate.ts`.
 *  - Does NOT transform schemas or prompts. Callers supply both.
 *  - Does NOT swallow model-level rate limits silently — it returns
 *    `{ parsed: null, error: {...} }` so callers can preserve today's
 *    `failedAttempts` / warning behaviour.
 *  - Does NOT redirect `runCombinedMultimodalPass` (image-intake); that path
 *    has its own prompt/schema contract that Wave 3/4 may later harmonize.
 *
 * Feature-gated:
 *
 *  - `AI_REVIEW_UNIFIED_INPUT_BUILDER=true` (default off). Callers check the
 *    env flag at their own call-site and either route through the builder or
 *    fall back to the legacy direct call. This keeps production flow
 *    unchanged until the staging opt-in signs off.
 */
import "server-only";

import * as Sentry from "@sentry/nextjs";

import {
  createResponseStructuredWithImage,
  createResponseStructuredWithImages,
  createResponseWithFile,
  type OpenAICallRoutingOptions,
} from "@/lib/openai";
import type { EvidenceTier } from "./document-review-types";

export type UnifiedExtractionMode =
  | "hybrid_pdf_file"
  | "single_page_rescue"
  | "multi_page_vision";

export type UnifiedExtractionInput = {
  mode: UnifiedExtractionMode;
  /** Text prompt. Required in all modes. */
  prompt: string;
  /** Routing metadata (category, retry). Required. */
  routing: OpenAICallRoutingOptions;
  /** Langfuse / response_format schema name. Required except in `hybrid_pdf_file`. */
  schemaName?: string;
  /** JSON schema for structured output. Required in `single_page_rescue` / `multi_page_vision`. */
  schema?: Record<string, unknown>;

  // Mode-specific inputs (validated in `buildUnifiedExtractionCall`):
  /** `hybrid_pdf_file` — URL of the source PDF (input_file). */
  fileUrl?: string;
  /** `single_page_rescue` — rasterized page data URL or HTTPS URL. */
  imageUrl?: string;
  /** `single_page_rescue` — 1-based page number this image came from. */
  pageNumber?: number;
  /** `multi_page_vision` — rasterized page data URLs or HTTPS URLs. */
  pageUrls?: string[];
  /** `multi_page_vision` — cap on number of images actually sent. */
  maxImages?: number;

  /** Optional secondary signal for Wave 3 vision-primary (unused in W2). */
  pdfTextExcerpt?: string | null;
  /** Optional page count (unused in W2, surfaced on result for telemetry). */
  pageCount?: number | null;
  /** Optional document type hint (routing / telemetry only). */
  documentTypeHint?: string;
};

export type UnifiedExtractionSourceKind =
  | "pdf_input_file"
  | "page_image_fallback"
  | "full_document_vision";

export type UnifiedExtractionResult<T> = {
  /** Parsed JSON. `null` when schema is absent (hybrid_pdf_file without schema) or parse fails. */
  parsed: T | null;
  /** Raw text response (always populated on success). */
  rawText: string;
  /** Which provider cesta actually ran. Maps 1:1 from `mode`. */
  sourceKind: UnifiedExtractionSourceKind;
  /**
   * Suggested `evidenceTier` to apply to fields recovered from this call.
   * `hybrid_pdf_file` returns `null` — the caller decides based on downstream
   * schema parsing (not a "recovered from vision" signal).
   */
  evidenceTierForRecoveredFields:
    | Extract<EvidenceTier, "recovered_from_image" | "recovered_from_full_vision">
    | null;
  /** Number of pages / images actually sent to the model. */
  pagesUsed: number;
  /** Latency in ms (wall clock around the provider call). */
  durationMs: number;
  /** Populated when the provider throws. `parsed` is `null` in that case. */
  error?: { code: string; message: string };
};

// ─── Dependency injection for tests ──────────────────────────────────────────

export type UnifiedExtractionDeps = {
  createResponseWithFile: typeof createResponseWithFile;
  createResponseStructuredWithImage: typeof createResponseStructuredWithImage;
  createResponseStructuredWithImages: typeof createResponseStructuredWithImages;
};

const defaultDeps: UnifiedExtractionDeps = {
  createResponseWithFile,
  createResponseStructuredWithImage,
  createResponseStructuredWithImages,
};

// ─── Main entry ──────────────────────────────────────────────────────────────

/**
 * Dispatch a multimodal call and return a normalized envelope. Never throws —
 * provider errors land in `result.error` with `parsed = null` so callers can
 * preserve their legacy `failedAttempts` / warning bookkeeping.
 */
export async function buildUnifiedExtractionCall<T>(
  input: UnifiedExtractionInput,
  overrideDeps?: Partial<UnifiedExtractionDeps>
): Promise<UnifiedExtractionResult<T>> {
  const deps: UnifiedExtractionDeps = { ...defaultDeps, ...(overrideDeps ?? {}) };
  const start = Date.now();

  let result: UnifiedExtractionResult<T>;
  switch (input.mode) {
    case "hybrid_pdf_file":
      result = await runHybridPdfFile<T>(input, deps, start);
      break;
    case "single_page_rescue":
      result = await runSinglePageRescue<T>(input, deps, start);
      break;
    case "multi_page_vision":
      result = await runMultiPageVision<T>(input, deps, start);
      break;
    default: {
      const _exhaustive: never = input.mode;
      result = {
        parsed: null,
        rawText: "",
        sourceKind: "pdf_input_file",
        evidenceTierForRecoveredFields: null,
        pagesUsed: 0,
        durationMs: Date.now() - start,
        error: { code: "UNSUPPORTED_MODE", message: String(_exhaustive) },
      };
    }
  }

  // Wave 2 AC #6: emit breadcrumb only when the flag is actually on — otherwise
  // defaultDeps.callModel routes through the legacy path and we'd double-count
  // with the existing openai.ts breadcrumbs. Telemetry for W2 adoption lives
  // in `ai_review.unified_extraction`.
  if (isUnifiedInputBuilderEnabled()) {
    try {
      Sentry.addBreadcrumb({
        category: "ai_review.unified_extraction",
        type: "default",
        level: result.error ? "warning" : "info",
        message: result.error
          ? "unified_extraction_failed"
          : "unified_extraction_ok",
        data: {
          mode: input.mode,
          sourceKind: result.sourceKind,
          pagesUsed: result.pagesUsed,
          durationMs: result.durationMs,
          documentTypeHint: input.documentTypeHint,
          errorCode: result.error?.code,
        },
      });
    } catch {
      /* never crash the pipeline on telemetry */
    }
  }

  return result;
}

async function runHybridPdfFile<T>(
  input: UnifiedExtractionInput,
  deps: UnifiedExtractionDeps,
  start: number
): Promise<UnifiedExtractionResult<T>> {
  if (!input.fileUrl) {
    return {
      parsed: null,
      rawText: "",
      sourceKind: "pdf_input_file",
      evidenceTierForRecoveredFields: null,
      pagesUsed: 0,
      durationMs: Date.now() - start,
      error: { code: "MISSING_FILE_URL", message: "hybrid_pdf_file requires fileUrl" },
    };
  }

  try {
    const rawText = await deps.createResponseWithFile(input.fileUrl, input.prompt, {
      routing: input.routing,
    });
    let parsed: T | null = null;
    if (input.schema) {
      try {
        parsed = JSON.parse(rawText) as T;
      } catch {
        // Caller may be expecting a non-JSON response (text path); leave parsed null.
      }
    }
    return {
      parsed,
      rawText,
      sourceKind: "pdf_input_file",
      evidenceTierForRecoveredFields: null,
      pagesUsed: 1,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      parsed: null,
      rawText: "",
      sourceKind: "pdf_input_file",
      evidenceTierForRecoveredFields: null,
      pagesUsed: 0,
      durationMs: Date.now() - start,
      error: errorToShape(err),
    };
  }
}

async function runSinglePageRescue<T>(
  input: UnifiedExtractionInput,
  deps: UnifiedExtractionDeps,
  start: number
): Promise<UnifiedExtractionResult<T>> {
  if (!input.imageUrl || !input.schema) {
    return {
      parsed: null,
      rawText: "",
      sourceKind: "page_image_fallback",
      evidenceTierForRecoveredFields: "recovered_from_image",
      pagesUsed: 0,
      durationMs: Date.now() - start,
      error: {
        code: "MISSING_INPUTS",
        message: "single_page_rescue requires imageUrl and schema",
      },
    };
  }
  try {
    const res = await deps.createResponseStructuredWithImage<T>(
      input.imageUrl,
      input.prompt,
      input.schema,
      {
        schemaName: input.schemaName,
        routing: input.routing,
      }
    );
    return {
      parsed: res.parsed,
      rawText: res.text,
      sourceKind: "page_image_fallback",
      evidenceTierForRecoveredFields: "recovered_from_image",
      pagesUsed: 1,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      parsed: null,
      rawText: "",
      sourceKind: "page_image_fallback",
      evidenceTierForRecoveredFields: "recovered_from_image",
      pagesUsed: 0,
      durationMs: Date.now() - start,
      error: errorToShape(err),
    };
  }
}

async function runMultiPageVision<T>(
  input: UnifiedExtractionInput,
  deps: UnifiedExtractionDeps,
  start: number
): Promise<UnifiedExtractionResult<T>> {
  const urls = Array.isArray(input.pageUrls) ? input.pageUrls : [];
  if (urls.length === 0 || !input.schema) {
    return {
      parsed: null,
      rawText: "",
      sourceKind: "full_document_vision",
      evidenceTierForRecoveredFields: "recovered_from_full_vision",
      pagesUsed: 0,
      durationMs: Date.now() - start,
      error: {
        code: "MISSING_INPUTS",
        message: "multi_page_vision requires non-empty pageUrls and schema",
      },
    };
  }
  try {
    const res = await deps.createResponseStructuredWithImages<T>(
      urls,
      input.prompt,
      input.schema,
      {
        schemaName: input.schemaName,
        routing: input.routing,
        maxImages: input.maxImages,
      }
    );
    return {
      parsed: res.parsed,
      rawText: res.text,
      sourceKind: "full_document_vision",
      evidenceTierForRecoveredFields: "recovered_from_full_vision",
      pagesUsed: Math.min(urls.length, input.maxImages ?? urls.length),
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      parsed: null,
      rawText: "",
      sourceKind: "full_document_vision",
      evidenceTierForRecoveredFields: "recovered_from_full_vision",
      pagesUsed: 0,
      durationMs: Date.now() - start,
      error: errorToShape(err),
    };
  }
}

function errorToShape(err: unknown): { code: string; message: string } {
  if (err instanceof Error) {
    const code = (err as Error & { code?: string }).code ?? "PROVIDER_ERROR";
    return { code: typeof code === "string" ? code : "PROVIDER_ERROR", message: err.message };
  }
  return { code: "PROVIDER_ERROR", message: String(err) };
}

// ─── Feature flag helper ─────────────────────────────────────────────────────

/**
 * Called by legacy call-sites (`page-image-fallback.ts` wrappers) to decide
 * whether to route through the unified builder or stay on the direct call.
 *
 * Default: **false** (off). Set env `AI_REVIEW_UNIFIED_INPUT_BUILDER=true` to
 * opt in on staging. Production flip is Wave 5 (after regression gate).
 */
export function isUnifiedInputBuilderEnabled(): boolean {
  return process.env.AI_REVIEW_UNIFIED_INPUT_BUILDER === "true";
}
