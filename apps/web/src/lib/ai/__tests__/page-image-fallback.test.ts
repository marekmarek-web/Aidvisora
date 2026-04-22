/**
 * page-image-fallback — unit tests.
 *
 * Covers the rescue step that re-extracts empty / low-confidence required fields
 * by re-asking the multimodal model against the rasterized source page.
 *
 * These tests stub `rasterizePage` + `callModel` so they stay deterministic and
 * do NOT hit pdfjs / OpenAI. The envelope mutation, confidence cap, source kind
 * tagging and feature-flag behavior are all verified here.
 */

import { describe, it, expect, vi } from "vitest";
import {
  runPageImageFallbackForMissingRequired,
  __forTests,
} from "../page-image-fallback";
import type { DocumentReviewEnvelope } from "../document-review-types";

const { RECOVERED_CONFIDENCE_CAP, MAX_RESCUES_PER_RUN } = __forTests();

function makeEnvelope(
  fields: DocumentReviewEnvelope["extractedFields"] = {}
): DocumentReviewEnvelope {
  return {
    documentClassification: {
      primaryType: "life_insurance_contract",
      lifecycleStatus: "final_contract",
      documentIntent: "creates_new_product",
      confidence: 0.8,
      reasons: [],
    },
    documentMeta: { scannedVsDigital: "unknown" },
    parties: {},
    productsOrObligations: [],
    financialTerms: {},
    serviceTerms: {},
    extractedFields: fields,
    evidence: [],
    candidateMatches: {
      matchedClients: [],
      matchedHouseholds: [],
      matchedDeals: [],
      matchedCompanies: [],
      matchedContracts: [],
      score: 0,
      reason: "no_match",
      ambiguityFlags: [],
    },
    reviewWarnings: [],
    suggestedActions: [],
    dataCompleteness: {
      requiredTotal: 0,
      requiredSatisfied: 0,
      optionalExtracted: 0,
      notApplicableCount: 0,
      score: 0,
    },
  } as DocumentReviewEnvelope;
}

