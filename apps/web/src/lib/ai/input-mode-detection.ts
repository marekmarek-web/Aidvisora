/**
 * Input mode detection for contract pipeline.
 * Distinguishes text PDF, scanned PDF, image, and unsupported.
 */

import { z } from "zod";
import { createResponseWithFile } from "@/lib/openai";

export const INPUT_MODES = ["text_pdf", "scanned_pdf", "image_document", "unsupported"] as const;
export type InputMode = (typeof INPUT_MODES)[number];

export const EXTRACTION_MODES = ["text", "vision_fallback"] as const;
export type ExtractionMode = (typeof EXTRACTION_MODES)[number];

export type InputModeResult = {
  inputMode: InputMode;
  confidence?: number;
  extractionMode: ExtractionMode;
  extractionWarnings: string[];
};

const responseSchema = z.object({
  inputMode: z.enum(INPUT_MODES),
  confidence: z.number().min(0).max(1).optional(),
  reason: z.string().optional(),
});

const DETECTION_PROMPT = `Prohlédni přiložený dokument. Urči, zda jde o:
- text_pdf: PDF s výběrovým textem (textová vrstva)
- scanned_pdf: naskenované PDF (obrázky stránek, bez textové vrstvy)
- image_document: obrázek (JPG, PNG apod.)
- unsupported: nelze určit nebo nepodporovaný formát

Vrať JEDINĚ platný JSON objekt (žádný markdown): { "inputMode": "...", "confidence": 0-1, "reason": "krátký důvod" }.`;

/** MIME types we allow for extraction; others get unsupported without calling the model. */
const ALLOWED_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export async function detectInputMode(
  fileUrl: string,
  mimeType?: string | null
): Promise<InputModeResult> {
  const warnings: string[] = [];
  if (mimeType && !ALLOWED_MIMES.has(mimeType)) {
    return {
      inputMode: "unsupported",
      extractionMode: "vision_fallback",
      extractionWarnings: [`Nepodporovaný typ souboru: ${mimeType}`],
    };
  }

  try {
    const raw = await createResponseWithFile(fileUrl, DETECTION_PROMPT);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : raw;
    const parsed = JSON.parse(jsonStr) as unknown;
    const result = responseSchema.safeParse(parsed);
    if (!result.success) {
      warnings.push("Neplatná odpověď detekce režimu");
      return {
        inputMode: "unsupported",
        confidence: 0,
        extractionMode: "vision_fallback",
        extractionWarnings: warnings,
      };
    }
    const { inputMode, confidence, reason } = result.data;
    const extractionMode: ExtractionMode =
      inputMode === "text_pdf" ? "text" : "vision_fallback";
    if (reason) warnings.push(reason);
    return {
      inputMode,
      confidence,
      extractionMode,
      extractionWarnings: warnings,
    };
  } catch {
    warnings.push("Detekce režimu selhala, použit vision fallback");
    return {
      inputMode: "unsupported",
      extractionMode: "vision_fallback",
      extractionWarnings: warnings,
    };
  }
}
