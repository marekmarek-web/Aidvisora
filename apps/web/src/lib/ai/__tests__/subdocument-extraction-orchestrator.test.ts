/**
 * Per-subdocument extraction orchestrator — regression tests
 *
 * Tests run against logic functions (no live LLM — createResponseStructured is mocked).
 * Covers the 10 mandatory regression scenarios from the task spec plus integration checks.
 *
 * Coverage:
 * SD01: bundle final_contract + health_questionnaire → health extracted, contract kept
 * SD02: bundle modelation + final_contract → lifecycle correct, modelation non-publishable
 * SD03: health_questionnaire section not published as contract
 * SD04: modelation not published as final contract
 * SD05: final_contract retains payment data after orchestration
 * SD06: final_contract retains investment strategy after orchestration
 * SD07: participants not merged into single person
 * SD08: insuredRisks not relinked to wrong person
 * SD09: AML/FATCA attachment-only remains non-publishable
 * SD10: packet merge does not corrupt canonical fields
 * SD11: non-bundle document skips orchestration
 * SD12: low-confidence bundle skips orchestration
 * SD13: describeSubdocumentExtractionRoute returns correct labels
 * SD14: strengthenPublishHints never weakens existing hard blocks
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DocumentReviewEnvelope } from "@/lib/ai/document-review-types";
import type { PacketMeta } from "@/lib/ai/document-packet-types";

// ── Mock openai / createResponseStructured ─────────────────────────────────────
const mockHealthResponse = vi.fn();

vi.mock("@/lib/openai", () => ({
  createResponseStructured: (...args: unknown[]) => mockHealthResponse(...args),
  createResponse: vi.fn(),
  createAiReviewResponseFromPrompt: vi.fn(),
  logOpenAICall: vi.fn(),
}));

// ── Mock audit / observability (transitive imports) ────────────────────────────
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/observability/portal-sentry", () => ({
  capturePublishGuardFailure: vi.fn(),
}));

// ── Import under test ──────────────────────────────────────────────────────────
import {
  orchestrateSubdocumentExtraction,
  describeSubdocumentExtractionRoute,
} from "@/lib/ai/subdocument-extraction-orchestrator";

// ─── Factories ────────────────────────────────────────────────────────────────

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
      fullName: { value: "Jan Novák", status: "found", confidence: 0.9 },
      totalMonthlyPremium: { value: "1500", status: "found", confidence: 0.9 },
      bankAccount: { value: "123456789/0100", status: "found", confidence: 0.88 },
      variableSymbol: { value: "456789", status: "found", confidence: 0.88 },
      investmentStrategy: { value: "Konzervativní", status: "found", confidence: 0.85 },
    },
    parties: {},
    reviewWarnings: [],
    suggestedActions: [],
    // Canonical fields from Phase 3 normalization
    participants: [
      {
        role: "policyholder",
        fullName: "Jan Novák",
        birthDate: "1980-01-01",
        confidence: 0.9,
      },
      {
        role: "insured",
        fullName: "Jana Nováková",
        birthDate: "1982-05-15",
        confidence: 0.88,
      },
    ],
    insuredRisks: [
      {
        riskType: "death",
        riskLabel: "Pojištění pro případ smrti",
        linkedParticipantName: "Jan Novák",
        linkedParticipantRole: "policyholder",
        insuredAmount: "500000",
      },
      {
        riskType: "disability",
        riskLabel: "Trvalé následky úrazu",
        linkedParticipantName: "Jana Nováková",
        linkedParticipantRole: "insured",
        insuredAmount: "200000",
      },
    ],
    investmentData: {
      strategy: "Konzervativní",
      funds: [{ name: "Fond A", allocation: "60%" }],
      isModeledData: false,
      isContractualData: true,
    },
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
Pojištěný: Jana Nováková, nar. 15.5.1982
Pojistitel: ČSOB Pojišťovna, a.s.
Produkt: FLEXI životní pojištění

## Pojistná rizika
1. Pojištění pro případ smrti — pojistná částka 500 000 Kč
2. Trvalé následky úrazu — pojistná částka 200 000 Kč (Jana Nováková)

## Investiční strategie
Konzervativní — alokace: Fond A 60%, Fond B 40%

## Platební instrukce
Bankovní účet: 123456789/0100
Variabilní symbol: 456789
Frekvence plateb: měsíčně
`.trim().padEnd(400, " ");

const BUNDLE_WITH_HEALTH_MARKDOWN = `
Životní pojistná smlouva č. POL-12345

Pojistník: Jan Novák, nar. 1.1.1980
Pojistitel: ČSOB Pojišťovna, a.s.
Produkt: FLEXI životní pojištění
Měsíční pojistné: 1 500 Kč

## Pojistná rizika
1. Pojištění pro případ smrti — 500 000 Kč

## Zdravotní dotazník

Pojišťovaná osoba: Jan Novák
Datum vyplnění: 15.3.2024

Otázka 1: Léčíte se v současnosti nebo jste se v posledních 5 letech léčil/a s nějakým závažným onemocněním?
Odpověď: NE

Otázka 2: Byl/a jste hospitalizován/a v posledních 5 letech?
Odpověď: NE
`.trim().padEnd(600, " ");

const AML_ONLY_MARKDOWN = `
AML formulář — prohlášení o původu finančních prostředků

Politicky exponovaná osoba (PEP): NE
Skutečný majitel: Jan Novák

Prohlašuji, že prostředky pocházejí z řádné výdělečné činnosti.
`.trim().padEnd(300, " ");

const MODELATION_MARKDOWN = `
Modelace životního pojištění — NEZÁVAZNÝ ILUSTRATIVNÍ VÝPOČET

Tento dokument je nezávaznou modelací. Není finální smlouvou.
Pojistník: Jan Novák, nar. 1.1.1980
Modelované měsíční pojistné: 1 200 Kč
Modelovaná pojistná částka: 300 000 Kč
`.trim().padEnd(300, " ");

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("subdocument extraction orchestrator", () => {
  beforeEach(() => {
    mockHealthResponse.mockReset();
  });

  // SD01: bundle final_contract + health_questionnaire
  it("SD01: bundle with health questionnaire → extracts health section, contract data preserved", async () => {
    mockHealthResponse.mockResolvedValue({
      parsed: {
        healthSectionPresent: true,
        questionnaireEntries: [
          {
            participantName: "Jan Novák",
            participantRole: "pojistník",
            questionnairePresent: true,
            sectionSummary: "Zdravotní dotazník pojistníka bez pozitivních nálezů.",
            medicallyRelevantFlags: [],
          },
        ],
      },
    });

    const packetMeta = makePacketMeta({
      hasSensitiveAttachment: true,
      subdocumentCandidates: [
        {
          type: "final_contract",
          confidence: 0.9,
          label: "Finální smlouva",
          publishable: true,
        },
        {
          type: "health_questionnaire",
          confidence: 0.85,
          label: "Zdravotní dotazník",
          publishable: false,
          sensitivityHint: "health_data",
        },
      ],
    });

    const envelope = makeEnvelope();
    const result = await orchestrateSubdocumentExtraction(
      BUNDLE_WITH_HEALTH_MARKDOWN,
      packetMeta,
      envelope,
    );

    expect(result.orchestrationRan).toBe(true);

    // Health questionnaire should be populated
    expect(envelope.healthQuestionnaires).toBeTruthy();
    expect(envelope.healthQuestionnaires!.length).toBeGreaterThanOrEqual(1);
    expect(envelope.healthQuestionnaires![0].questionnairePresent).toBe(true);
    expect(envelope.healthQuestionnaires![0].linkedParticipantName).toBe("Jan Novák");
    expect(envelope.healthQuestionnaires![0].publishableAsSeparateDocument).toBe(false);

    // Contract data must NOT be corrupted by health extraction
    expect(envelope.participants).toHaveLength(2);
    expect(envelope.insuredRisks).toHaveLength(2);
    expect(envelope.investmentData?.strategy).toBe("Konzervativní");
    expect(envelope.paymentData?.accountNumber).toBe("123456789/0100");
  });

  // SD02: bundle modelation + final_contract
  it("SD02: bundle with modelation candidate → primary final_contract lifecycle preserved", async () => {
    mockHealthResponse.mockResolvedValue({
      parsed: { healthSectionPresent: false, questionnaireEntries: [] },
    });

    const packetMeta = makePacketMeta({
      primarySubdocumentType: "final_contract",
      subdocumentCandidates: [
        { type: "final_contract", confidence: 0.85, label: "Finální smlouva", publishable: true },
        { type: "modelation", confidence: 0.6, label: "Modelace", publishable: false },
      ],
    });

    const envelope = makeEnvelope({
      documentClassification: {
        primaryType: "life_insurance_contract",
        lifecycleStatus: "final_contract",
        documentIntent: "new_contract",
        confidence: 0.88,
        reasons: [],
      },
    });

    const result = await orchestrateSubdocumentExtraction(LONG_MARKDOWN, packetMeta, envelope);

    expect(result.orchestrationRan).toBe(true);
    // Final contract lifecycle must be preserved
    expect(envelope.documentClassification?.lifecycleStatus).toBe("final_contract");
    // Contract should remain publishable
    expect(envelope.publishHints?.contractPublishable).toBe(true);
  });

  // SD03: health questionnaire section not published as contract
  it("SD03: health questionnaire candidate → always publishableAsSeparateDocument=false", async () => {
    mockHealthResponse.mockResolvedValue({
      parsed: {
        healthSectionPresent: true,
        questionnaireEntries: [
          {
            participantName: "Jana Nováková",
            questionnairePresent: true,
            sectionSummary: "Zdravotní dotazník přítomen.",
            medicallyRelevantFlags: [],
          },
        ],
      },
    });

    const packetMeta = makePacketMeta({
      subdocumentCandidates: [
        { type: "health_questionnaire", confidence: 0.9, label: "Zdravotní dotazník", publishable: false },
        { type: "final_contract", confidence: 0.8, label: "Smlouva", publishable: true },
      ],
    });

    const envelope = makeEnvelope({ healthQuestionnaires: null });
    await orchestrateSubdocumentExtraction(BUNDLE_WITH_HEALTH_MARKDOWN, packetMeta, envelope);

    expect(envelope.healthQuestionnaires).toBeTruthy();
    for (const hq of envelope.healthQuestionnaires!) {
      expect(hq.publishableAsSeparateDocument).toBe(false);
    }
  });

  // SD04: modelation not published as final contract
  it("SD04: primary subdoc is modelation → publishHints.contractPublishable=false", async () => {
    mockHealthResponse.mockResolvedValue({
      parsed: { healthSectionPresent: false, questionnaireEntries: [] },
    });

    const packetMeta = makePacketMeta({
      primarySubdocumentType: "modelation",
      subdocumentCandidates: [
        { type: "modelation", confidence: 0.88, label: "Modelace", publishable: false },
      ],
    });

    const envelope = makeEnvelope({
      documentClassification: {
        primaryType: "life_insurance_modelation",
        lifecycleStatus: "final_contract", // intentionally mis-set to test correction
        documentIntent: "comparison",
        confidence: 0.75,
        reasons: [],
      },
      publishHints: {
        contractPublishable: true, // should be corrected to false
        reviewOnly: false,
        needsSplit: false,
        needsManualValidation: false,
        sensitiveAttachmentOnly: false,
        reasons: [],
      },
    });

    await orchestrateSubdocumentExtraction(MODELATION_MARKDOWN, packetMeta, envelope);

    expect(envelope.publishHints?.contractPublishable).toBe(false);
    expect(envelope.publishHints?.reviewOnly).toBe(true);
  });

  // SD05: final_contract retains payment data after orchestration
  it("SD05: orchestration does not corrupt paymentData on final_contract", async () => {
    mockHealthResponse.mockResolvedValue({
      parsed: { healthSectionPresent: false, questionnaireEntries: [] },
    });

    const packetMeta = makePacketMeta({
      primarySubdocumentType: "final_contract",
      subdocumentCandidates: [
        { type: "final_contract", confidence: 0.9, label: "Smlouva", publishable: true },
      ],
    });

    const envelope = makeEnvelope();
    const originalPaymentData = { ...envelope.paymentData };

    await orchestrateSubdocumentExtraction(LONG_MARKDOWN, packetMeta, envelope);

    expect(envelope.paymentData?.accountNumber).toBe(originalPaymentData.accountNumber);
    expect(envelope.paymentData?.variableSymbol).toBe(originalPaymentData.variableSymbol);
    expect(envelope.paymentData?.paymentFrequency).toBe(originalPaymentData.paymentFrequency);
  });

  // SD06: final_contract retains investment strategy after orchestration
  it("SD06: orchestration does not corrupt investmentData on final_contract", async () => {
    mockHealthResponse.mockResolvedValue({
      parsed: { healthSectionPresent: false, questionnaireEntries: [] },
    });

    const packetMeta = makePacketMeta({
      primarySubdocumentType: "final_contract",
      subdocumentCandidates: [
        { type: "final_contract", confidence: 0.9, label: "Smlouva", publishable: true },
      ],
    });

    const envelope = makeEnvelope();

    await orchestrateSubdocumentExtraction(LONG_MARKDOWN, packetMeta, envelope);

    expect(envelope.investmentData?.strategy).toBe("Konzervativní");
    expect(envelope.investmentData?.isContractualData).toBe(true);
    expect(envelope.investmentData?.isModeledData).toBe(false);
  });

  // SD07: participants not merged into single person
  it("SD07: orchestration preserves multi-person participants array", async () => {
    mockHealthResponse.mockResolvedValue({
      parsed: {
        healthSectionPresent: true,
        questionnaireEntries: [
          {
            participantName: "Jan Novák",
            participantRole: "pojistník",
            questionnairePresent: true,
          },
        ],
      },
    });

    const packetMeta = makePacketMeta({
      subdocumentCandidates: [
        { type: "final_contract", confidence: 0.85, label: "Smlouva", publishable: true },
        { type: "health_questionnaire", confidence: 0.8, label: "Zdravotní dotazník", publishable: false },
      ],
    });

    const envelope = makeEnvelope();
    await orchestrateSubdocumentExtraction(BUNDLE_WITH_HEALTH_MARKDOWN, packetMeta, envelope);

    // Both participants must remain distinct
    expect(envelope.participants).toHaveLength(2);
    const names = envelope.participants!.map((p) => p.fullName);
    expect(names).toContain("Jan Novák");
    expect(names).toContain("Jana Nováková");
  });

  // SD08: insuredRisks not relinked to wrong person
  it("SD08: insuredRisks remain linked to their original participants after orchestration", async () => {
    mockHealthResponse.mockResolvedValue({
      parsed: { healthSectionPresent: false, questionnaireEntries: [] },
    });

    const packetMeta = makePacketMeta({
      subdocumentCandidates: [
        { type: "final_contract", confidence: 0.9, label: "Smlouva", publishable: true },
      ],
    });

    const envelope = makeEnvelope();
    await orchestrateSubdocumentExtraction(LONG_MARKDOWN, packetMeta, envelope);

    // Risk for Jana must stay linked to Jana
    const disabilityRisk = envelope.insuredRisks!.find((r) => r.riskType === "disability");
    expect(disabilityRisk?.linkedParticipantName).toBe("Jana Nováková");

    // Risk for Jan must stay linked to Jan
    const deathRisk = envelope.insuredRisks!.find((r) => r.riskType === "death");
    expect(deathRisk?.linkedParticipantName).toBe("Jan Novák");
  });

  // SD09: AML/FATCA attachment-only remains non-publishable
  it("SD09: AML-only bundle → sensitiveAttachmentOnly=true, contractPublishable=false", async () => {
    mockHealthResponse.mockResolvedValue({
      parsed: { healthSectionPresent: false, questionnaireEntries: [] },
    });

    const packetMeta = makePacketMeta({
      primarySubdocumentType: "aml_fatca_form",
      hasSensitiveAttachment: true,
      hasUnpublishableSection: true,
      subdocumentCandidates: [
        {
          type: "aml_fatca_form",
          confidence: 0.88,
          label: "AML/FATCA formulář",
          publishable: false,
          sensitivityHint: "compliance",
        },
      ],
    });

    const envelope = makeEnvelope({
      publishHints: {
        contractPublishable: true, // should be corrected
        reviewOnly: false,
        needsSplit: false,
        needsManualValidation: false,
        sensitiveAttachmentOnly: false,
        reasons: [],
      },
    });

    await orchestrateSubdocumentExtraction(AML_ONLY_MARKDOWN, packetMeta, envelope);

    expect(envelope.publishHints?.sensitiveAttachmentOnly).toBe(true);
    expect(envelope.publishHints?.contractPublishable).toBe(false);
    expect(envelope.reviewWarnings?.some((w) => w.code === "aml_fatca_section_detected")).toBe(true);
  });

  // SD10: packet merge does not corrupt canonical fields
  it("SD10: orchestration is additive — existing canonical fields not corrupted", async () => {
    mockHealthResponse.mockResolvedValue({
      parsed: {
        healthSectionPresent: true,
        questionnaireEntries: [
          {
            participantName: "Jan Novák",
            questionnairePresent: true,
            medicallyRelevantFlags: [],
          },
        ],
      },
    });

    const packetMeta = makePacketMeta({
      subdocumentCandidates: [
        { type: "final_contract", confidence: 0.9, label: "Smlouva", publishable: true },
        { type: "health_questionnaire", confidence: 0.85, label: "Zdravotní dotazník", publishable: false },
      ],
    });

    const envelope = makeEnvelope();
    const preMutationParticipantCount = envelope.participants!.length;
    const preMutationRiskCount = envelope.insuredRisks!.length;

    await orchestrateSubdocumentExtraction(BUNDLE_WITH_HEALTH_MARKDOWN, packetMeta, envelope);

    // Participants and risks unchanged
    expect(envelope.participants).toHaveLength(preMutationParticipantCount);
    expect(envelope.insuredRisks).toHaveLength(preMutationRiskCount);

    // Health added on top
    expect((envelope.healthQuestionnaires?.length ?? 0)).toBeGreaterThanOrEqual(1);

    // packetMeta wired through
    expect(envelope.packetMeta?.isBundle).toBe(true);
  });

  // SD11: non-bundle document skips orchestration
  it("SD11: non-bundle document → orchestrationRan=false, no mutations", async () => {
    const packetMeta = makePacketMeta({ isBundle: false, subdocumentCandidates: [] });
    const envelope = makeEnvelope();

    const result = await orchestrateSubdocumentExtraction(LONG_MARKDOWN, packetMeta, envelope);

    expect(result.orchestrationRan).toBe(false);
    expect(result.mutationCount).toBe(0);
    expect(mockHealthResponse).not.toHaveBeenCalled();
  });

  // SD12: short text skips orchestration
  it("SD12: markdown text too short → orchestrationRan=false", async () => {
    const packetMeta = makePacketMeta({
      subdocumentCandidates: [
        { type: "final_contract", confidence: 0.9, label: "Smlouva", publishable: true },
      ],
    });
    const envelope = makeEnvelope();

    const result = await orchestrateSubdocumentExtraction("krátký text", packetMeta, envelope);

    expect(result.orchestrationRan).toBe(false);
    expect(mockHealthResponse).not.toHaveBeenCalled();
  });

  // SD13: describeSubdocumentExtractionRoute labels
  it("SD13: route description reflects bundle structure", () => {
    const single = makePacketMeta({ isBundle: false, subdocumentCandidates: [] });
    expect(describeSubdocumentExtractionRoute(single)).toBe("single_document");

    const bundle = makePacketMeta({
      primarySubdocumentType: "final_contract",
      subdocumentCandidates: [
        { type: "final_contract", confidence: 0.9, label: "Smlouva", publishable: true },
        { type: "health_questionnaire", confidence: 0.8, label: "Zdravotní dotazník", publishable: false },
      ],
    });
    const route = describeSubdocumentExtractionRoute(bundle);
    expect(route).toContain("bundle");
    expect(route).toContain("final_contract");
    expect(route).toContain("health_questionnaire");
  });

  // SD14: publishHints only strengthened, never weakened
  it("SD14: strengthenPublishHints never removes existing hard blocks", async () => {
    mockHealthResponse.mockResolvedValue({
      parsed: { healthSectionPresent: false, questionnaireEntries: [] },
    });

    // Start with very strict publishHints
    const packetMeta = makePacketMeta({
      primarySubdocumentType: "final_contract",
      subdocumentCandidates: [
        { type: "final_contract", confidence: 0.9, label: "Smlouva", publishable: true },
      ],
    });

    const envelope = makeEnvelope({
      publishHints: {
        contractPublishable: false, // already blocked — must stay blocked
        reviewOnly: true,
        needsSplit: true,
        needsManualValidation: true,
        sensitiveAttachmentOnly: true,
        reasons: ["pre_existing_block"],
      },
    });

    await orchestrateSubdocumentExtraction(LONG_MARKDOWN, packetMeta, envelope);

    // Hard blocks must not be cleared
    expect(envelope.publishHints?.contractPublishable).toBe(false);
    expect(envelope.publishHints?.sensitiveAttachmentOnly).toBe(true);
    expect(envelope.publishHints?.needsManualValidation).toBe(true);
    // Pre-existing reasons preserved
    expect(envelope.publishHints?.reasons).toContain("pre_existing_block");
  });

  // Bonus: AML detection adds warning to reviewWarnings
  it("BONUS: mixed bundle with AML → reviewWarning added, needsSplit=true", async () => {
    mockHealthResponse.mockResolvedValue({
      parsed: { healthSectionPresent: false, questionnaireEntries: [] },
    });

    const packetMeta = makePacketMeta({
      hasSensitiveAttachment: true,
      subdocumentCandidates: [
        { type: "final_contract", confidence: 0.85, label: "Finální smlouva", publishable: true },
        { type: "aml_fatca_form", confidence: 0.75, label: "AML formulář", publishable: false },
      ],
    });

    const envelope = makeEnvelope();
    await orchestrateSubdocumentExtraction(BUNDLE_WITH_HEALTH_MARKDOWN, packetMeta, envelope);

    // Bundle with contract + AML → needsSplit, manual validation
    expect(envelope.publishHints?.needsSplit).toBe(true);
    expect(envelope.publishHints?.needsManualValidation).toBe(true);
    const amlWarn = envelope.reviewWarnings?.find((w) => w.code === "aml_fatca_section_detected");
    expect(amlWarn).toBeTruthy();
  });
});
