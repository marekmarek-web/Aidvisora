import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/openai", () => ({
  createResponseWithFile: vi.fn(),
}));
import {
  validatePaymentInstructionExtraction,
  mapPaymentExtractionToPortalDraftPayload,
  buildPaymentInstructionEnvelope,
  paymentInstructionExtractionSchema,
} from "../payment-instruction-extraction";

describe("payment-instruction-extraction", () => {
  it("parses minimal valid extraction JSON shape", () => {
    const raw = {
      institutionName: "Test Bank",
      iban: "CZ6508000000192000145399",
      amount: 1500,
      currency: "CZK",
      variableSymbol: "123456",
      confidence: 0.8,
      needsHumanReview: false,
    };
    const parsed = paymentInstructionExtractionSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
  });

  it("validation warns when account identifiers missing", () => {
    const { warnings, needsHumanReview } = validatePaymentInstructionExtraction({
      amount: "1000",
      currency: "CZK",
      confidence: 0.9,
    });
    expect(warnings.some((w) => w.code === "payment_missing_account")).toBe(true);
    expect(needsHumanReview).toBe(true);
  });

  it("maps extraction to portal draft payload keys", () => {
    const p = mapPaymentExtractionToPortalDraftPayload({
      institutionName: "ACME",
      productName: "Životko",
      iban: "CZ123",
      amount: 99,
      currency: "CZK",
      paymentFrequency: "měsíčně",
      variableSymbol: "vs1",
    });
    expect(p.provider).toBe("ACME");
    expect(p.regularAmount).toBe("99");
    expect(p.frequency).toBe("měsíčně");
    expect(p.variableSymbol).toBe("vs1");
  });

  it("buildPaymentInstructionEnvelope sets payment flags", () => {
    const env = buildPaymentInstructionEnvelope({
      extraction: {
        institutionName: "X",
        iban: "CZ6508000000192000145399",
        amount: 1,
        confidence: 0.7,
      },
      primaryType: "payment_instruction",
    });
    expect(env.contentFlags.containsPaymentInstructions).toBe(true);
    expect(env.documentMeta.pipelineRoute).toBe("payment_instructions");
    expect(env.debug?.paymentInstructionExtraction).toBeDefined();
  });
});
