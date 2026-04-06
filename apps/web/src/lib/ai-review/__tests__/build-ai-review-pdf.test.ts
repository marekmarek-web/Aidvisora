import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildAiReviewPdfBlob, aiReviewPdfFileName } from "../build-ai-review-pdf";
import type { ExtractionDocument } from "../types";

function minimalDoc(overrides: Partial<ExtractionDocument> = {}): ExtractionDocument {
  const base: ExtractionDocument = {
    id: "test-id",
    fileName: "smlouva-test.pdf",
    documentType: "life_insurance",
    clientName: "Jan Novák",
    uploadTime: "2026-01-15T10:00:00.000Z",
    pageCount: 3,
    globalConfidence: 0.82,
    reviewStatus: "pending",
    processingStatus: "extracted",
    extractionProvider: "internal",
    uploadSource: "portal",
    lastProcessedAt: "2026-01-15T10:01:00.000Z",
    executiveSummary: "Testovací shrnutí dokumentu.",
    recommendations: [],
    extraRecommendations: [],
    diagnostics: {
      ocrQuality: "good",
      extractionCoverage: 1,
      totalFields: 2,
      extractedFields: 2,
      unresolvedFieldCount: 0,
      warningCount: 0,
      errorCount: 0,
      conflictingValueCount: 0,
      pagesWithoutReadableText: [],
      notes: [],
    },
    groups: [
      {
        id: "g1",
        name: "Klient",
        iconName: "User",
        fields: [
          {
            id: "f1",
            groupId: "g1",
            label: "Jméno",
            value: "Jan Novák",
            confidence: 0.9,
            status: "success",
            sourceType: "ai",
            isConfirmed: false,
            isEdited: false,
            originalAiValue: "Jan Novák",
          },
        ],
      },
    ],
    pdfUrl: "",
    clientMatchCandidates: [],
    draftActions: [{ type: "create_contract", label: "Vytvořit smlouvu", payload: {} }],
    isApplied: false,
  };
  return { ...base, ...overrides };
}

describe("buildAiReviewPdfBlob", () => {
  it("produces a PDF blob with magic header and at least one page", async () => {
    const blob = await buildAiReviewPdfBlob(minimalDoc(), { f1: "Jana Nováková" });
    expect(blob.type).toBe("application/pdf");
    const buf = new Uint8Array(await blob.arrayBuffer());
    const head = String.fromCharCode(...buf.slice(0, 4));
    expect(head).toBe("%PDF");
    const loaded = await PDFDocument.load(buf);
    expect(loaded.getPageCount()).toBeGreaterThan(0);
  });

  it("merges edited field values into output (smoke: no throw)", async () => {
    const blob = await buildAiReviewPdfBlob(minimalDoc(), { f1: "Upravená hodnota" });
    expect(blob.size).toBeGreaterThan(500);
  });
});

describe("aiReviewPdfFileName", () => {
  it("sanitizes file name and adds ISO date suffix", () => {
    const name = aiReviewPdfFileName(minimalDoc({ fileName: "Moje smlouva #1.pdf" }));
    expect(name).toMatch(/^ai-review-.*-\d{4}-\d{2}-\d{2}\.pdf$/);
  });
});
