/**
 * Wave 3 — Vision-primary extraction path for scans.
 *
 * Flag-gated behind `AI_REVIEW_VISION_PRIMARY_FOR_SCAN=true`. Default OFF.
 *
 * Goal: When a PDF is detected as scan / mixed / image-document, stop treating
 * OCR'd text as the primary extraction source and instead extract directly
 * from rendered page images. Text excerpt remains available as a secondary
 * signal in the prompt but is not the extraction target.
 *
 * Design in this PR (shipping flag-OFF):
 * - Pure runner that rasterizes up to N pages and calls
 *   `buildUnifiedExtractionCall(mode="multi_page_vision")` with the same
 *   field-bag schema the full-vision fallback uses today.
 * - Pipeline wiring runs this as a SHADOW pass alongside the text-first path
 *   so production traffic with the flag on can produce diffable traces for
 *   24–48 h before we flip the extraction primacy.
 * - Actual flip of control flow (vision result becomes the base envelope)
 *   is intentionally NOT in this PR — it depends on shadow-diff signal.
 */

import * as Sentry from "@sentry/nextjs";
import { buildUnifiedExtractionCall } from "./unified-multimodal-input";
import { rasterizePdfPageToDataUrl } from "./pdf-page-rasterize";
import type { OpenAICallRoutingOptions } from "@/lib/openai";

/** Same shape the existing full-vision fallback uses — avoids schema drift. */
const VISION_PRIMARY_FIELD_BAG_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["fields"],
  properties: {
    fields: {
      type: "object",
      additionalProperties: {
        type: "object",
        additionalProperties: false,
        required: ["value"],
        properties: {
          value: {},
          confidence: { type: ["number", "null"], minimum: 0, maximum: 1 },
          evidenceSnippet: { type: ["string", "null"] },
        },
      },
    },
  },
};

const VISION_PRIMARY_PROMPT = `Jsi vision-first extrakční systém pro finanční dokumenty.

Dostáváš série stran naskenovaných jako obrázky. NESPOLÉHEJ se na vstupní text
(OCR kvalita je nízká). Čti PŘÍMO obrázky — hlavičky, formulářová pole, razítka,
podpisy, čísla smluv.

Extrahuj standardní kontraktní pole a každé označ confidence a krátkým
evidenceSnippet (≤ 100 znaků) z toho, co doslova vidíš na obrázku.

Preferuj klíče: clientName, personalId, birthDate, iban, bankAccount,
contractNumber, contractDate, policyAmount, premium, productName, advisorName.

Null pro pole které v obrázku nevidíš. Nehádej ani neodvozuj.
Vrátíš pouze JSON dle schema. Žádný markdown.`;

export type VisionPrimaryInput = {
  fileUrl: string;
  pageCount: number;
  /** Max pages to rasterize. Default 5 (same ceiling as full-vision fallback). */
  maxPages?: number;
  routing?: OpenAICallRoutingOptions;
};

export type VisionPrimaryField = {
  value: unknown;
  confidence?: number | null;
  evidenceSnippet?: string | null;
};

export type VisionPrimaryResult = {
  ran: boolean;
  skippedReason?: "flag_off" | "page_count_zero" | "rasterize_failed" | "provider_error";
  fields: Record<string, VisionPrimaryField>;
  pagesUsed: number;
  durationMs: number;
  errorCode?: string | null;
};

export function isVisionPrimaryForScanEnabled(): boolean {
  return process.env.AI_REVIEW_VISION_PRIMARY_FOR_SCAN === "true";
}

export async function runVisionPrimaryExtraction(
  input: VisionPrimaryInput,
  overrideRasterize?: typeof rasterizePdfPageToDataUrl,
): Promise<VisionPrimaryResult> {
  const start = Date.now();
  const empty = {
    ran: false,
    fields: {} as Record<string, VisionPrimaryField>,
    pagesUsed: 0,
    durationMs: 0,
  };

  if (!isVisionPrimaryForScanEnabled()) {
    return { ...empty, skippedReason: "flag_off", durationMs: Date.now() - start };
  }
  if (!input.pageCount || input.pageCount < 1) {
    return { ...empty, skippedReason: "page_count_zero", durationMs: Date.now() - start };
  }
  const maxPages = input.maxPages ?? 5;
  const pagesToRender = Math.min(maxPages, input.pageCount);
  const rasterize = overrideRasterize ?? rasterizePdfPageToDataUrl;

  const urls: string[] = [];
  try {
    for (let p = 1; p <= pagesToRender; p += 1) {
      const r = await rasterize(input.fileUrl, p);
      if (!r?.dataUrl) break;
      urls.push(r.dataUrl);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ran: false,
      skippedReason: "rasterize_failed",
      fields: {},
      pagesUsed: 0,
      durationMs: Date.now() - start,
      errorCode: msg.slice(0, 120),
    };
  }
  if (urls.length === 0) {
    return { ...empty, skippedReason: "rasterize_failed", durationMs: Date.now() - start };
  }

  const unified = await buildUnifiedExtractionCall<{ fields?: Record<string, VisionPrimaryField> }>({
    mode: "multi_page_vision",
    prompt: VISION_PRIMARY_PROMPT,
    routing: input.routing ?? { category: "ai_review" },
    schemaName: "vision_primary_extraction",
    schema: VISION_PRIMARY_FIELD_BAG_SCHEMA,
    pageUrls: urls,
    maxImages: urls.length,
  });

  const durationMs = Date.now() - start;

  if (unified.error) {
    try {
      Sentry.addBreadcrumb({
        category: "ai_review.vision_primary",
        level: "warning",
        message: "vision_primary_failed",
        data: { code: unified.error.code, pagesUsed: urls.length, durationMs },
      });
    } catch {
      /* telemetry best-effort */
    }
    return {
      ran: true,
      skippedReason: "provider_error",
      fields: {},
      pagesUsed: urls.length,
      durationMs,
      errorCode: unified.error.code,
    };
  }

  const fields = unified.parsed?.fields ?? {};
  try {
    Sentry.addBreadcrumb({
      category: "ai_review.vision_primary",
      level: "info",
      message: "vision_primary_ok",
      data: {
        pagesUsed: urls.length,
        fieldCount: Object.keys(fields).length,
        durationMs,
      },
    });
  } catch {
    /* telemetry best-effort */
  }

  return {
    ran: true,
    fields,
    pagesUsed: urls.length,
    durationMs,
  };
}
