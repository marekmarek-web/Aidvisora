import { describe, it, expect } from "vitest";
import { validateExtractedContract } from "../extraction-validation";

describe("extraction-validation", () => {
  it("passes valid payload with no warnings", () => {
    const result = validateExtractedContract({
      contractNumber: "CN-2024-001",
      institutionName: "Banka",
      client: { email: "a@b.cz", phone: "+420 123 456 789" },
      paymentDetails: { amount: 1000, currency: "CZK", frequency: "monthly" },
      effectiveDate: "2024-01-01",
      expirationDate: "2025-01-01",
    });
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBe(0);
  });

  it("warns on invalid email format", () => {
    const result = validateExtractedContract({
      client: { email: "not-an-email" },
    });
    expect(result.warnings.some((w) => w.code === "EMAIL_FORMAT")).toBe(true);
    expect(result.reasonsForReview).toContain("email_format");
  });

  it("warns on negative amount", () => {
    const result = validateExtractedContract({
      paymentDetails: { amount: -100 },
    });
    expect(result.warnings.some((w) => w.code === "AMOUNT_NEGATIVE")).toBe(true);
    expect(result.valid).toBe(false);
  });

  it("warns on unparseable effective date", () => {
    const result = validateExtractedContract({
      effectiveDate: "invalid-date",
    });
    expect(result.warnings.some((w) => w.code === "DATE_EFFECTIVE")).toBe(true);
    expect(result.reasonsForReview).toContain("date_effective");
  });

  it("warns when effective date is after expiration date", () => {
    const result = validateExtractedContract({
      effectiveDate: "2025-06-01",
      expirationDate: "2025-01-01",
    });
    expect(result.warnings.some((w) => w.code === "DATE_RANGE")).toBe(true);
  });

  it("warns on invalid phone format", () => {
    const result = validateExtractedContract({
      client: { phone: "abc" },
    });
    expect(result.warnings.some((w) => w.code === "PHONE_FORMAT")).toBe(true);
  });

  it("warns on company ID not 8 digits", () => {
    const result = validateExtractedContract({
      client: { companyId: "123" },
    });
    expect(result.warnings.some((w) => w.code === "COMPANY_ID_FORMAT")).toBe(true);
  });

  it("accepts valid company ID 8 digits", () => {
    const result = validateExtractedContract({
      client: { companyId: "12345678" },
    });
    expect(result.warnings.some((w) => w.code === "COMPANY_ID_FORMAT")).toBe(false);
  });

  it("accepts allowed payment frequency values", () => {
    const result = validateExtractedContract({
      paymentDetails: { frequency: "monthly" },
    });
    expect(result.warnings.some((w) => w.code === "PAYMENT_FREQUENCY")).toBe(false);
  });
});
