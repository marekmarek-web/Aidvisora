import type {
  DocumentProcessingProvider,
  DocumentProcessingJobType,
  DocumentProcessingStatus,
  DocumentProcessingStage,
  DocumentBusinessStatus,
  DocumentAiInputSource,
  DocumentSourceChannel,
  DocumentInputMode,
} from "db";

export type ProcessingInput = {
  documentId: string;
  tenantId: string;
  storagePath: string;
  mimeType: string | null;
  fileUrl: string;
  pageCount: number | null;
  isScanLike: boolean | null;
  hasTextLayer: boolean | null;
  sourceChannel?: DocumentSourceChannel | null;
};

export type ProcessingOutput = {
  success: boolean;
  outputPath?: string;
  outputContent?: string;
  error?: string;
  providerJobId?: string;
  metadata?: Record<string, unknown>;
};

export interface DocumentProcessingProviderInterface {
  readonly name: DocumentProcessingProvider;
  isEnabled(): boolean;
  runOcr(input: ProcessingInput): Promise<ProcessingOutput>;
  runMarkdown(input: ProcessingInput): Promise<ProcessingOutput>;
  runExtract(input: ProcessingInput): Promise<ProcessingOutput>;
}

export type ProcessingDecision = {
  shouldProcess: boolean;
  runOcr: boolean;
  runMarkdown: boolean;
  runExtract: boolean;
  reason: string;
};

export type OrchestratorResult = {
  success: boolean;
  processingStatus: DocumentProcessingStatus;
  processingStage: DocumentProcessingStage;
  aiInputSource: DocumentAiInputSource;
  ocrPdfPath?: string;
  normalizedPdfPath?: string;
  markdownPath?: string;
  markdownContent?: string;
  extractJsonPath?: string;
  detectedInputMode?: DocumentInputMode;
  readabilityScore?: number;
  preprocessingWarnings?: string[];
  pageTextMap?: Record<number, string>;
  error?: string;
};

/**
 * Standardized internal document representation after Adobe preprocessing.
 * All downstream pipeline stages work over this unified format,
 * regardless of whether the original was a text PDF, scan, or photo.
 */
export type NormalizedDocument = {
  documentId: string;
  tenantId: string;
  sourceChannel: DocumentSourceChannel;
  originalFilePath: string;
  normalizedPdfPath: string | null;
  adobeJobId: string | null;
  adobeProcessingStatus: "pending" | "running" | "completed" | "failed";
  pageCount: number | null;
  inputMode: DocumentInputMode;
  readabilityScore: number;
  preprocessingWarnings: string[];
  extractedPlainText: string | null;
  pageTextMap: Record<number, string>;
  pageImageRefs: string[];
  documentFingerprint: string | null;
  createdAt: Date;
  processedAt: Date | null;
};

export { type DocumentProcessingProvider, type DocumentProcessingJobType, type DocumentBusinessStatus, type DocumentSourceChannel, type DocumentInputMode };
