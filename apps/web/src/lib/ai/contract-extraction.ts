import { createResponseWithFile } from "@/lib/openai";
import { validateContractExtraction, type ExtractedContractSchema } from "./extraction-schemas";

const CONTRACT_EXTRACTION_PROMPT = `Extrahuj z přiloženého dokumentu (smlouva) strukturovaná data. Vrať JEDINĚ platný JSON objekt (žádný markdown, žádný úvod) s těmito poli podle toho, co v dokumentu najdeš:
- documentType (string, např. "pojistná smlouva")
- contractNumber (string)
- institutionName (string, např. pojišťovna / banka)
- productName (string)
- client: { fullName?, firstName?, lastName?, birthDate?, personalId?, companyId?, email?, phone?, address? }
- paymentDetails: { amount?, currency?, frequency?, iban?, accountNumber?, bankCode?, variableSymbol?, firstPaymentDate? }
- effectiveDate (string, ISO nebo dd.mm.yyyy)
- expirationDate (string)
- notes (pole stringů, doplňkové poznámky)
- missingFields (pole stringů – jména polí, která v dokumentu chybí)
- confidence (číslo 0–1, jak jsi si jistý extrakcí)
- needsHumanReview (boolean, true pokud nízká confidence nebo nejasnosti)

Pouze platný JSON objekt.`;

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
 * Extract contract data from a document via Responses API (input_file with file_url).
 * Validates output against Zod schema. Returns controlled error object, no raw throw to UI.
 */
export async function extractContractFromFile(fileUrl: string): Promise<ContractExtractionResult> {
  // #region agent log
  fetch("http://127.0.0.1:7387/ingest/30869546-c4c0-4805-9fd6-2bc75f3b0175", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "6af004" },
    body: JSON.stringify({
      sessionId: "6af004",
      hypothesisId: "H1_H2",
      location: "lib/ai/contract-extraction.ts:extractContractFromFile:entry",
      message: "extractContractFromFile entered",
      data: { fileUrlLen: fileUrl?.length ?? 0 },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  try {
    const raw = await createResponseWithFile(fileUrl, CONTRACT_EXTRACTION_PROMPT);
    const validated = validateContractExtraction(raw);
    if (!validated.ok) {
      return {
        ok: false,
        code: "VALIDATION_FAILED",
        message: validated.error.message,
        details: validated.error.issues,
      };
    }
    return { ok: true, data: validated.data };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // #region agent log
    fetch("http://127.0.0.1:7387/ingest/30869546-c4c0-4805-9fd6-2bc75f3b0175", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "6af004" },
      body: JSON.stringify({
        sessionId: "6af004",
        hypothesisId: "H1_H2",
        location: "lib/ai/contract-extraction.ts:extractContractFromFile:catch",
        message: "extraction catch",
        data: { message: message.slice(0, 200) },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return {
      ok: false,
      code: "OPENAI_ERROR",
      message: "Extrakce ze dokumentu selhala.",
      details: message.length > 200 ? message.slice(0, 200) + "…" : message,
    };
  }
}
