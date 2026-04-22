/**
 * Page-image fallback for AI Review extraction.
 *
 * When the primary (text / input_file) extraction returns a required field as empty
 * or with low confidence, we rasterize the source page and re-ask the multimodal
 * model for ONLY that field. Recovered values are merged back into the envelope
 * with confidence capped at 0.7 and marked with `evidenceTier: "recovered_from_image"`
 * + `sourceKind: "page_image_fallback"` so downstream code + UI can treat them
 * as advisor-review-mandatory.
 *
 * Feature gated by env `AI_REVIEW_PAGE_IMAGE_FALLBACK=true`. Default OFF so we can
 * roll it out to one tenant at a time after observing first real scans.
 */
import "server-only";

import type { ContractDocumentType } from "./document-classification";
import type { DocumentReviewEnvelope, ExtractedField } from "./document-review-types";
import { selectSchemaForType } from "./document-schema-router";
import { rasterizePdfPageToDataUrl } from "./pdf-page-rasterize";
import {
  createResponseStructuredWithImage,
  createResponseStructuredWithImages,
} from "@/lib/openai";

/** Cap applied to any confidence returned by the rescue pass. Even a model-reported 0.99 is not trusted here. */
const RECOVERED_CONFIDENCE_CAP = 0.7;
/** Threshold — rescue a field whose primary confidence is strictly below this. */
const LOW_CONFIDENCE_THRESHOLD = 0.55;
/** Hard ceiling — never issue more rescue calls than this per pipeline invocation (cost control). */
const MAX_RESCUES_PER_RUN = 8;
/** Default max pages sent in the full-document vision safety-net (env override). */
const DEFAULT_FULL_VISION_MAX_PAGES = 6;

export type PageImageFallbackDeps = {
  rasterizePage: typeof rasterizePdfPageToDataUrl;
  callModel: <T>(
    imageUrl: string,
    textPrompt: string,
    jsonSchema: Record<string, unknown>,
    options?: { schemaName?: string; routing?: { category?: string } }
  ) => Promise<{ parsed: T; text: string }>;
};

const defaultDeps: PageImageFallbackDeps = {
  rasterizePage: rasterizePdfPageToDataUrl,
  callModel: async (imageUrl, textPrompt, jsonSchema, options) => {
    const res = await createResponseStructuredWithImage<unknown>(
      imageUrl,
      textPrompt,
      jsonSchema,
      { schemaName: options?.schemaName, routing: options?.routing as never }
    );
    return { parsed: res.parsed as never, text: res.text };
  },
};

export type PageImageFallbackInput = {
  envelope: DocumentReviewEnvelope;
  documentType: ContractDocumentType;
  fileUrl: string | null | undefined;
  mimeType?: string | null;
  /** Env / tenant flag — pass the already-resolved boolean. */
  enabled: boolean;
  /**
   * When true, also treat text-only inferred values as rescuable (used on
   * scan PDFs where the text layer is garbled and we don't trust the value).
   */
  aggressiveForScan?: boolean;
};

export type PageImageFallbackResult = {
  envelope: DocumentReviewEnvelope;
  recoveredFieldKeys: string[];
  failedAttempts: number;
  skippedReason?:
    | "disabled"
    | "no_file_url"
    | "non_pdf"
    | "no_schema_required"
    | "no_missing_required"
    | "rasterize_unavailable";
};

type RescueSchemaJson = Record<string, unknown>;

