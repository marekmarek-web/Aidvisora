import { describe, it, expect } from "vitest";
import { decideReviewStatus } from "../review-decision-engine";

function validationResult(valid: boolean, warnings: { code: string; message: string }[] = []) {
  return {
    valid,
    warnings: warnings.map((w) => ({ ...w, field: undefined })),
    reasonsForReview: warnings.map((w) => w.code.toLowerCase()),
  };
}

describe("review-decision-engine", () => {
  it("returns failed when extractionFailed is true", () => {
    const status = decideReviewStatus({
      classificationConfidence: 0.9,
      extractionConfidence: 0.9,
      validation: validationResult(true),
      inputMode: "text_pdf",
      extractionFailed: true,
    });
    expect(status).toBe("failed");
  });

  it("returns review_required when validation is invalid", () => {
    const status = decideReviewStatus({
      classificationConfidence: 0.9,
      extractionConfidence: 0.9,
      validation: validationResult(false, [{ code: "AMOUNT_INVALID", message: "x" }]),
      inputMode: "text_pdf",
      extractionFailed: false,
    });
    expect(status).toBe("review_required");
  });

  it("returns review_required when classification confidence is low", () => {
    const status = decideReviewStatus({
      classificationConfidence: 0.4,
      extractionConfidence: 0.9,
      validation: validationResult(true),
      inputMode: "text_pdf",
      extractionFailed: false,
    });
    expect(status).toBe("review_required");
  });

  it("returns review_required when extraction confidence is low", () => {
    const status = decideReviewStatus({
      classificationConfidence: 0.9,
      extractionConfidence: 0.4,
      validation: validationResult(true),
      inputMode: "text_pdf",
      extractionFailed: false,
    });
    expect(status).toBe("review_required");
  });

  it("returns review_required when there are validation warnings", () => {
    const status = decideReviewStatus({
      classificationConfidence: 0.8,
      extractionConfidence: 0.8,
      validation: validationResult(true, [{ code: "EMAIL_FORMAT", message: "x" }]),
      inputMode: "text_pdf",
      extractionFailed: false,
    });
    expect(status).toBe("review_required");
  });

  it("returns extracted when all confidence high and no warnings", () => {
    const status = decideReviewStatus({
      classificationConfidence: 0.85,
      extractionConfidence: 0.85,
      validation: validationResult(true),
      inputMode: "text_pdf",
      extractionFailed: false,
    });
    expect(status).toBe("extracted");
  });

  it("returns extracted for scanned_pdf when confidence is high (scan alone does not imply failed)", () => {
    const status = decideReviewStatus({
      classificationConfidence: 0.8,
      extractionConfidence: 0.8,
      validation: validationResult(true),
      inputMode: "scanned_pdf",
      extractionFailed: false,
    });
    expect(status).toBe("extracted");
  });

  it("returns review_required for scanned_pdf when extraction confidence is low", () => {
    const status = decideReviewStatus({
      classificationConfidence: 0.8,
      extractionConfidence: 0.5,
      validation: validationResult(true),
      inputMode: "scanned_pdf",
      extractionFailed: false,
    });
    expect(status).toBe("review_required");
  });
});
