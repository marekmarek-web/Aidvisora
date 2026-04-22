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
import { createResponseStructuredWithImage } from "@/lib/openai";

/** Cap applied to any confidence returned by the rescue pass. Even a model-reported 0.99 is not trusted here. */
const RECOVERED_CONFIDENCE_CAP = 0.7;
/** Threshold — rescue a field whose primary confidence is strictly below this. */
const LOW_CONFIDENCE_THRESHOLD = 0.5;
/** Hard ceiling — never issue more rescue calls than this per pipeline invocation (cost control). */
const MAX_RESCUES_PER_RUN = 4;

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

function isFieldRescuable(field: ExtractedField | undefined): boolean {
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
  const { envelope, documentType, fileUrl, mimeType, enabled } = input;
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
    if (isFieldRescuable(envelope.extractedFields[key])) {
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

export function __forTests() {
  return {
    RECOVERED_CONFIDENCE_CAP,
    LOW_CONFIDENCE_THRESHOLD,
    MAX_RESCUES_PER_RUN,
    fieldKeyFromRequiredPath,
    isFieldRescuable,
    isPdfUrl,
    buildRescuePrompt,
    applyRescueToField,
  };
}