const RESCUE_JSON_SCHEMA: RescueSchemaJson = {
  type: "object",
  properties: {
    value: {
      anyOf: [
        { type: "string" },
        { type: "number" },
        { type: "boolean" },
        { type: "null" },
      ],
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    evidenceSnippet: { type: "string", maxLength: 400 },
    found: { type: "boolean" },
  },
  required: ["value", "found"],
  additionalProperties: false,
};

function fieldKeyFromRequiredPath(requiredPath: string): string | null {
  // required rules look like "extractedFields.policyStartDate"
  const prefix = "extractedFields.";
  if (!requiredPath.startsWith(prefix)) return null;
  const key = requiredPath.slice(prefix.length);
  if (!key || key.includes(".")) return null; // skip compound / conditional rules
  return key;
}

function isPdfUrl(url: string | null | undefined, mimeType?: string | null): boolean {
  if (!url) return false;
  if (mimeType && mimeType.toLowerCase().includes("pdf")) return true;
  try {
    const u = new URL(url);
    return u.pathname.toLowerCase().endsWith(".pdf");
  } catch {
    return url.toLowerCase().endsWith(".pdf");
  }
}

function isFieldRescuable(
  field: ExtractedField | undefined,
  options?: { aggressiveForScan?: boolean }
): boolean {
  if (!field) return true; // missing entirely → rescue
  const value = field.value;
  const confidence = typeof field.confidence === "number" ? field.confidence : undefined;
  const status = field.status;
  const hasValue =
    value !== null &&
    value !== undefined &&
    !(typeof value === "string" && value.trim() === "");
  if (!hasValue) return true;
  if (status === "missing" || status === "not_applicable") return true;
  if (confidence !== undefined && confidence < LOW_CONFIDENCE_THRESHOLD) return true;
  // In scan mode, we also aggressively rescue text-only-inferred values since
  // the text layer is likely garbled — vision is more reliable than whatever
  // the model guessed from the OCR noise.
  if (options?.aggressiveForScan) {
    const tier = field.evidenceTier;
    if (
      tier === "model_inference_only" ||
      tier === "classifier_fallback" ||
      tier === "local_inference" ||
      tier === "cross_section_inference"
    ) {
      return true;
    }
  }
  return false;
}

function humanFieldLabel(fieldKey: string): string {
  // minimalistic — the LLM works fine with camelCase, but a friendly label helps grounding
  return fieldKey
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function buildRescuePrompt(fieldKey: string, documentType: ContractDocumentType): string {
  const label = humanFieldLabel(fieldKey);
  return [
    `Tohle je jedna stránka dokumentu typu "${documentType}" (naskenovaná smlouva nebo formulář).`,
    `Extrahuj POUZE hodnotu pro pole "${fieldKey}" (${label}).`,
    "Pokud hodnota na stránce není, vrať found=false a value=null. NEHÁDEJ.",
    "Pokud hodnotu najdeš, vrať found=true, value (string/number/boolean),",
    "confidence (0-1), a evidenceSnippet — max 240 znaků textu ze stránky, ze kterého jsi hodnotu přečetl.",
    "Vrať POUZE JSON podle schématu. Žádný další text.",
  ].join(" ");
}

type RescueModelOutput = {
  value?: unknown;
  confidence?: number;
  evidenceSnippet?: string;
  found?: boolean;
};

function applyRescueToField(
  envelope: DocumentReviewEnvelope,
  fieldKey: string,
  parsed: RescueModelOutput,
  pageNumber: number
): boolean {
  if (!parsed || parsed.found === false) return false;
  const rawValue = parsed.value;
  const hasMeaningfulValue =
    rawValue !== null &&
    rawValue !== undefined &&
    !(typeof rawValue === "string" && rawValue.trim() === "");
  if (!hasMeaningfulValue) return false;

  const rawConfidence =
    typeof parsed.confidence === "number" && parsed.confidence >= 0 && parsed.confidence <= 1
      ? parsed.confidence
      : 0.6;
  const cappedConfidence = Math.min(rawConfidence, RECOVERED_CONFIDENCE_CAP);
  const snippet =
    typeof parsed.evidenceSnippet === "string"
      ? parsed.evidenceSnippet.slice(0, 380)
      : undefined;

  const prior = envelope.extractedFields[fieldKey];
  const merged: ExtractedField = {
    ...(prior ?? { status: "extracted" }),
    value: rawValue,
    confidence: cappedConfidence,
    status: "extracted",
    evidenceTier: "recovered_from_image",
    sourceKind: "page_image_fallback",
    sourcePage: pageNumber,
    ...(snippet ? { evidenceSnippet: snippet } : {}),
  };
  envelope.extractedFields[fieldKey] = merged;
  return true;
}

/**
 * Main entry point — called from the AI Review v2 pipeline after `finalizeContractPayload`.
 *
 * Returns the (possibly) mutated envelope + names of rescued fields for trace logging.
 * Never throws — on any hard error returns the original envelope.
 */
export async function runPageImageFallbackForMissingRequired(
  input: PageImageFallbackInput,
  overrideDeps?: Partial<PageImageFallbackDeps>
): Promise<PageImageFallbackResult> {
  const { envelope, documentType, fileUrl, mimeType, enabled, aggressiveForScan } = input;
  const deps: PageImageFallbackDeps = { ...defaultDeps, ...(overrideDeps ?? {}) };

  if (!enabled) {
    return { envelope, recoveredFieldKeys: [], failedAttempts: 0, skippedReason: "disabled" };
  }
  if (!fileUrl) {
    return { envelope, recoveredFieldKeys: [], failedAttempts: 0, skippedReason: "no_file_url" };
  }
  if (!isPdfUrl(fileUrl, mimeType)) {
    return { envelope, recoveredFieldKeys: [], failedAttempts: 0, skippedReason: "non_pdf" };
  }

  const schema = selectSchemaForType(documentType);
  const requiredPaths = schema?.extractionRules?.required ?? [];
  if (requiredPaths.length === 0) {
    return {
      envelope,
      recoveredFieldKeys: [],
      failedAttempts: 0,
      skippedReason: "no_schema_required",
    };
  }

  const candidateKeys: string[] = [];
  for (const path of requiredPaths) {
    const key = fieldKeyFromRequiredPath(path);
    if (!key) continue;
    if (candidateKeys.includes(key)) continue;
    if (isFieldRescuable(envelope.extractedFields[key], { aggressiveForScan })) {
      candidateKeys.push(key);
    }
    if (candidateKeys.length >= MAX_RESCUES_PER_RUN) break;
  }

  if (candidateKeys.length === 0) {
    return {
      envelope,
      recoveredFieldKeys: [],
      failedAttempts: 0,
      skippedReason: "no_missing_required",
    };
  }

  const recoveredFieldKeys: string[] = [];
  let failedAttempts = 0;

  for (const fieldKey of candidateKeys) {
    const priorField = envelope.extractedFields[fieldKey];
    const pageNumber = priorField?.sourcePage ?? 1;

    const rasterized = await deps.rasterizePage(fileUrl, pageNumber);
    if (!rasterized) {
      if (pageNumber === 1) {
        // If first page can't even be rasterized, the whole mechanism is unavailable; abort early.
        return {
          envelope,
          recoveredFieldKeys,
          failedAttempts,
          skippedReason: "rasterize_unavailable",
        };
      }
      // Fall back to page 1 for subsequent fields that pointed elsewhere.
      const page1 = await deps.rasterizePage(fileUrl, 1);
      if (!page1) {
        failedAttempts += 1;
        continue;
      }
      const parsed = await safeCallModel(deps, page1.dataUrl, fieldKey, documentType);
      if (parsed && applyRescueToField(envelope, fieldKey, parsed, 1)) {
        recoveredFieldKeys.push(fieldKey);
      } else {
        failedAttempts += 1;
      }
      continue;
    }

    const parsed = await safeCallModel(deps, rasterized.dataUrl, fieldKey, documentType);
    if (parsed && applyRescueToField(envelope, fieldKey, parsed, rasterized.pageNumber)) {
      recoveredFieldKeys.push(fieldKey);
    } else {
      failedAttempts += 1;
    }
  }

  return { envelope, recoveredFieldKeys, failedAttempts };
}

async function safeCallModel(
  deps: PageImageFallbackDeps,
  imageDataUrl: string,
  fieldKey: string,
  documentType: ContractDocumentType
): Promise<RescueModelOutput | null> {
  try {
    const { parsed } = await deps.callModel<RescueModelOutput>(
      imageDataUrl,
      buildRescuePrompt(fieldKey, documentType),
      RESCUE_JSON_SCHEMA,
      { schemaName: "page_image_field_rescue", routing: { category: "ai_review" } }
    );
    return parsed ?? null;
  } catch (e) {
    console.warn("[page-image-fallback] rescue call failed", {
      fieldKey,
      documentType,
      message: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

// ── Full-document vision safety net ────────────────────────────────────────
//
// `runPageImageFallbackForMissingRequired` targets a single missing field.
// When the entire text path fails (garbled OCR text layer), we instead send
// the first N rasterized pages as a single multimodal call and ask the model
// to return a bag of JSON key/value pairs. This is the "nuclear option" used
// only when the file-multimodal path (`createResponseWithFile`) is unavailable
// or returned nothing usable.

/** Return all required field keys from the schema router for a given type. */
function getRequiredFieldKeys(documentType: ContractDocumentType): string[] {
  const schema = selectSchemaForType(documentType);
  const required = schema?.extractionRules?.required ?? [];
  const out: string[] = [];
  for (const path of required) {
    const key = fieldKeyFromRequiredPath(path);
    if (key && !out.includes(key)) out.push(key);
  }
  return out;
}

function getFullVisionMaxPages(): number {
  const raw = process.env.AI_REVIEW_FULL_VISION_MAX_PAGES;
  if (!raw) return DEFAULT_FULL_VISION_MAX_PAGES;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_FULL_VISION_MAX_PAGES;
  return Math.min(10, Math.floor(parsed));
}

function buildFullVisionPrompt(
  documentType: ContractDocumentType,
  requiredKeys: string[]
): string {
  const keysList = requiredKeys.slice(0, 18).join(", ");
  return [
    `Tohle jsou naskenované stránky dokumentu typu "${documentType}".`,
    "Dokument nelze přečíst z textové vrstvy (PDF má garbled OCR). Přečti ho přímo z obrázků.",
    `Extrahuj hodnoty pro tato pole (klíče v camelCase): ${keysList || "(všechna rozpoznatelná pole smlouvy)"}.`,
    "Vrať POUZE JSON ve tvaru: {\"fields\":{\"<key>\":{\"value\":<string|number|null>,\"confidence\":0..1,\"evidenceSnippet\":\"<max 240 znaků>\"}}}.",
    "Pokud hodnotu nenajdeš, pole VYNECHEJ. NEHÁDEJ. Piš přesně, jak je to v dokumentu (jména, čísla, data).",
  ].join(" ");
}

const FULL_VISION_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    fields: {
      type: "object",
      additionalProperties: {
        type: "object",
        properties: {
          value: {
            anyOf: [
              { type: "string" },
              { type: "number" },
              { type: "boolean" },
              { type: "null" },
            ],
          },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          evidenceSnippet: { type: "string", maxLength: 400 },
        },
        required: ["value"],
      },
    },
  },
  required: ["fields"],
  additionalProperties: false,
};

export type FullDocumentVisionInput = {
  fileUrl: string;
  documentType: ContractDocumentType;
  mimeType?: string | null;
  maxPages?: number;
  /** Existing envelope to merge results into. Must not be null. */
  envelope: DocumentReviewEnvelope;
};

export type FullDocumentVisionResult = {
  envelope: DocumentReviewEnvelope;
  mergedFieldKeys: string[];
  pagesUsed: number;
  skippedReason?:
    | "non_pdf"
    | "no_pages_rasterized"
    | "model_call_failed"
    | "no_required_fields";
};

/**
 * Rasterize the first N pages of a PDF and ask the multimodal model to return
 * as many required fields as possible. Intended as a last-resort path when
 * neither the text prompt nor `createResponseWithFile` produced a usable result
 * for a scan-only PDF with a garbled text layer.
 */
export async function runFullDocumentVisionExtraction(
  input: FullDocumentVisionInput
): Promise<FullDocumentVisionResult> {
  const { fileUrl, documentType, mimeType, envelope } = input;

  if (!isPdfUrl(fileUrl, mimeType)) {
    return { envelope, mergedFieldKeys: [], pagesUsed: 0, skippedReason: "non_pdf" };
  }

  const requiredKeys = getRequiredFieldKeys(documentType);
  if (requiredKeys.length === 0) {
    return { envelope, mergedFieldKeys: [], pagesUsed: 0, skippedReason: "no_required_fields" };
  }

  const maxPages = input.maxPages ?? getFullVisionMaxPages();
  const pageUrls: string[] = [];
  for (let p = 1; p <= maxPages; p++) {
    const ras = await rasterizePdfPageToDataUrl(fileUrl, p);
    if (!ras) {
      // first-page failure means rasterisation is broken — give up early
      if (p === 1) break;
      continue;
    }
    pageUrls.push(ras.dataUrl);
  }
  if (pageUrls.length === 0) {
    return { envelope, mergedFieldKeys: [], pagesUsed: 0, skippedReason: "no_pages_rasterized" };
  }

  const prompt = buildFullVisionPrompt(documentType, requiredKeys);
  let parsed: { fields?: Record<string, { value?: unknown; confidence?: number; evidenceSnippet?: string }> } | null = null;
  try {
    const res = await createResponseStructuredWithImages<{
      fields?: Record<string, { value?: unknown; confidence?: number; evidenceSnippet?: string }>;
    }>(pageUrls, prompt, FULL_VISION_JSON_SCHEMA, {
      schemaName: "full_document_vision_extraction",
      routing: { category: "ai_review" },
      maxImages: Math.min(pageUrls.length, 5),
    });
    parsed = res.parsed ?? null;
  } catch (e) {
    console.warn("[full-vision-extraction] model call failed", {
      documentType,
      pagesTried: pageUrls.length,
      message: e instanceof Error ? e.message : String(e),
    });
    return {
      envelope,
      mergedFieldKeys: [],
      pagesUsed: pageUrls.length,
      skippedReason: "model_call_failed",
    };
  }

  const mergedFieldKeys: string[] = [];
  const fields = parsed?.fields ?? {};
  for (const [key, cell] of Object.entries(fields)) {
    if (!key || typeof key !== "string") continue;
    const rawValue = cell?.value;
    const hasValue =
      rawValue !== null &&
      rawValue !== undefined &&
      !(typeof rawValue === "string" && rawValue.trim() === "");
    if (!hasValue) continue;

    const rawConf = typeof cell?.confidence === "number" ? cell.confidence : 0.55;
    const capped = Math.min(Math.max(0, rawConf), 0.8);
    const snippet = typeof cell?.evidenceSnippet === "string"
      ? cell.evidenceSnippet.slice(0, 380)
      : undefined;

    const prior = envelope.extractedFields[key];
    // Only overwrite when we either have no prior, or the prior was empty / lower confidence.
    const priorConfidence = typeof prior?.confidence === "number" ? prior.confidence : -1;
    const priorHasValue =
      prior?.value !== null &&
      prior?.value !== undefined &&
      !(typeof prior?.value === "string" && prior.value.trim() === "");
    if (priorHasValue && priorConfidence >= capped) {
      continue;
    }

    const merged: ExtractedField = {
      ...(prior ?? { status: "extracted" }),
      value: rawValue as ExtractedField["value"],
      confidence: capped,
      status: "extracted",
      evidenceTier: "recovered_from_full_vision",
      sourceKind: "full_document_vision",
      ...(snippet ? { evidenceSnippet: snippet } : {}),
    };
    envelope.extractedFields[key] = merged;
    mergedFieldKeys.push(key);
  }

  return {
    envelope,
    mergedFieldKeys,
    pagesUsed: pageUrls.length,
  };
}

export function __forTests() {
  return {
    RECOVERED_CONFIDENCE_CAP,
    LOW_CONFIDENCE_THRESHOLD,
    MAX_RESCUES_PER_RUN,
    DEFAULT_FULL_VISION_MAX_PAGES,
    fieldKeyFromRequiredPath,
    isFieldRescuable,
    isPdfUrl,
    buildRescuePrompt,
    applyRescueToField,
    buildFullVisionPrompt,
    FULL_VISION_JSON_SCHEMA,
  };
}
