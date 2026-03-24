import { describe, it, expect } from "vitest";
import { decideReviewStatus, decideReviewStatusWithReason } from "../review-decision-engine";

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

  it("returns review_required when envelope validation has blocking warnings", () => {
    const result = decideReviewStatusWithReason({
      classificationConfidence: 0.9,
      extractionConfidence: 0.9,
      validation: validationResult(true),
      envelopeValidation: validationResult(false, [
        { code: "PROPOSAL_MARKED_AS_CONTRACT", message: "conflict" },
      ]),
      inputMode: "text_pdf",
      extractionFailed: false,
    });
    expect(result.status).toBe("review_required");
    expect(result.reason).toBe("envelope_validation_blocking");
  });

  it("returns review_required when envelope has PROPOSAL_MARKED_AS_CONTRACT critical warning", () => {
    const result = decideReviewStatusWithReason({
      classificationConfidence: 0.9,
      extractionConfidence: 0.9,
      validation: validationResult(true),
      envelopeValidation: {
        valid: true,
        warnings: [{ code: "PROPOSAL_MARKED_AS_CONTRACT", message: "x" }],
        reasonsForReview: [],
      },
      inputMode: "text_pdf",
      extractionFailed: false,
    });
    expect(result.status).toBe("review_required");
    expect(result.reason).toBe("envelope_classification_conflict");
  });

  it("returns extracted with reason null when no issues", () => {
    const result = decideReviewStatusWithReason({
      classificationConfidence: 0.9,
      extractionConfidence: 0.9,
      validation: validationResult(true),
      inputMode: "text_pdf",
      extractionFailed: false,
    });
    expect(result.status).toBe("extracted");
    expect(result.reason).toBeNull();
  });
});
