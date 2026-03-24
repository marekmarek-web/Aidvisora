export { processDocument } from "./orchestrator";
export { getProcessingProvider, resetProviderCache } from "./provider";
export { getProcessingConfig, resetConfigCache } from "./config";
export { decideProcessing } from "./heuristics";
export { DisabledProvider } from "./disabled-provider";
export { resolveAiInput, resolveAiInputForDocument } from "./resolve-ai-input";
export { preprocessForAiExtraction } from "./preprocess-for-ai";
export { computeDocumentFingerprint } from "./fingerprint";
export {
  preprocessDocument,
  normalizePdf,
  extractTextAndImages,
  detectScannedDocument,
  estimateOcrConfidenceFromText,
} from "@/lib/documents/adobe-service";
export type { AdobeCanonicalPreprocessOutput, AdobePageImageRef } from "@/lib/documents/adobe-service";
export type {
  DocumentProcessingProviderInterface,
  ProcessingInput,
  ProcessingOutput,
  ProcessingDecision,
  OrchestratorResult,
  NormalizedDocument,
  DocumentBusinessStatus,
  DocumentSourceChannel,
  DocumentInputMode,
} from "./types";
export type { AiInputResolution } from "./resolve-ai-input";
