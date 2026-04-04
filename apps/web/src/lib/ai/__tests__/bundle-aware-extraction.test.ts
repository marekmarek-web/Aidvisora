/**
 * Bundle-aware extraction + investment/DIP/DPS section pass — regression tests
 *
 * Tests run against logic functions (no live LLM — createResponseStructured is mocked).
 *
 * Coverage:
 * BA01: buildBundleAwarePreamble — includes bundle context in prompt
 * BA02: buildBundleAwarePreamble — sensitive attachment note included
 * BA03: buildBundleAwarePreamble — investment section note included
 * BA04: buildBundleAwarePreamble — empty for non-bundle
 * BA05: investment section pass — populates investmentData when missing
 * BA06: investment section pass — does NOT overwrite contractual investmentData with modeled
 * BA07: investment section pass — enriches strategy when missing
 * BA08: investment section pass — DIP/DPS classified as life_insurance → reviewWarning added
 * BA09: investment section pass — DIP classified correctly, no reviewWarning
 * BA10: investment section pass — service agreement non-standalone → needsManualValidation
 * BA11: investment section pass — skips when no investment candidates
 * BA12: investment section pass — publishHints only strengthened, never weakened
 * BA13: IŽP bundle retains investment strategy after orchestration
 * BA14: IŽP bundle retains payment data after orchestration
 * BA15: packet segmentation detects DIP/DPS keywords as investment_section
 * BA16: packet segmentation detects IŽP investment part as investment_section
 * BA17: ContractPipelineOptions bundleHint type is exported correctly
 * BA18: investment section pass with existing funds — does not replace when already set
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DocumentReviewEnvelope } from "@/lib/ai/document-review-types";
import type { PacketMeta } from "@/lib/ai/document-packet-types";

// ── Mock openai ────────────────────────────────────────────────────────────────
const mockLLMResponse = vi.fn();

vi.mock("@/lib/openai", () => ({
  createResponseStructured: (...args: unknown[]) => mockLLMResponse(...args),
  createResponse: vi.fn(),
  createAiReviewResponseFromPrompt: vi.fn(),
  logOpenAICall: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/observability/portal-sentry", () => ({
  capturePublishGuardFailure: vi.fn(),
}));

// ── Imports under test ────────────────────────────────────────────────────────
import {
  buildCombinedClassifyAndExtractPrompt,
} from "@/lib/ai/combined-extraction";
import {
  orchestrateSubdocumentExtraction,
} from "@/lib/ai/subdocument-extraction-orchestrator";
import { segmentDocumentPacket } from "@/lib/ai/document-packet-segmentation";
import type { BundleHint } from "@/lib/ai/contract-understanding-pipeline";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePacketMeta(overrides: Partial<PacketMeta> = {}): PacketMeta {
  return {
    isBundle: true,
    bundleConfidence: 0.75,
    detectionMethods: ["keyword_scan"],
    subdocumentCandidates: [],
    primarySubdocumentType: "final_contract",
    hasSensitiveAttachment: false,
    hasUnpublishableSection: false,
    packetWarnings: [],
    ...overrides,
  };
}

function makeEnvelope(overrides: Partial<DocumentReviewEnvelope> = {}): DocumentReviewEnvelope {
  return {
    documentClassification: {
      primaryType: "life_insurance_contract",
      lifecycleStatus: "final_contract",
      documentIntent: "new_contract",
      confidence: 0.88,
      reasons: [],
      ...((overrides.documentClassification as object | undefined) ?? {}),
    },
    documentMeta: { scannedVsDigital: "digital" },
    extractedFields: {
      contractNumber: { value: "POL-12345", status: "found", confidence: 0.95 },
      totalMonthlyPremium: { value: "2000", status: "found", confidence: 0.9 },
    },
    parties: {},
    reviewWarnings: [],
    suggestedActions: [],
    participants: [
      { role: "policyholder", fullName: "Jan Novák", confidence: 0.9 },
    ],
    paymentData: {
      accountNumber: "123456789/0100",
      variableSymbol: "456789",
      paymentFrequency: "měsíčně",
    },
    publishHints: {
      contractPublishable: true,
      reviewOnly: false,
      needsSplit: false,
      needsManualValidation: false,
      sensitiveAttachmentOnly: false,
      reasons: [],
    },
    ...overrides,
  } as DocumentReviewEnvelope;
}

const LONG_MARKDOWN = `
Životní pojistná smlouva č. POL-12345 platná od 1.1.2024

Pojistník: Jan Novák, nar. 1.1.1980
Pojistitel: ČSOB Pojišťovna, a.s.
Produkt: FLEXI životní pojištění s investiční složkou

## Investiční část
Investiční strategie: Vyvážená
Fond A — alokace 60%
Fond B — alokace 40%
Investiční prémie: 500 Kč/měsíc

## Platební instrukce
Bankovní účet: 123456789/0100
Variabilní symbol: 456789
`.trim().padEnd(400, " ");

const DIP_MARKDOWN = `
Smlouva o Dlouhodobém investičním produktu (DIP)

Majitel účtu DIP: Jan Novák, nar. 1.1.1980
Poskytovatel: Amundi Asset Management
Číslo smlouvy DIP: DIP-2024-0001

Investiční program: Dynamický
Fondy:
- Amundi Pioneer Euro Bond 40%
- Amundi Pioneer Equity 60%

Roční příspěvek: 24 000 Kč
`.trim().padEnd(400, " ");

const BUNDLE_IZP_INVESTMENT_MARKDOWN = `
Pojistná smlouva č. POL-99888 FLEXI INVEST

Pojistník: Jana Nováková, nar. 15.5.1982
Pojistitel: Kooperativa pojišťovna, a.s.

## Pojistné krytí
Pojistné pro případ smrti: 1 000 000 Kč

## Investiční část pojistné smlouvy
Fondové pojištění — investiční složka
Investiční strategie: Konzervativní
Fond spoření: 60%
Fond růst: 40%
Investiční prémie: 800 Kč/měsíc

## Platební instrukce
Účet: 987654321/0800
Variabilní symbol: 99888
Frekvence: měsíčně
`.trim().padEnd(600, " ");

// ─── BA01–BA04: Bundle-aware prompt preamble ──────────────────────────────────

describe("bundle-aware extraction prompt", () => {
  it("BA01: bundle hint → prompt contains bundle context", () => {
    const bundleHint = {
      isBundle: true,
      primarySubdocumentType: "final_contract",
      candidateTypes: ["final_contract", "investment_section"],
      sectionHeadings: [],
      hasSensitiveAttachment: false,
      hasInvestmentSection: true,
    };
    const prompt = buildCombinedClassifyAndExtractPrompt(
      "test document text",
      "smlouva.pdf",
      bundleHint,
    );
    expect(prompt).toContain("BUNDLE DOKUMENT");
    expect(prompt).toContain("investiční sekce");
    expect(prompt).toContain("finální smlouva");
  });

  it("BA02: sensitive attachment flag → prompt contains sensitive note", () => {
    const bundleHint = {
      isBundle: true,
      primarySubdocumentType: "final_contract",
      candidateTypes: ["final_contract", "health_questionnaire"],
      sectionHeadings: [],
      hasSensitiveAttachment: true,
      hasInvestmentSection: false,
    };
    const prompt = buildCombinedClassifyAndExtractPrompt("text", null, bundleHint);
    expect(prompt).toContain("citlivou přílohu");
  });

  it("BA03: investment section flag → prompt contains investment note", () => {
    const bundleHint = {
      isBundle: true,
      primarySubdocumentType: "final_contract",
      candidateTypes: ["final_contract", "investment_section"],
      sectionHeadings: [],
      hasSensitiveAttachment: false,
      hasInvestmentSection: true,
    };
    const prompt = buildCombinedClassifyAndExtractPrompt("text", null, bundleHint);
    expect(prompt).toContain("DIP/DPS/fond");
  });

  it("BA04: no bundle hint → no bundle preamble", () => {
    const prompt = buildCombinedClassifyAndExtractPrompt("text", "smlouva.pdf", null);
    expect(prompt).not.toContain("BUNDLE DOKUMENT");
  });

  it("BA04b: non-bundle hint → no bundle preamble", () => {
    const bundleHint = {
      isBundle: false,
      primarySubdocumentType: null,
      candidateTypes: [],
      sectionHeadings: [],
      hasSensitiveAttachment: false,
      hasInvestmentSection: false,
    };
    const prompt = buildCombinedClassifyAndExtractPrompt("text", null, bundleHint);
    expect(prompt).not.toContain("BUNDLE DOKUMENT");
  });
});

// ─── BA05–BA12: Investment section extraction pass ────────────────────────────

describe("investment section extraction pass", () => {
  beforeEach(() => {
    mockLLMResponse.mockReset();
  });

  it("BA05: investment section pass populates investmentData when missing", async () => {
    mockLLMResponse.mockResolvedValue({
      parsed: {
        investmentSectionPresent: true,
        productType: "investment_life_insurance",
        strategy: "Vyvážená",
        funds: [
          { name: "Fond A", allocation: "60%" },
          { name: "Fond B", allocation: "40%" },
        ],
        investmentPremium: "500",
        isModeledData: false,
        isContractualData: true,
        provider: "ČSOB Pojišťovna",
      },
    });

    const packetMeta = makePacketMeta({
      subdocumentCandidates: [
        { type: "final_contract", confidence: 0.9, label: "Smlouva", publishable: true },
        { type: "investment_section", confidence: 0.8, label: "Investiční sekce", publishable: true },
      ],
    });

    const envelope = makeEnvelope({ investmentData: null });
    await orchestrateSubdocumentExtraction(LONG_MARKDOWN, packetMeta, envelope);

    expect(envelope.investmentData).toBeTruthy();
    expect(envelope.investmentData!.strategy).toBe("Vyvážená");
    expect(envelope.investmentData!.funds).toHaveLength(2);
    expect(envelope.investmentData!.isContractualData).toBe(true);
    expect(envelope.investmentData!.isModeledData).toBe(false);
  });

  it("BA06: does NOT overwrite contractual investmentData with modeled data", async () => {
    mockLLMResponse.mockResolvedValue({
      parsed: {
        investmentSectionPresent: true,
        productType: "investment_life_insurance",
        strategy: "Dynamická (modelace)",
        funds: [{ name: "Fond C", allocation: "100%" }],
        isModeledData: true,
        isContractualData: false,
      },
    });

    const packetMeta = makePacketMeta({
      subdocumentCandidates: [
        { type: "final_contract", confidence: 0.9, label: "Smlouva", publishable: true },
        { type: "investment_section", confidence: 0.7, label: "Investiční sekce", publishable: true },
      ],
    });

    // Already has contractual investment data
    const envelope = makeEnvelope({
      investmentData: {
        strategy: "Konzervativní",
        funds: [{ name: "Fond K", allocation: "100%" }],
        isModeledData: false,
        isContractualData: true,
      },
    });

    await orchestrateSubdocumentExtraction(LONG_MARKDOWN, packetMeta, envelope);

    // Original contractual data must be preserved
    expect(envelope.investmentData!.strategy).toBe("Konzervativní");
    expect(envelope.investmentData!.funds![0].name).toBe("Fond K");
    expect(envelope.investmentData!.isContractualData).toBe(true);
  });

  it("BA07: enriches strategy when missing from primary extraction", async () => {
    mockLLMResponse.mockResolvedValue({
      parsed: {
        investmentSectionPresent: true,
        productType: "investment_life_insurance",
        strategy: "Vyvážená",
        funds: [],
        isModeledData: false,
        isContractualData: true,
      },
    });

    const packetMeta = makePacketMeta({
      subdocumentCandidates: [
        { type: "final_contract", confidence: 0.9, label: "Smlouva", publishable: true },
        { type: "investment_section", confidence: 0.75, label: "Investiční sekce", publishable: true },
      ],
    });

    const envelope = makeEnvelope({
      investmentData: {
        strategy: null, // missing
        funds: [],
        isModeledData: false,
        isContractualData: true,
      },
    });

    await orchestrateSubdocumentExtraction(LONG_MARKDOWN, packetMeta, envelope);

    expect(envelope.investmentData!.strategy).toBe("Vyvážená");
  });

  it("BA08: DIP classified as life_insurance → reviewWarning added", async () => {
    mockLLMResponse.mockResolvedValue({
      parsed: {
        investmentSectionPresent: true,
        productType: "DIP",
        strategy: "Dynamická",
        funds: [{ name: "Amundi Fund", allocation: "100%" }],
        isModeledData: false,
        isContractualData: true,
        provider: "Amundi",
      },
    });

    const packetMeta = makePacketMeta({
      subdocumentCandidates: [
        { type: "investment_section", confidence: 0.88, label: "DIP sekce", publishable: true },
      ],
    });

    const envelope = makeEnvelope({
      documentClassification: {
        primaryType: "life_insurance_contract", // mis-classified
        lifecycleStatus: "final_contract",
        documentIntent: "new_contract",
        confidence: 0.7,
        reasons: [],
      },
    });

    await orchestrateSubdocumentExtraction(DIP_MARKDOWN, packetMeta, envelope);

    const warn = envelope.reviewWarnings?.find(
      (w) => w.code === "investment_type_mismatch_dip_dps",
    );
    expect(warn).toBeTruthy();
    expect(warn?.message).toContain("DIP");
  });

  it("BA09: DIP document type no warning when NOT classified as life_insurance", async () => {
    mockLLMResponse.mockResolvedValue({
      parsed: {
        investmentSectionPresent: true,
        productType: "DIP",
        strategy: "Dynamická",
        funds: [],
        isModeledData: false,
        isContractualData: true,
      },
    });

    const packetMeta = makePacketMeta({
      primarySubdocumentType: "investment_section",
      subdocumentCandidates: [
        { type: "investment_section", confidence: 0.85, label: "DIP sekce", publishable: true },
      ],
    });

    const envelope = makeEnvelope({
      documentClassification: {
        primaryType: "investment_service_agreement", // correctly classified
        lifecycleStatus: "final_contract",
        documentIntent: "new_contract",
        confidence: 0.88,
        reasons: [],
      },
    });

    await orchestrateSubdocumentExtraction(DIP_MARKDOWN, packetMeta, envelope);

    const warn = envelope.reviewWarnings?.find(
      (w) => w.code === "investment_type_mismatch_dip_dps",
    );
    expect(warn).toBeUndefined();
  });

  it("BA10: investment_service_agreement without contract → needsManualValidation=true", async () => {
    mockLLMResponse.mockResolvedValue({
      parsed: {
        investmentSectionPresent: true,
        productType: "investment_service_agreement",
        strategy: null,
        funds: [],
        isModeledData: false,
        isContractualData: false,
      },
    });

    const packetMeta = makePacketMeta({
      subdocumentCandidates: [
        // No final_contract → only service agreement
        { type: "investment_section", confidence: 0.7, label: "Investiční servisní smlouva", publishable: false },
      ],
    });

    const envelope = makeEnvelope();
    await orchestrateSubdocumentExtraction(DIP_MARKDOWN, packetMeta, envelope);

    expect(envelope.publishHints?.needsManualValidation).toBe(true);
  });

  it("BA11: investment section pass skipped when no investment candidates", async () => {
    mockLLMResponse.mockResolvedValue({
      parsed: { healthSectionPresent: false, questionnaireEntries: [] },
    });

    const packetMeta = makePacketMeta({
      subdocumentCandidates: [
        { type: "final_contract", confidence: 0.9, label: "Smlouva", publishable: true },
        // No investment_section
      ],
    });

    const envelope = makeEnvelope({ investmentData: null });
    await orchestrateSubdocumentExtraction(LONG_MARKDOWN, packetMeta, envelope);

    // Investment data should NOT be populated (no investment candidate)
    expect(envelope.investmentData).toBeNull();
  });

  it("BA12: publishHints only strengthened by investment pass", async () => {
    mockLLMResponse.mockResolvedValue({
      parsed: {
        investmentSectionPresent: true,
        productType: "DPS",
        strategy: "Vyvážená",
        funds: [],
        isModeledData: false,
        isContractualData: true,
      },
    });

    const packetMeta = makePacketMeta({
      subdocumentCandidates: [
        { type: "investment_section", confidence: 0.8, label: "DPS sekce", publishable: true },
      ],
    });

    const envelope = makeEnvelope({
      publishHints: {
        contractPublishable: false, // already blocked
        reviewOnly: true,
        needsSplit: true,
        needsManualValidation: true,
        sensitiveAttachmentOnly: true,
        reasons: ["pre_existing_hard_block"],
      },
    });

    await orchestrateSubdocumentExtraction(DIP_MARKDOWN, packetMeta, envelope);

    // Hard blocks preserved
    expect(envelope.publishHints?.contractPublishable).toBe(false);
    expect(envelope.publishHints?.sensitiveAttachmentOnly).toBe(true);
    expect(envelope.publishHints?.reasons).toContain("pre_existing_hard_block");
  });
});

// ─── BA13–BA14: IŽP bundle data preservation ──────────────────────────────────

describe("IŽP bundle data preservation", () => {
  beforeEach(() => {
    mockLLMResponse.mockReset();
  });

  it("BA13: IŽP bundle retains investment strategy after orchestration", async () => {
    mockLLMResponse.mockResolvedValue({
      parsed: {
        investmentSectionPresent: true,
        productType: "investment_life_insurance",
        strategy: "Konzervativní",
        funds: [
          { name: "Fond spoření", allocation: "60%" },
          { name: "Fond růst", allocation: "40%" },
        ],
        investmentPremium: "800",
        isModeledData: false,
        isContractualData: true,
      },
    });

    const packetMeta = makePacketMeta({
      subdocumentCandidates: [
        { type: "final_contract", confidence: 0.88, label: "Smlouva", publishable: true },
        { type: "investment_section", confidence: 0.82, label: "Investiční část", publishable: true },
      ],
    });

    const envelope = makeEnvelope({ investmentData: null });
    await orchestrateSubdocumentExtraction(BUNDLE_IZP_INVESTMENT_MARKDOWN, packetMeta, envelope);

    expect(envelope.investmentData?.strategy).toBe("Konzervativní");
    expect(envelope.investmentData?.funds).toHaveLength(2);

    // Payment data must be preserved
    expect(envelope.paymentData?.accountNumber).toBe("123456789/0100");
    expect(envelope.paymentData?.paymentFrequency).toBe("měsíčně");
  });

  it("BA14: IŽP bundle retains payment data untouched after orchestration", async () => {
    mockLLMResponse.mockResolvedValue({
      parsed: {
        investmentSectionPresent: true,
        productType: "investment_life_insurance",
        strategy: "Dynamická",
        funds: [],
        isModeledData: false,
        isContractualData: true,
      },
    });

    const packetMeta = makePacketMeta({
      subdocumentCandidates: [
        { type: "final_contract", confidence: 0.85, label: "Smlouva", publishable: true },
        { type: "investment_section", confidence: 0.75, label: "Investiční část", publishable: true },
      ],
    });

    const envelope = makeEnvelope();
    const origPayment = { ...envelope.paymentData };

    await orchestrateSubdocumentExtraction(BUNDLE_IZP_INVESTMENT_MARKDOWN, packetMeta, envelope);

    expect(envelope.paymentData?.accountNumber).toBe(origPayment.accountNumber);
    expect(envelope.paymentData?.variableSymbol).toBe(origPayment.variableSymbol);
    expect(envelope.paymentData?.paymentFrequency).toBe(origPayment.paymentFrequency);
  });
});

// ─── BA15–BA16: Packet segmentation detects investment sections ───────────────

describe("packet segmentation — investment section detection", () => {
  const MIN_LENGTH_PAD = 300;

  it("BA15: DIP keywords → investment_section candidate detected", () => {
    const text = `
Smlouva o Dlouhodobém investičním produktu (DIP)
DIP č. 2024-001

Majitel: Jan Novák
Poskytovatel: Amundi Asset Management
Investiční program: Dynamický
`.trim().padEnd(MIN_LENGTH_PAD, " ");

    const result = segmentDocumentPacket(text, null, "dip-smlouva.pdf");
    const invCandidate = result.packetMeta.subdocumentCandidates.find(
      (c) => c.type === "investment_section",
    );
    expect(invCandidate).toBeTruthy();
    expect(invCandidate!.confidence).toBeGreaterThan(0.3);
  });

  it("BA16: fondové pojištění keywords → investment_section candidate detected", () => {
    const text = `
Pojistná smlouva FLEXI INVEST č. POL-999

Pojistník: Jana Nováková
Pojistitel: Kooperativa

Fondové pojištění — investiční část
Investiční strategie: Vyvážená
Fond A 60%, Fond B 40%
`.trim().padEnd(MIN_LENGTH_PAD, " ");

    const result = segmentDocumentPacket(text, null, "smlouva.pdf");
    const invCandidate = result.packetMeta.subdocumentCandidates.find(
      (c) => c.type === "investment_section",
    );
    expect(invCandidate).toBeTruthy();
  });
});

// ─── BA17: BundleHint type shape check ───────────────────────────────────────

describe("BundleHint type", () => {
  it("BA17: BundleHint can be constructed with all required fields", () => {
    // Compile-time type test — if this compiles, the type is correct
    const hint: BundleHint = {
      isBundle: true,
      primarySubdocumentType: "final_contract",
      candidateTypes: ["final_contract", "investment_section"],
      sectionHeadings: ["Pojistná smlouva", "Investiční část"],
      hasSensitiveAttachment: false,
      hasInvestmentSection: true,
    };
    expect(hint.isBundle).toBe(true);
    expect(hint.hasInvestmentSection).toBe(true);
  });
});

// ─── BA18: Investment section pass with existing funds ───────────────────────

describe("investment section funds merge", () => {
  beforeEach(() => {
    mockLLMResponse.mockReset();
  });

  it("BA18: does not replace existing contractual funds", async () => {
    mockLLMResponse.mockResolvedValue({
      parsed: {
        investmentSectionPresent: true,
        productType: "investment_life_insurance",
        strategy: "Konzervativní",
        funds: [{ name: "Nový fond C", allocation: "100%" }],
        isModeledData: false,
        isContractualData: true,
      },
    });

    const packetMeta = makePacketMeta({
      subdocumentCandidates: [
        { type: "final_contract", confidence: 0.9, label: "Smlouva", publishable: true },
        { type: "investment_section", confidence: 0.75, label: "Investiční část", publishable: true },
      ],
    });

    // Existing investmentData already has funds
    const envelope = makeEnvelope({
      investmentData: {
        strategy: "Konzervativní",
        funds: [{ name: "Fond A", allocation: "60%" }, { name: "Fond B", allocation: "40%" }],
        isModeledData: false,
        isContractualData: true,
      },
    });

    await orchestrateSubdocumentExtraction(LONG_MARKDOWN, packetMeta, envelope);

    // Funds should NOT be replaced — already have 2 funds
    expect(envelope.investmentData!.funds).toHaveLength(2);
    expect(envelope.investmentData!.funds![0].name).toBe("Fond A");
  });
});
