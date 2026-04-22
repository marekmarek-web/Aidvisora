import type { DocumentProcessingProvider } from "./types";

export type ProcessingConfig = {
  provider: DocumentProcessingProvider;
  processingEnabled: boolean;
  extractEnabled: boolean;
  adobeClientId: string | null;
  adobeClientSecret: string | null;
  adobeRegion: string;
  /**
   * OCR language tag (Adobe-supported). S2-O1: default přepnut z `en-US` na
   * `cs-CZ` — Aidvisora je CZ-only produkt a české diakritiky (ú, ů, ž, č, š, …)
   * byly v en-US OCR systematicky zmršené (→ chybné klasifikace, např.
   * "Komisionářská" → "Komisionarska"/"Komisionaiska" → pipeline nenajde keyword).
   * Přepsat přes env `ADOBE_OCR_LANG=en-US` pro non-CZ tenanty.
   */
  adobeOcrLang: string;
};

let _cached: ProcessingConfig | null = null;

export function getProcessingConfig(): ProcessingConfig {
  if (_cached) return _cached;

  const providerEnv = process.env.DOCUMENT_PROCESSING_PROVIDER?.trim().toLowerCase();
  const provider: DocumentProcessingProvider =
    providerEnv === "adobe" ? "adobe" : providerEnv === "disabled" ? "disabled" : "none";

  const id = process.env.ADOBE_PDF_SERVICES_CLIENT_ID ?? process.env.PDF_SERVICES_CLIENT_ID ?? null;
  const secret =
    process.env.ADOBE_PDF_SERVICES_CLIENT_SECRET ?? process.env.PDF_SERVICES_CLIENT_SECRET ?? null;

  _cached = {
    provider,
    processingEnabled: process.env.DOCUMENT_PROCESSING_ENABLED === "true",
    extractEnabled: process.env.DOCUMENT_EXTRACT_ENABLED === "true",
    adobeClientId: id?.trim() || null,
    adobeClientSecret: secret?.trim() || null,
    adobeRegion: process.env.ADOBE_PDF_SERVICES_REGION?.trim() || "ew1",
    adobeOcrLang: process.env.ADOBE_OCR_LANG?.trim() || "cs-CZ",
  };

  return _cached;
}

export function resetConfigCache() {
  _cached = null;
}