describe("runPageImageFallbackForMissingRequired", () => {
  it("PIF01: flag disabled → skipped immediately (no side effects)", async () => {
    const rasterizePage = vi.fn();
    const callModel = vi.fn();
    const envelope = makeEnvelope();
    const res = await runPageImageFallbackForMissingRequired(
      {
        envelope,
        documentType: "life_insurance_contract",
        fileUrl: "https://example.com/doc.pdf",
        mimeType: "application/pdf",
        enabled: false,
      },
      { rasterizePage, callModel }
    );
    expect(res.skippedReason).toBe("disabled");
    expect(res.recoveredFieldKeys).toEqual([]);
    expect(rasterizePage).not.toHaveBeenCalled();
    expect(callModel).not.toHaveBeenCalled();
  });

  it("PIF02: no fileUrl → skipped", async () => {
    const rasterizePage = vi.fn();
    const callModel = vi.fn();
    const res = await runPageImageFallbackForMissingRequired(
      {
        envelope: makeEnvelope(),
        documentType: "life_insurance_contract",
        fileUrl: null,
        mimeType: null,
        enabled: true,
      },
      { rasterizePage, callModel }
    );
    expect(res.skippedReason).toBe("no_file_url");
    expect(rasterizePage).not.toHaveBeenCalled();
  });

  it("PIF03: non-PDF fileUrl → skipped (cannot rasterize images through pdfjs)", async () => {
    const res = await runPageImageFallbackForMissingRequired(
      {
        envelope: makeEnvelope(),
        documentType: "life_insurance_contract",
        fileUrl: "https://example.com/scan.jpg",
        mimeType: "image/jpeg",
        enabled: true,
      },
      { rasterizePage: vi.fn(), callModel: vi.fn() }
    );
    expect(res.skippedReason).toBe("non_pdf");
  });

  it("PIF04: all required fields already extracted with high confidence → no-op", async () => {
    const envelope = makeEnvelope({
      insurer: { value: "ČSOB Pojišťovna", status: "extracted", confidence: 0.9 },
      productName: { value: "Filip Plus", status: "extracted", confidence: 0.95 },
      documentStatus: { value: "active", status: "extracted", confidence: 0.9 },
      policyStartDate: { value: "2024-01-01", status: "extracted", confidence: 0.92 },
    });
    const rasterizePage = vi.fn();
    const callModel = vi.fn();
    const res = await runPageImageFallbackForMissingRequired(
      {
        envelope,
        documentType: "life_insurance_contract",
        fileUrl: "https://example.com/doc.pdf",
        mimeType: "application/pdf",
        enabled: true,
      },
      { rasterizePage, callModel }
    );
    expect(res.skippedReason).toBe("no_missing_required");
    expect(res.recoveredFieldKeys).toEqual([]);
    expect(rasterizePage).not.toHaveBeenCalled();
    expect(callModel).not.toHaveBeenCalled();
  });

  it("PIF05: missing required field → rescued, confidence capped at 0.7, tier + sourceKind set", async () => {
    const envelope = makeEnvelope({
      insurer: { value: "ČSOB Pojišťovna", status: "extracted", confidence: 0.9 },
      productName: { value: "Filip Plus", status: "extracted", confidence: 0.95 },
      documentStatus: { value: "active", status: "extracted", confidence: 0.9 },
      // policyStartDate intentionally missing
    });
    const rasterizePage = vi.fn().mockResolvedValue({
      dataUrl: "data:image/jpeg;base64,AAAA",
      width: 800,
      height: 1000,
      pageNumber: 1,
    });
    const callModel = vi.fn().mockResolvedValue({
      parsed: {
        found: true,
        value: "2024-03-15",
        confidence: 0.98,
        evidenceSnippet: "Datum sjednání: 15.3.2024",
      },
      text: "{}",
    });

    const res = await runPageImageFallbackForMissingRequired(
      {
        envelope,
        documentType: "life_insurance_contract",
        fileUrl: "https://example.com/doc.pdf",
        mimeType: "application/pdf",
        enabled: true,
      },
      { rasterizePage, callModel }
    );

    expect(res.recoveredFieldKeys).toContain("policyStartDate");
    const rescued = envelope.extractedFields.policyStartDate;
    expect(rescued).toBeDefined();
    expect(rescued?.value).toBe("2024-03-15");
    expect(rescued?.status).toBe("extracted");
    expect(rescued?.evidenceTier).toBe("recovered_from_image");
    expect(rescued?.sourceKind).toBe("page_image_fallback");
    expect(rescued?.confidence).toBeLessThanOrEqual(RECOVERED_CONFIDENCE_CAP);
    expect(rescued?.evidenceSnippet).toBe("Datum sjednání: 15.3.2024");
  });

  it("PIF06: rescue returns found=false → field stays missing, counts as failed attempt", async () => {
    const envelope = makeEnvelope({
      insurer: { value: "ČSOB", status: "extracted", confidence: 0.9 },
      productName: { value: "X", status: "extracted", confidence: 0.9 },
      documentStatus: { value: "active", status: "extracted", confidence: 0.9 },
    });
    const rasterizePage = vi.fn().mockResolvedValue({
      dataUrl: "data:image/jpeg;base64,BBBB",
      width: 800,
      height: 1000,
      pageNumber: 1,
    });
    const callModel = vi.fn().mockResolvedValue({
      parsed: { found: false, value: null },
      text: "{}",
    });
    const res = await runPageImageFallbackForMissingRequired(
      {
        envelope,
        documentType: "life_insurance_contract",
        fileUrl: "https://example.com/doc.pdf",
        mimeType: "application/pdf",
        enabled: true,
      },
      { rasterizePage, callModel }
    );
    expect(res.recoveredFieldKeys).toEqual([]);
    expect(res.failedAttempts).toBe(1);
    expect(envelope.extractedFields.policyStartDate).toBeUndefined();
  });

  it("PIF07: page-1 rasterize returns null → aborts with rasterize_unavailable", async () => {
    const envelope = makeEnvelope();
    const rasterizePage = vi.fn().mockResolvedValue(null);
    const callModel = vi.fn();
    const res = await runPageImageFallbackForMissingRequired(
      {
        envelope,
        documentType: "life_insurance_contract",
        fileUrl: "https://example.com/doc.pdf",
        mimeType: "application/pdf",
        enabled: true,
      },
      { rasterizePage, callModel }
    );
    expect(res.skippedReason).toBe("rasterize_unavailable");
    expect(callModel).not.toHaveBeenCalled();
  });

  it("PIF08: model call throws → failure counted, rescue continues on next field", async () => {
    const envelope = makeEnvelope({
      insurer: { value: null, status: "missing" },
      productName: { value: null, status: "missing" },
      documentStatus: { value: "active", status: "extracted", confidence: 0.9 },
      policyStartDate: { value: "2024-01-01", status: "extracted", confidence: 0.9 },
    });
    const rasterizePage = vi.fn().mockResolvedValue({
      dataUrl: "data:image/jpeg;base64,CCCC",
      width: 800,
      height: 1000,
      pageNumber: 1,
    });
    const callModel = vi
      .fn()
      .mockRejectedValueOnce(new Error("rate limit"))
      .mockResolvedValueOnce({
        parsed: { found: true, value: "Filip Plus", confidence: 0.88 },
        text: "{}",
      });

    const res = await runPageImageFallbackForMissingRequired(
      {
        envelope,
        documentType: "life_insurance_contract",
        fileUrl: "https://example.com/doc.pdf",
        mimeType: "application/pdf",
        enabled: true,
      },
      { rasterizePage, callModel }
    );
    expect(res.failedAttempts).toBeGreaterThanOrEqual(1);
    expect(res.recoveredFieldKeys).toContain("productName");
    expect(envelope.extractedFields.productName?.value).toBe("Filip Plus");
  });

  it("PIF09: honors MAX_RESCUES_PER_RUN cap", async () => {
    // All 4 required life-insurance fields missing → exactly MAX_RESCUES_PER_RUN calls
    const envelope = makeEnvelope({});
    const rasterizePage = vi.fn().mockResolvedValue({
      dataUrl: "data:image/jpeg;base64,DDDD",
      width: 800,
      height: 1000,
      pageNumber: 1,
    });
    const callModel = vi.fn().mockResolvedValue({
      parsed: { found: true, value: "X", confidence: 0.8 },
      text: "{}",
    });
    await runPageImageFallbackForMissingRequired(
      {
        envelope,
        documentType: "life_insurance_contract",
        fileUrl: "https://example.com/doc.pdf",
        mimeType: "application/pdf",
        enabled: true,
      },
      { rasterizePage, callModel }
    );
    expect(callModel.mock.calls.length).toBeLessThanOrEqual(MAX_RESCUES_PER_RUN);
  });

  it("PIF10: low-confidence existing field (< 0.5) also rescued", async () => {
    const envelope = makeEnvelope({
      insurer: { value: "ČSOB", status: "extracted", confidence: 0.9 },
      productName: { value: "maybe?", status: "extracted", confidence: 0.3 },
      documentStatus: { value: "active", status: "extracted", confidence: 0.9 },
      policyStartDate: { value: "2024-01-01", status: "extracted", confidence: 0.9 },
    });
    const rasterizePage = vi.fn().mockResolvedValue({
      dataUrl: "data:image/jpeg;base64,EEEE",
      width: 800,
      height: 1000,
      pageNumber: 1,
    });
    const callModel = vi.fn().mockResolvedValue({
      parsed: { found: true, value: "Filip Plus", confidence: 0.85 },
      text: "{}",
    });
    const res = await runPageImageFallbackForMissingRequired(
      {
        envelope,
        documentType: "life_insurance_contract",
        fileUrl: "https://example.com/doc.pdf",
        mimeType: "application/pdf",
        enabled: true,
      },
      { rasterizePage, callModel }
    );
    expect(res.recoveredFieldKeys).toContain("productName");
    expect(envelope.extractedFields.productName?.value).toBe("Filip Plus");
    expect(envelope.extractedFields.productName?.confidence).toBeLessThanOrEqual(
      RECOVERED_CONFIDENCE_CAP
    );
  });
});

