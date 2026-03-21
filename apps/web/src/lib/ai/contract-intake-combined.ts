/**
 * Single OpenAI pass for input-mode detection + document classification.
 * Saves one full file round-trip vs sequential detectInputMode + classifyContractDocument.
 */

import { z } from "zod";
import { createResponseWithFile } from "@/lib/openai";
import {
  INPUT_MODES,
  type InputModeResult,
  type ExtractionMode,
} from "./input-mode-detection";
import { CONTRACT_DOCUMENT_TYPES, type ClassificationResult } from "./document-classification";

const ALLOWED_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const combinedSchema = z.object({
  inputMode: z.enum(INPUT_MODES),
  inputConfidence: z.number().min(0).max(1).optional(),
  inputReason: z.string().optional(),
  documentType: z.enum(CONTRACT_DOCUMENT_TYPES),
  classificationConfidence: z.number().min(0).max(1),
  reasons: z.array(z.string()),
});

const COMBINED_PROMPT = `Prohlédni přiložený dokument a vrať JEDINĚ platný JSON objekt (žádný markdown, žádný úvod).

Část A — režim dokumentu (inputMode):
- text_pdf: PDF s výběrovým textem (textová vrstva)
- scanned_pdf: naskenované PDF (stránky jako obrázky)
- image_document: obrázek (JPG/PNG apod.)
- unsupported: nelze určit nebo nepodporovaný formát

Část B — typ smluvního dokumentu (documentType), přesně jedna z hodnot:
"insurance_contract", "investment_contract", "loan_or_mortgage_contract", "amendment", "application_or_proposal", "payment_document", "terms_and_conditions", "unknown"

JSON tvar:
{
  "inputMode": "...",
  "inputConfidence": 0-1,
  "inputReason": "krátký důvod pro režim",
  "documentType": "...",
  "classificationConfidence": 0-1,
  "reasons": ["krátké důvody pro typ dokumentu"]
}`;

function mimeBlockedResult(mimeType: string): {
  input: InputModeResult;
  classification: ClassificationResult;
} {
  return {
    input: {
      inputMode: "unsupported",
      extractionMode: "vision_fallback",
      extractionWarnings: [`Nepodporovaný typ souboru: ${mimeType}`],
    },
    classification: {
      documentType: "unknown",
      confidence: 0,
      reasons: ["Nepodporovaný MIME typ"],
    },
  };
}

/**
 * Returns both intake results in one model call, or `null` if the response should not be trusted (caller runs sequential fallback).
 */
export async function runCombinedContractIntake(
  fileUrl: string,
  mimeType?: string | null
): Promise<{ input: InputModeResult; classification: ClassificationResult } | null> {
  if (mimeType && !ALLOWED_MIMES.has(mimeType)) {
    return mimeBlockedResult(mimeType);
  }

  try {
    const raw = await createResponseWithFile(fileUrl, COMBINED_PROMPT);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : raw;
    let parsedUnknown: unknown;
    try {
      parsedUnknown = JSON.parse(jsonStr);
    } catch {
      return null;
    }
    const parsed = combinedSchema.safeParse(parsedUnknown);
    if (!parsed.success) {
      return null;
    }
    const d = parsed.data;
    const extractionMode: ExtractionMode = d.inputMode === "text_pdf" ? "text" : "vision_fallback";
    const extractionWarnings: string[] = [];
    if (d.inputReason) extractionWarnings.push(d.inputReason);

    const input: InputModeResult = {
      inputMode: d.inputMode,
      confidence: d.inputConfidence,
      extractionMode,
      extractionWarnings,
    };
    const classification: ClassificationResult = {
      documentType: d.documentType,
      confidence: d.classificationConfidence,
      reasons: d.reasons.length ? d.reasons : ["Klasifikace z kombinovaného kroku"],
    };
    return { input, classification };
  } catch {
    return null;
  }
}
