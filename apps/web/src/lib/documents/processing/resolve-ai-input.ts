import { documents, eq, and } from "db";
import { withTenantContext } from "@/lib/db/with-tenant-context";
import { createAdminClient } from "@/lib/supabase/server";
import { createSignedStorageUrl } from "@/lib/storage/signed-url";
import type { DocumentAiInputSource } from "db";

export type AiInputResolution = {
  source: DocumentAiInputSource;
  fileUrl: string | null;
  textContent: string | null;
  quality: "high" | "medium" | "low" | "none";
  warning: string | null;
  readabilityScore: number | null;
  preprocessingWarnings: string[] | null;
  adobePreprocessed: boolean;
};

type DocumentForAi = {
  id: string;
  tenantId: string;
  storagePath: string;
  mimeType: string | null;
  processingStatus: string | null;
  aiInputSource: string | null;
  markdownContent: string | null;
  markdownPath: string | null;
  ocrPdfPath: string | null;
  extractJsonPath: string | null;
  hasTextLayer: boolean | null;
  isScanLike: boolean | null;
  normalizedPdfPath?: string | null;
  readabilityScore?: number | null;
  preprocessingWarnings?: string[] | null;
  processingProvider?: string | null;
};

async function getSignedUrl(path: string): Promise<string | null> {
  const admin = createAdminClient();
  const { signedUrl } = await createSignedStorageUrl({
    adminClient: admin,
    bucket: "documents",
    path,
    purpose: "internal_processing",
  });
  return signedUrl;
}

async function readStorageText(path: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("documents").download(path);
  if (error || !data) return null;
  return data.text();
}

/**
 * Resolve the best available AI input for a document.
 * Priority: Markdown > Extract JSON > OCR PDF > Normalized PDF > Original file
 */
export async function resolveAiInput(doc: DocumentForAi): Promise<AiInputResolution> {
  const adobePreprocessed = doc.processingProvider === "adobe" && doc.processingStatus === "completed";
  const readabilityScore = doc.readabilityScore ?? null;
  const preprocessingWarnings = doc.preprocessingWarnings ?? null;

  if (doc.markdownContent && doc.markdownContent.trim().length > 50) {
    return {
      source: "markdown",
      fileUrl: null,
      textContent: doc.markdownContent,
      quality: "high",
      warning: null,
      readabilityScore,
      preprocessingWarnings,
      adobePreprocessed,
    };
  }

  if (doc.markdownPath) {
    const text = await readStorageText(doc.markdownPath);
    if (text && text.trim().length > 50) {
      return {
        source: "markdown",
        fileUrl: null,
        textContent: text,
        quality: "high",
        warning: null,
        readabilityScore,
        preprocessingWarnings,
        adobePreprocessed,
      };
    }
  }

  if (doc.extractJsonPath) {
    const url = await getSignedUrl(doc.extractJsonPath);
    if (url) {
      return {
        source: "extract",
        fileUrl: url,
        textContent: null,
        quality: "medium",
        warning: null,
        readabilityScore,
        preprocessingWarnings,
        adobePreprocessed,
      };
    }
  }

  if (doc.ocrPdfPath) {
    const url = await getSignedUrl(doc.ocrPdfPath);
    if (url) {
      return {
        source: "ocr_text",
        fileUrl: url,
        textContent: null,
        quality: "medium",
        warning: null,
        readabilityScore,
        preprocessingWarnings,
        adobePreprocessed,
      };
    }
  }

  if (doc.normalizedPdfPath) {
    const url = await getSignedUrl(doc.normalizedPdfPath);
    if (url) {
      return {
        source: "ocr_text",
        fileUrl: url,
        textContent: null,
        quality: "medium",
        warning: null,
        readabilityScore,
        preprocessingWarnings,
        adobePreprocessed,
      };
    }
  }

  if (doc.hasTextLayer) {
    const url = await getSignedUrl(doc.storagePath);
    return {
      source: "native_text",
      fileUrl: url,
      textContent: null,
      quality: "medium",
      warning: null,
      readabilityScore,
      preprocessingWarnings,
      adobePreprocessed,
    };
  }

  const url = await getSignedUrl(doc.storagePath);
  const isScan = doc.isScanLike;
  const processingFailed = doc.processingStatus === "failed" || doc.processingStatus === "preprocessing_failed";

  return {
    source: "none",
    fileUrl: url,
    textContent: null,
    quality: isScan ? "low" : "medium",
    warning: processingFailed
      ? "Zpracování dokumentu selhalo. AI analýza poběží v omezeném režimu."
      : isScan
        ? "Dokument je sken bez textové vrstvy. AI analýza bude omezená."
        : null,
    readabilityScore,
    preprocessingWarnings,
    adobePreprocessed,
  };
}

/**
 * Load a document row and resolve AI input in one call.
 *
 * Security (W3 IDOR fix, WS-2 Batch 2): `tenantId` je povinný parametr — dokument se dohledá
 * pouze v rámci tenantu volajícího. Bez něj by bylo možné přes cizí `documentId` stáhnout
 * signed URL / markdown obsah dokumentu jiného tenantu.
 */
export async function resolveAiInputForDocument(
  documentId: string,
  tenantId: string,
): Promise<AiInputResolution | null> {
  if (!tenantId) {
    throw new Error("resolveAiInputForDocument: tenantId is required.");
  }
  const [doc] = await withTenantContext({ tenantId }, (tx) =>
    tx
    .select({
      id: documents.id,
      tenantId: documents.tenantId,
      storagePath: documents.storagePath,
      mimeType: documents.mimeType,
      processingStatus: documents.processingStatus,
      aiInputSource: documents.aiInputSource,
      markdownContent: documents.markdownContent,
      markdownPath: documents.markdownPath,
      ocrPdfPath: documents.ocrPdfPath,
      extractJsonPath: documents.extractJsonPath,
      hasTextLayer: documents.hasTextLayer,
      isScanLike: documents.isScanLike,
      normalizedPdfPath: documents.normalizedPdfPath,
      readabilityScore: documents.readabilityScore,
      preprocessingWarnings: documents.preprocessingWarnings,
      processingProvider: documents.processingProvider,
    })
    .from(documents)
    .where(and(eq(documents.tenantId, tenantId), eq(documents.id, documentId)))
    .limit(1),
  );

  if (!doc) return null;
  return resolveAiInput(doc);
}
