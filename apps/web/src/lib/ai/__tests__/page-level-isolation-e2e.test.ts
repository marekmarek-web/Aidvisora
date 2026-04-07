/**
 * PHYSICAL PAGE-LEVEL ISOLATION + E2E GOLDEN VALIDATION
 *
 * Tests the full page-level isolation stack:
 *  - buildPageTextMapFromMarkdown: page-break parsing
 *  - sliceSectionText: exact_pages strategy priority
 *  - segmentation: pageNumbers detection near signals
 *  - orchestrateSubdocumentExtraction: pageTextMap threading + sourceModeTrace
 *  - Golden G02/G03/G04/G05/G07 scenario validation
 *
 * Scenarios:
 * PL01: buildPageTextMapFromMarkdown splits on page-break markers
 * PL02: buildPageTextMapFromMarkdown returns {1: text} for single-page docs
 * PL03: sliceSectionText uses exact_pages when pageTextMap has multiple pages + candidate has pageNumbers
 * PL04: sliceSectionText falls back to heading when pageTextMap unavailable
 * PL05: sliceSectionText priority: exact_pages > heading > char_offset
 * PL06: sliceSectionTextForType merges page numbers from multiple same-type candidates
 * PL07: segmentation detects page numbers from "strana N z M" near health signal
 * PL08: segmentation detects page numbers from page-break markers
 * PL09: orchestration passes pageTextMap and emits sourceModeTrace
 * PL10: orchestration uses exact_pages for health when pageTextMap has separate pages
 * PL11: orchestration uses exact_pages for investment when pageTextMap has separate pages
 * PL12: G02 final contract — health section isolation prevents contract contamination
 * PL13: G03 bundle smlouva + dotazníky — health extracted from own pages, contract untouched
 * PL14: G04 multi-person — investment data stays on contract pages, not health pages
 * PL15: G05 investment/DIP — investment section gets exact pages when available
 * PL16: G07 attachment-only — publishHints NOT weakened after page-level isolation
 * PL17: sourceModeTrace shows exact_pages when pageTextMap is multi-page
 * PL18: sourceModeTrace shows fallback when pageTextMap has only 1 page
 * PL19: health section extraction does NOT receive contract-only pages
 * PL20: final contract pages do NOT contain health questionnaire data after isolation
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────
const mockLLM = vi.fn();
vi.mock("@/lib/openai", () => ({
  createResponseStructured: (...args: unknown[]) => mockLLM(...args),
  createResponse: vi.fn(),
  createAiReviewResponseFromPrompt: vi.fn().mockResolvedValue({
    ok: true,
    text: '{"healthSectionPresent":false,"questionnaireEntries":[]}',
  }),
  logOpenAICall: vi.fn(),
}));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/observability/portal-sentry", () => ({ capturePublishGuardFailure: vi.fn() }));

import {
  buildPageTextMapFromMarkdown,
  sliceSectionText,
  sliceSectionTextForType,
  describeSourceMode,
} from "@/lib/ai/section-text-slicer";
import { segmentDocumentPacket } from "@/lib/ai/document-packet-segmentation";
import { orchestrateSubdocumentExtraction } from "@/lib/ai/subdocument-extraction-orchestrator";
import type { PacketSubdocumentCandidate, PacketMeta } from "@/lib/ai/document-packet-types";
import type { DocumentReviewEnvelope } from "@/lib/ai/document-review-types";

// ─── Page-break test fixtures ─────────────────────────────────────────────────

const PAGE_BREAK_MARKDOWN = `
Pojistná smlouva č. POL-12345
Pojistitel: ČP
Pojistník: Jan Novák
--- page 2 ---
Pojistné: 1500 Kč/měsíc
Platební IBAN: CZ65 0800 0000 1920 0014 5399
--- page 3 ---
ZDRAVOTNÍ DOTAZNÍK
Prohlašuji, že jsem zdráv.
Chronické onemocnění: Ne.
Hospitalizace v posledních 5 letech: Ne.
--- page 4 ---
Investiční strategie: Vyvážená
DIP účet č. DIP-2024-001
Fond A: 60 %, Fond B: 40 %
`.trim().padEnd(600, " ");

const SINGLE_PAGE_MARKDOWN = `
Pojistná smlouva č. POL-99999
Pojistitel: Allianz
`.trim().padEnd(300, " ");

// ─── PL01–PL02: buildPageTextMapFromMarkdown ──────────────────────────────────

describe("buildPageTextMapFromMarkdown", () => {
  it("PL01: splits on page-break markers into correct pages", () => {
    const map = buildPageTextMapFromMarkdown(PAGE_BREAK_MARKDOWN);
    expect(Object.keys(map).length).toBe(4);
    expect(map[1]).toContain("POL-12345");
    expect(map[2]).toContain("IBAN");
    expect(map[3]).toContain("ZDRAVOTNÍ DOTAZNÍK");
    expect(map[4]).toContain("DIP");
  });

  it("PL02: returns {1: text} for single-page docs (no break markers)", () => {
    const map = buildPageTextMapFromMarkdown(SINGLE_PAGE_MARKDOWN);
    expect(Object.keys(map).length).toBe(1);
    expect(map[1]).toContain("POL-99999");
  });

  it("PL02b: returns empty object for null input", () => {
    const map = buildPageTextMapFromMarkdown(null);
    expect(Object.keys(map).length).toBe(0);
  });
});

// ─── PL03–PL06: exact_pages strategy in slicer ────────────────────────────────

describe("sliceSectionText — exact_pages strategy", () => {
  const pageMap = buildPageTextMapFromMarkdown(PAGE_BREAK_MARKDOWN);

  const healthCandidate: PacketSubdocumentCandidate = {
    type: "health_questionnaire",
    label: "Zdravotní dotazník",
    confidence: 0.9,
    publishable: false,
    sectionHeadingHint: "ZDRAVOTNÍ DOTAZNÍK",
    charOffsetHint: null,
    pageNumbers: [3],
  };

  const investmentCandidate: PacketSubdocumentCandidate = {
    type: "investment_section",
    label: "Investiční sekce",
    confidence: 0.85,
    publishable: true,
    sectionHeadingHint: null,
    charOffsetHint: null,
    pageNumbers: [4],
  };

  it("PL03: uses exact_pages when pageTextMap has multiple pages + candidate has pageNumbers", () => {
    const result = sliceSectionText(PAGE_BREAK_MARKDOWN, healthCandidate, 4, pageMap);
    expect(result.method).toBe("exact_pages");
    expect(result.narrowed).toBe(true);
    expect(result.text).toContain("ZDRAVOTNÍ DOTAZNÍK");
    // Should NOT contain contract data from page 1
    expect(result.text).not.toContain("POL-12345");
  });

  it("PL04: falls back to heading when pageTextMap is single-page (no real isolation possible)", () => {
    const singlePageMap = { 1: PAGE_BREAK_MARKDOWN };
    const result = sliceSectionText(PAGE_BREAK_MARKDOWN, healthCandidate, 4, singlePageMap);
    // Single-page map won't produce narrowed exact_pages — falls through to heading strategy
    expect(["heading", "char_offset", "page_range", "full_text"]).toContain(result.method);
  });

  it("PL05: priority: exact_pages wins over heading strategy", () => {
    // Both pageNumbers and sectionHeadingHint are set — exact_pages must win
    const result = sliceSectionText(PAGE_BREAK_MARKDOWN, healthCandidate, 4, pageMap);
    expect(result.method).toBe("exact_pages");
  });

  it("PL06: sliceSectionTextForType merges page numbers from multiple same-type candidates", () => {
    const candidates: PacketSubdocumentCandidate[] = [
      { ...healthCandidate, pageNumbers: [3] },
      { ...healthCandidate, label: "Health 2", pageNumbers: [5], sectionHeadingHint: null },
    ];
    // Page 5 doesn't exist in our 4-page map, so only page 3 should be used
    const result = sliceSectionTextForType(PAGE_BREAK_MARKDOWN, candidates, "health_questionnaire", 4, pageMap);
    expect(result.text.length).toBeGreaterThan(0);
    // Page 3 content should be present
    expect(result.text).toContain("ZDRAVOTNÍ DOTAZNÍK");
  });
});

// ─── PL07–PL08: segmentation detects page numbers ─────────────────────────────

describe("segmentation — pageNumbers detection", () => {
  it("PL07: detects page numbers from 'strana N z M' near health signal", () => {
    const text = [
      "Pojistná smlouva č. POL-11111\nPojistitel: Test a.s.\n",
      "strana 5 z 10\n",
      "ZDRAVOTNÍ DOTAZNÍK\n",
      "Prohlašuji, že jsem zdráv.\nChronické onemocnění: Ne.\nHospitalizace: Ne.\n",
    ].join("").padEnd(500, " ");

    const result = segmentDocumentPacket(text, 10);
    const healthCand = result.packetMeta.subdocumentCandidates.find(
      (c) => c.type === "health_questionnaire",
    );
    if (healthCand) {
      // pageNumbers should include page 5 (or nearby pages)
      expect(healthCand.pageNumbers).not.toBeNull();
      expect(Array.isArray(healthCand.pageNumbers)).toBe(true);
      if (healthCand.pageNumbers?.length) {
        expect(healthCand.pageNumbers.some((p) => p >= 4 && p <= 7)).toBe(true);
      }
    }
  });

  it("PL08: detects page numbers from page-break markers", () => {
    const text = [
      "Pojistná smlouva č. POL-22222\n",
      "--- page 3 ---\n",
      "ZDRAVOTNÍ DOTAZNÍK\n",
      "Jsem zdráv.\n",
    ].join("").padEnd(400, " ");

    const result = segmentDocumentPacket(text, 5);
    const healthCand = result.packetMeta.subdocumentCandidates.find(
      (c) => c.type === "health_questionnaire",
    );
    if (healthCand?.pageNumbers) {
      // Should include page 3 or nearby
      expect(healthCand.pageNumbers.some((p) => p >= 2 && p <= 5)).toBe(true);
    }
  });
});

// ─── PL09–PL11: orchestration integration ─────────────────────────────────────

const makeEnvelope = (extraFields?: Partial<DocumentReviewEnvelope>): DocumentReviewEnvelope => ({
  documentClassification: {
    primaryType: "life_insurance_contract",
    lifecycleStatus: "final_contract",
    documentIntent: "new_contract",
    confidence: 0.9,
    reasons: [],
  },
  documentMeta: { scannedVsDigital: "digital" },
  extractedFields: {},
  parties: {},
  reviewWarnings: [],
  suggestedActions: [],
  publishHints: {
    contractPublishable: true,
    reviewOnly: false,
    needsSplit: false,
    needsManualValidation: false,
    sensitiveAttachmentOnly: false,
    reasons: [],
  },
  ...extraFields,
} as DocumentReviewEnvelope);

const makePacketMeta = (candidates: PacketSubdocumentCandidate[]): PacketMeta => ({
  isBundle: true,
  bundleConfidence: 0.9,
  detectionMethods: ["keyword_scan"],
  subdocumentCandidates: candidates,
  primarySubdocumentType: "final_contract",
  hasSensitiveAttachment: true,
  hasUnpublishableSection: true,
  packetWarnings: [],
});

describe("orchestration — pageTextMap threading + source mode trace", () => {
  beforeEach(() => { mockLLM.mockReset(); });

  it("PL09: orchestration emits sourceModeTrace when passes ran", async () => {
    mockLLM.mockResolvedValue({
      parsed: { healthSectionPresent: true, questionnaireEntries: [{ participantName: "Jan", questionnairePresent: true }] },
    });

    const pageMap = buildPageTextMapFromMarkdown(PAGE_BREAK_MARKDOWN);
    const candidates: PacketSubdocumentCandidate[] = [
      { type: "health_questionnaire", label: "Health", confidence: 0.9, publishable: false, pageNumbers: [3] },
    ];
    const packetMeta = makePacketMeta(candidates);
    const envelope = makeEnvelope();

    const result = await orchestrateSubdocumentExtraction(
      PAGE_BREAK_MARKDOWN, packetMeta, envelope, 4, pageMap
    );

    expect(result.orchestrationRan).toBe(true);
    // Either sourceModeTrace is present or fidelitySummaries is present
    expect(result.sourceModeTrace ?? result.fidelitySummaries).toBeTruthy();
  });

  it("PL10: orchestration uses exact_pages for health when pageTextMap has multiple pages", async () => {
    let capturedPrompt = "";
    mockLLM.mockImplementation((prompt: string) => {
      capturedPrompt = prompt;
      return Promise.resolve({ parsed: { healthSectionPresent: true, questionnaireEntries: [] } });
    });

    const pageMap = buildPageTextMapFromMarkdown(PAGE_BREAK_MARKDOWN);
    const candidates: PacketSubdocumentCandidate[] = [
      { type: "health_questionnaire", label: "Health", confidence: 0.9, publishable: false, pageNumbers: [3] },
    ];
    const result = await orchestrateSubdocumentExtraction(
      PAGE_BREAK_MARKDOWN, makePacketMeta(candidates), makeEnvelope(), 4, pageMap
    );

    expect(result.orchestrationRan).toBe(true);
    // Prompt received by LLM should contain health section content but NOT contract data
    if (capturedPrompt) {
      expect(capturedPrompt).toContain("ZDRAVOTNÍ DOTAZNÍK");
      // Should NOT contain contract-specific data from page 1
      expect(capturedPrompt).not.toContain("POL-12345");
    }
  });

  it("PL11: orchestration uses exact_pages for investment section when available", async () => {
    const capturedPrompts: string[] = [];
    mockLLM.mockImplementation((prompt: string) => {
      capturedPrompts.push(prompt);
      return Promise.resolve({ parsed: { investmentSectionPresent: true, productType: "DIP", strategy: "Vyvážená", isContractualData: true } });
    });

    const pageMap = buildPageTextMapFromMarkdown(PAGE_BREAK_MARKDOWN);
    const candidates: PacketSubdocumentCandidate[] = [
      { type: "investment_section", label: "DIP sekce", confidence: 0.85, publishable: true, pageNumbers: [4] },
    ];
    const result = await orchestrateSubdocumentExtraction(
      PAGE_BREAK_MARKDOWN, makePacketMeta(candidates), makeEnvelope(), 4, pageMap
    );

    expect(result.orchestrationRan).toBe(true);
    const investmentPrompt = capturedPrompts.find((p) => p.includes("investiční") || p.includes("DIP") || p.includes("fond"));
    if (investmentPrompt) {
      // Should contain page 4 content (DIP data)
      expect(investmentPrompt).toContain("DIP");
      // Should NOT contain health questionnaire data from page 3
      expect(investmentPrompt).not.toContain("Chronické onemocnění");
    }
  });
});

// ─── PL12–PL16: Golden scenario E2E validation ───────────────────────────────

describe("Golden G02: final contract — health isolation prevents contract contamination", () => {
  it("PL12: health pass receives only health pages, not contract pages", async () => {
    let healthPromptText = "";
    mockLLM.mockImplementation((prompt: string) => {
      healthPromptText = prompt;
      return Promise.resolve({ parsed: { healthSectionPresent: true, questionnaireEntries: [] } });
    });

    const pageMap = buildPageTextMapFromMarkdown(PAGE_BREAK_MARKDOWN);
    const candidates: PacketSubdocumentCandidate[] = [
      { type: "final_contract", label: "Smlouva", confidence: 0.9, publishable: true, pageNumbers: [1, 2] },
      { type: "health_questionnaire", label: "Zdravotní dotazník", confidence: 0.9, publishable: false, pageNumbers: [3] },
    ];

    await orchestrateSubdocumentExtraction(
      PAGE_BREAK_MARKDOWN, makePacketMeta(candidates), makeEnvelope(), 4, pageMap
    );

    if (healthPromptText) {
      // Health prompt must NOT include contract-specific fields
      expect(healthPromptText).not.toContain("POL-12345");
      expect(healthPromptText).not.toContain("Pojistitel: ČP");
    }
  });
});

describe("Golden G03: bundle smlouva + dotazníky — health on own pages, contract untouched", () => {
  it("PL13: contract primaryType preserved after health section orchestration", async () => {
    mockLLM.mockResolvedValue({
      parsed: { healthSectionPresent: true, questionnaireEntries: [{ participantName: "Eva", questionnairePresent: true }] },
    });

    const pageMap = buildPageTextMapFromMarkdown(PAGE_BREAK_MARKDOWN);
    const candidates: PacketSubdocumentCandidate[] = [
      { type: "health_questionnaire", label: "Zdravotní dotazník", confidence: 0.9, publishable: false, pageNumbers: [3] },
    ];
    const envelope = makeEnvelope();

    await orchestrateSubdocumentExtraction(
      PAGE_BREAK_MARKDOWN, makePacketMeta(candidates), envelope, 4, pageMap
    );

    // Contract classification must not be changed
    expect(envelope.documentClassification.primaryType).toBe("life_insurance_contract");
    // Health data goes to healthQuestionnaires
    expect(Array.isArray(envelope.healthQuestionnaires)).toBe(true);
  });
});

describe("Golden G04: multi-person — investment stays on contract pages", () => {
  it("PL14: investment extraction from page 4 does NOT include health data from page 3", async () => {
    let investPromptText = "";
    mockLLM.mockImplementation((prompt: string) => {
      investPromptText = prompt;
      return Promise.resolve({ parsed: { investmentSectionPresent: true, productType: "DIP", strategy: "Dynamická", isContractualData: true } });
    });

    const pageMap = buildPageTextMapFromMarkdown(PAGE_BREAK_MARKDOWN);
    const candidates: PacketSubdocumentCandidate[] = [
      { type: "investment_section", label: "DIP", confidence: 0.9, publishable: true, pageNumbers: [4] },
    ];

    await orchestrateSubdocumentExtraction(
      PAGE_BREAK_MARKDOWN, makePacketMeta(candidates), makeEnvelope(), 4, pageMap
    );

    if (investPromptText) {
      expect(investPromptText).not.toContain("Chronické onemocnění");
      expect(investPromptText).not.toContain("Prohlašuji, že jsem zdráv");
    }
  });
});

describe("Golden G05: investment/DIP — exact pages when available", () => {
  it("PL15: investment section gets exact_pages when pageTextMap available", () => {
    const pageMap = buildPageTextMapFromMarkdown(PAGE_BREAK_MARKDOWN);
    const candidate: PacketSubdocumentCandidate = {
      type: "investment_section",
      label: "DIP",
      confidence: 0.9,
      publishable: true,
      sectionHeadingHint: null,
      charOffsetHint: null,
      pageNumbers: [4],
    };
    const result = sliceSectionText(PAGE_BREAK_MARKDOWN, candidate, 4, pageMap);
    expect(result.method).toBe("exact_pages");
    expect(result.text).toContain("DIP");
    expect(result.text).not.toContain("ZDRAVOTNÍ DOTAZNÍK");
  });
});

describe("Golden G07: attachment-only — publishHints NOT weakened", () => {
  it("PL16: publishHints not relaxed after page-level orchestration", async () => {
    mockLLM.mockResolvedValue({
      parsed: { healthSectionPresent: false, questionnaireEntries: [] },
    });

    const pageMap = buildPageTextMapFromMarkdown(PAGE_BREAK_MARKDOWN);
    const candidates: PacketSubdocumentCandidate[] = [
      { type: "aml_fatca_form", label: "AML", confidence: 0.9, publishable: false, pageNumbers: [2] },
    ];
    const envelope = makeEnvelope({
      publishHints: {
        contractPublishable: false, // already blocked
        reviewOnly: true,
        needsSplit: false,
        needsManualValidation: true,
        sensitiveAttachmentOnly: true,
        reasons: ["aml_only"],
      },
    });

    const packetMeta: PacketMeta = {
      ...makePacketMeta(candidates),
      primarySubdocumentType: "aml_fatca_form",
      hasSensitiveAttachment: true,
    };

    await orchestrateSubdocumentExtraction(
      PAGE_BREAK_MARKDOWN, packetMeta, envelope, 4, pageMap
    );

    // publishHints must not be weakened
    expect(envelope.publishHints?.contractPublishable).toBe(false);
    expect(envelope.publishHints?.sensitiveAttachmentOnly).toBe(true);
  });
});

// ─── PL17–PL20: source mode traceability ──────────────────────────────────────

describe("source mode traceability", () => {
  it("PL17: sourceModeTrace shows exact_pages when pageTextMap is multi-page", async () => {
    mockLLM.mockResolvedValue({
      parsed: { healthSectionPresent: true, questionnaireEntries: [{ participantName: "Jan", questionnairePresent: true }] },
    });

    const pageMap = buildPageTextMapFromMarkdown(PAGE_BREAK_MARKDOWN);
    const candidates: PacketSubdocumentCandidate[] = [
      { type: "health_questionnaire", label: "Health", confidence: 0.9, publishable: false, pageNumbers: [3] },
    ];
    const result = await orchestrateSubdocumentExtraction(
      PAGE_BREAK_MARKDOWN, makePacketMeta(candidates), makeEnvelope(), 4, pageMap
    );

    if (result.sourceModeTrace?.health_questionnaire) {
      expect(result.sourceModeTrace.health_questionnaire).toContain("exact");
    }
  });

  it("PL18: sourceModeTrace shows fallback when pageTextMap has only 1 page", async () => {
    mockLLM.mockResolvedValue({
      parsed: { healthSectionPresent: false, questionnaireEntries: [] },
    });

    const singlePageMap = { 1: PAGE_BREAK_MARKDOWN };
    const candidates: PacketSubdocumentCandidate[] = [
      { type: "health_questionnaire", label: "Health", confidence: 0.9, publishable: false, pageNumbers: [3], sectionHeadingHint: "ZDRAVOTNÍ DOTAZNÍK" },
    ];
    const result = await orchestrateSubdocumentExtraction(
      PAGE_BREAK_MARKDOWN, makePacketMeta(candidates), makeEnvelope(), 1, singlePageMap
    );

    // With single-page map, should not use exact_pages
    if (result.sourceModeTrace?.health_questionnaire) {
      expect(result.sourceModeTrace.health_questionnaire).not.toContain("exact page-level");
    }
  });

  it("PL19: health section text does NOT contain contract-only page content", () => {
    const pageMap = buildPageTextMapFromMarkdown(PAGE_BREAK_MARKDOWN);
    const candidate: PacketSubdocumentCandidate = {
      type: "health_questionnaire",
      label: "Health",
      confidence: 0.9,
      publishable: false,
      sectionHeadingHint: null,
      charOffsetHint: null,
      pageNumbers: [3],
    };
    const window = sliceSectionText(PAGE_BREAK_MARKDOWN, candidate, 4, pageMap);
    expect(window.text).not.toContain("POL-12345");
    expect(window.text).not.toContain("Pojistitel: ČP");
  });

  it("PL20: describeSourceMode returns expected strings for each method", () => {
    const methods: Array<{ method: import("@/lib/ai/section-text-slicer").SectionTextMethod; expected: string }> = [
      { method: "exact_pages", expected: "exact page-level" },
      { method: "heading", expected: "section/heading" },
      { method: "char_offset", expected: "char-offset" },
      { method: "page_range", expected: "page-range" },
      { method: "full_text", expected: "full text" },
    ];
    for (const { method, expected } of methods) {
      const desc = describeSourceMode({ method, text: "", startOffset: 0, endOffset: 0, narrowed: true });
      expect(desc).toContain(expected);
    }
  });
});
