/**
 * Server-side contract upload pipeline.
 * Flow: upload file -> storage -> DB metadata -> AI extraction (input_file) -> draft actions -> review queue.
 */

/** Supported input for extraction: file ID (OpenAI), URL (signed), or base64. Primary flow uses URL. */
export type ContractFileInput =
  | { type: "file_id"; fileId: string }
  | { type: "url"; url: string }
  | { type: "base64"; data: string; mimeType: string };

export interface ContractUploadMetadata {
  id: string;
  tenantId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  uploadedAt: string; // ISO
  extractionId?: string | null;
}

export interface ContractStorageService {
  upload(tenantId: string, file: Buffer | Blob, fileName: string): Promise<string>;
  getUrl(storageKey: string, expiresInSeconds?: number): Promise<string>;
}

export type ContractUploadResult =
  | { ok: true; metadata: ContractUploadMetadata }
  | { ok: false; error: string };

/**
 * TODO: Extension point – normalise DOC/DOCX/JPG/PNG to PDF for consistent extraction.
 * Primary flow is PDF; other formats could be converted server-side before upload or before extraction.
 */
export async function normaliseContractFileToPdf(
  _input: ContractFileInput
): Promise<{ ok: true; pdfUrl: string } | { ok: false; error: string }> {
  return { ok: false, error: "Normalisation to PDF not implemented." };
}