describe("page-image-fallback helpers", () => {
  const { fieldKeyFromRequiredPath, isPdfUrl, isFieldRescuable } = __forTests();

  it("H01: fieldKeyFromRequiredPath parses simple extractedFields.* path", () => {
    expect(fieldKeyFromRequiredPath("extractedFields.insurer")).toBe("insurer");
  });

  it("H02: fieldKeyFromRequiredPath ignores compound paths", () => {
    expect(fieldKeyFromRequiredPath("extractedFields.foo.bar")).toBeNull();
  });

  it("H03: fieldKeyFromRequiredPath ignores non-extractedFields prefixes", () => {
    expect(fieldKeyFromRequiredPath("parties.policyholder")).toBeNull();
  });

  it("H04: isPdfUrl detects .pdf extension", () => {
    expect(isPdfUrl("https://example.com/doc.pdf")).toBe(true);
  });

  it("H05: isPdfUrl trusts mimeType when present", () => {
    expect(isPdfUrl("https://example.com/blob", "application/pdf")).toBe(true);
  });

  it("H06: isPdfUrl returns false for obvious image types", () => {
    expect(isPdfUrl("https://example.com/scan.jpg", "image/jpeg")).toBe(false);
  });

  it("H07: isFieldRescuable → true for undefined field", () => {
    expect(isFieldRescuable(undefined)).toBe(true);
  });

  it("H08: isFieldRescuable → true for empty string value", () => {
    expect(isFieldRescuable({ value: "   ", status: "extracted" })).toBe(true);
  });

  it("H09: isFieldRescuable → true for confidence < 0.5", () => {
    expect(
      isFieldRescuable({ value: "x", status: "extracted", confidence: 0.3 })
    ).toBe(true);
  });

  it("H10: isFieldRescuable → false for high-confidence populated field", () => {
    expect(
      isFieldRescuable({ value: "x", status: "extracted", confidence: 0.9 })
    ).toBe(false);
  });
});
