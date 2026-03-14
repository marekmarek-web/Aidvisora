import type { ExtractedContractSchema } from "./extraction-schemas";
import { runContractUnderstandingPipeline } from "./contract-understanding-pipeline";

export type ContractExtractionSuccess = {
  ok: true;
  data: ExtractedContractSchema;
};

export type ContractExtractionError = {
  ok: false;
  code: "OPENAI_ERROR" | "VALIDATION_FAILED";
  message: string;
  details?: unknown;
};

export type ContractExtractionResult = ContractExtractionSuccess | ContractExtractionError;

/**
 * Extract contract data from a document via the full understanding pipeline.
 * Backward-compatible wrapper: returns the same shape as before (data compatible with ExtractedContractSchema).
 */
export async function extractContractFromFile(fileUrl: string, mimeType?: string | null): Promise<ContractExtractionResult> {
  const result = await runContractUnderstandingPipeline(fileUrl, mimeType);
  if (!result.ok) {
    return {
      ok: false,
      code: "OPENAI_ERROR",
      message: result.errorMessage,
      details: result.details,
    };
  }
  return {
    ok: true,
    data: result.extractedPayload as ExtractedContractSchema,
  };
}
