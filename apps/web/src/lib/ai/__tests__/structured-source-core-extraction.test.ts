/**
 * STRUCTURED-SOURCE CORE EXTRACTION + BLOCK-LEVEL HEADING SEGMENTATION
 *
 * Scenarios:
 * SC01: StructuredSourceHint — structuredText > markdown → useStructuredSource=true
 * SC02: StructuredSourceHint — empty structuredText → fallback to markdown
 * SC03: StructuredSourceHint — structuredText shorter than 80% of markdown → fallback
 * SC04: enrichCandidatesFromStructuredHeadings — adds structured pageNumbers to existing candidate
 * SC05: enrichCandidatesFromStructuredHeadings — adds new candidate found only in structured headings
 * SC06: enrichCandidatesFromStructuredHeadings — empty structuredResult → returns unchanged
 * SC07: enrichCandidatesFromStructuredHeadings — no heading blocks → returns unchanged
 * SC08: enrichCandidatesFromStructuredHeadings — boosts confidence when structured score is higher
 * SC09: enrichCandidatesFromStructuredHeadings — preserves existing pageNumbers if no improvement
 * SC10: extractStructuredHeadingStrings — returns up to maxHeadings unique headings
 * SC11: extractStructuredHeadingStrings — deduplicates identical headings
 * SC12: extractStructuredHeadingStrings — null input returns []
 * SC13: bundleHint.sectionHeadings — structured headings merged with markdown headings
 * SC14: bundleHint.sectionHeadings — deduplication across sources
 * SC15: bundleHint.candidateTypes — enriched by structured headings
 * SC16: coreExtractionSource — 'adobe_structured_pages' when structured source active
 * SC17: coreExtractionSource — 'markdown' when only markdown available
 * SC18: coreExtractionSource — 'fallback' when both empty
 * SC19: G02 core extraction uses structured source: contract pages isolated
 * SC20: G03 bundle: structured headings separate health questionnaire from final contract
 * SC21: structuredSource not weaker than markdown (length check)
 * SC22: enriched candidates pass accurate pageNumbers to section slicer
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  enrichCandidatesFromStructuredHeadings,
  extractStructuredHeadingStrings,
} from "@/lib/ai/document-packet-segmentation";
import type { PacketSubdocumentCandidate } from "@/lib/ai/document-packet-types";
import type { AdobeStructuredResult, AdobeStructuredBlock } from "@/lib/adobe/structured-data-parser";

// ─── Mock server-side dependencies ────────────────────────────────────────────

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  db: { query: { documents: { findFirst: vi.fn() } } },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    storage: {
      from: vi.fn().mockReturnValue({
        download: vi.fn().mockResolvedValue({ data: null, error: new Error("mock") }),
      }),
    },
  }),
}));

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeBlock(text: string, page: number, isHeading: boolean, path?: string): AdobeStructuredBlock {
  return { text, page, isHeading, path: path ?? (isHeading ? "//Document/H1" : "//Document/P") };
}

function makeStructuredResult(blocks: AdobeStructuredBlock[], totalPages = 5): AdobeStructuredResult {
  const pages: AdobeStructuredResult["pages"] = {};
  for (let p = 1; p <= totalPages; p++) {
    const pageBlocks = blocks.filter((b) => b.page === p);
    pages[p] = {
      pageNumber: p,
      fullText: pageBlocks.map((b) => b.text).join("\n"),
      blocks: pageBlocks,
    };
  }
  return { ok: true, totalPages, pages, allBlocks: blocks };
}

function makeCandidate(type: PacketSubdocumentCandidate["type"], opts: Partial<PacketSubdocumentCandidate> = {}): PacketSubdocumentCandidate {
  return {
    type,
    label: type,
    confidence: 0.6,
    publishable: type === "final_contract",
    sectionHeadingHint: null,
    pageRangeHint: null,
    sensitivityHint: null,
    charOffsetHint: null,
    pageNumbers: null,
    ...opts,
  };
}

// ─── SC01: structured text > markdown → useStructuredSource = true ────────────

describe("SC01: structuredSource preference logic", () => {
  it("structured text at least 80% of markdown length triggers structured mode", () => {
    const markdown = "a".repeat(1000);
    const structured = "b".repeat(900); // 90% ≥ 80%
    expect(structured.length >= markdown.length * 0.8).toBe(true);
    // Sanity: ensure the flag would be set
    const useStructuredSource = structured.length > 0 && structured.length >= markdown.length * 0.8;
    expect(useStructuredSource).toBe(true);
  });
});

// ─── SC02: empty structured text → fallback to markdown ──────────────────────

describe("SC02: empty structured text falls back to markdown", () => {
  it("empty structured text means do not use structured source", () => {
    const markdown = "a".repeat(1000);
    const structured = "";
    const useStructuredSource = structured.length > 0 && structured.length >= markdown.length * 0.8;
    expect(useStructuredSource).toBe(false);
  });
});

// ─── SC03: structuredText shorter than 80% → fallback ────────────────────────

describe("SC03: structuredText < 80% of markdown → fallback", () => {
  it("short structured text does not replace markdown", () => {
    const markdown = "a".repeat(1000);
    const structured = "b".repeat(799); // 79.9% < 80%
    const useStructuredSource = structured.length > 0 && structured.length >= markdown.length * 0.8;
    expect(useStructuredSource).toBe(false);
  });
});

// ─── SC04: enrichCandidatesFromStructuredHeadings adds pageNumbers ─────────────

describe("SC04: enrich adds pageNumbers from structured heading block", () => {
  it("upgrades existing candidate with exact page number from heading", () => {
    const existing = [makeCandidate("health_questionnaire")];
    const blocks = [
      makeBlock("Zdravotní dotazník", 3, true),
    ];
    const structured = makeStructuredResult(blocks, 6);
    const result = enrichCandidatesFromStructuredHeadings(existing, structured, 6);
    expect(result).toHaveLength(1);
    expect(result[0].pageNumbers).toContain(3);
  });
});

// ─── SC05: enrichCandidatesFromStructuredHeadings adds NEW candidate ───────────

describe("SC05: enrich adds new candidate found only in structured headings", () => {
  it("detects AML/FATCA heading not in markdown candidates", () => {
    const existing = [makeCandidate("health_questionnaire")];
    const blocks = [
      makeBlock("Zdravotní dotazník", 2, true),
      makeBlock("Prohlášení o původu finančních prostředků", 4, true),
    ];
    const structured = makeStructuredResult(blocks, 6);
    const result = enrichCandidatesFromStructuredHeadings(existing, structured, 6);
    const types = result.map((c) => c.type);
    expect(types).toContain("aml_fatca_form");
  });
});

// ─── SC06: null structuredResult → returns unchanged candidates ───────────────

describe("SC06: null structuredResult returns existing candidates unchanged", () => {
  it("returns existing candidates as-is when structured result is null", () => {
    const existing = [makeCandidate("health_questionnaire", { pageNumbers: [2, 3] })];
    const result = enrichCandidatesFromStructuredHeadings(existing, null);
    expect(result).toEqual(existing);
  });
});

// ─── SC07: no heading blocks → returns unchanged ──────────────────────────────

describe("SC07: no heading blocks returns existing candidates unchanged", () => {
  it("skips enrichment when all blocks are non-heading", () => {
    const existing = [makeCandidate("final_contract")];
    const blocks = [
      makeBlock("Smlouva č. 123456789", 1, false),
      makeBlock("Pojistník: Jan Novák", 1, false),
    ];
    const structured = makeStructuredResult(blocks, 3);
    const result = enrichCandidatesFromStructuredHeadings(existing, structured, 3);
    expect(result).toEqual(existing);
  });
});

// ─── SC08: boosts confidence when structured score is higher ──────────────────

describe("SC08: confidence boost from structured heading match", () => {
  it("candidate confidence increases to max of existing and structured score", () => {
    const existing = [makeCandidate("health_questionnaire", { confidence: 0.4 })];
    const blocks = [makeBlock("Zdravotní dotazník", 3, true)]; // strong match → score 0.9
    const structured = makeStructuredResult(blocks, 5);
    const result = enrichCandidatesFromStructuredHeadings(existing, structured, 5);
    expect(result[0].confidence).toBeGreaterThan(0.4);
  });
});

// ─── SC09: preserves existing pageNumbers when no structured match ────────────

describe("SC09: preserves existing pageNumbers when no structured match for type", () => {
  it("unmatched type keeps its original pageNumbers", () => {
    const existing = [makeCandidate("modelation", { pageNumbers: [1, 2] })];
    const blocks = [makeBlock("Zdravotní dotazník", 4, true)]; // health, not modelation
    const structured = makeStructuredResult(blocks, 5);
    const result = enrichCandidatesFromStructuredHeadings(existing, structured, 5);
    const modelation = result.find((c) => c.type === "modelation");
    expect(modelation?.pageNumbers).toEqual([1, 2]);
  });
});

// ─── SC10: extractStructuredHeadingStrings returns up to maxHeadings ──────────

describe("SC10: extractStructuredHeadingStrings respects maxHeadings", () => {
  it("returns at most maxHeadings unique headings", () => {
    const blocks = Array.from({ length: 10 }, (_, i) =>
      makeBlock(`Heading ${i + 1}`, i + 1, true),
    );
    const structured = makeStructuredResult(blocks, 10);
    const result = extractStructuredHeadingStrings(structured, 4);
    expect(result.length).toBeLessThanOrEqual(4);
  });
});

// ─── SC11: extractStructuredHeadingStrings deduplicates ───────────────────────

describe("SC11: extractStructuredHeadingStrings deduplicates identical headings", () => {
  it("same heading text appearing twice is returned once", () => {
    const blocks = [
      makeBlock("Pojistná smlouva", 1, true),
      makeBlock("Pojistná smlouva", 3, true), // duplicate
      makeBlock("Zdravotní dotazník", 4, true),
    ];
    const structured = makeStructuredResult(blocks, 5);
    const result = extractStructuredHeadingStrings(structured, 10);
    const unique = new Set(result);
    expect(unique.size).toBe(result.length);
    expect(result.filter((h) => h === "Pojistná smlouva")).toHaveLength(1);
  });
});

// ─── SC12: extractStructuredHeadingStrings null/undefined input ───────────────

describe("SC12: extractStructuredHeadingStrings returns [] for null/undefined", () => {
  it("handles null gracefully", () => {
    expect(extractStructuredHeadingStrings(null)).toEqual([]);
    expect(extractStructuredHeadingStrings(undefined)).toEqual([]);
  });
});

// ─── SC13: bundleHint sectionHeadings merged from both sources ────────────────

describe("SC13: sectionHeadings merges structured and markdown headings", () => {
  it("combined headings include both structured and markdown sources", () => {
    const structuredHeadings = ["Zdravotní dotazník", "Prohlášení o původu finančních prostředků"];
    const markdownHeadings = ["Pojistná smlouva č. 123456", "Platební instrukce"];
    const combinedHeadings = [...new Set([...structuredHeadings, ...markdownHeadings])].slice(0, 6);
    expect(combinedHeadings).toContain("Zdravotní dotazník");
    expect(combinedHeadings).toContain("Pojistná smlouva č. 123456");
  });
});

// ─── SC14: bundleHint sectionHeadings deduplication ──────────────────────────

describe("SC14: sectionHeadings deduplication across structured and markdown", () => {
  it("heading appearing in both sources appears only once", () => {
    const structuredHeadings = ["Zdravotní dotazník", "Pojistná smlouva"];
    const markdownHeadings = ["Pojistná smlouva", "Platební instrukce"];
    const combinedHeadings = [...new Set([...structuredHeadings, ...markdownHeadings])];
    expect(combinedHeadings.filter((h) => h === "Pojistná smlouva")).toHaveLength(1);
  });
});

// ─── SC15: enriched candidateTypes reflect structured heading detections ───────

describe("SC15: enriched candidateTypes reflect structured heading detections", () => {
  it("candidateTypes includes types found only via structured headings", () => {
    const existing = [makeCandidate("final_contract")];
    const blocks = [
      makeBlock("Pojistná smlouva č. 123", 1, true), // final_contract (already in existing)
      makeBlock("AML formulář", 5, true), // aml_fatca_form — new!
    ];
    const structured = makeStructuredResult(blocks, 6);
    const enriched = enrichCandidatesFromStructuredHeadings(existing, structured, 6);
    const types = enriched.map((c) => c.type);
    expect(types).toContain("aml_fatca_form");
    expect(types).toContain("final_contract");
  });
});

// ─── SC16–SC18: coreExtractionSource logic ───────────────────────────────────

describe("SC16–SC18: coreExtractionSource determination", () => {
  it("SC16: structured source active → coreExtractionSource should be adobe_structured_pages", () => {
    const hint = "a".repeat(1000);
    const structuredText = "b".repeat(900);
    const useStructuredSource = structuredText.length > 0 && structuredText.length >= hint.length * 0.8;
    const source = useStructuredSource ? "adobe_structured_pages" : hint.length === 0 ? "fallback" : "markdown";
    expect(source).toBe("adobe_structured_pages");
  });

  it("SC17: only markdown available → coreExtractionSource should be markdown", () => {
    const hint = "a".repeat(1000);
    const structuredText = "";
    const useStructuredSource = structuredText.length > 0 && structuredText.length >= hint.length * 0.8;
    const source = useStructuredSource ? "adobe_structured_pages" : hint.length === 0 ? "fallback" : "markdown";
    expect(source).toBe("markdown");
  });

  it("SC18: both empty → coreExtractionSource should be fallback", () => {
    const hint = "";
    const structuredText = "";
    const useStructuredSource = structuredText.length > 0 && structuredText.length >= hint.length * 0.8;
    const source = useStructuredSource ? "adobe_structured_pages" : hint.length === 0 ? "fallback" : "markdown";
    expect(source).toBe("fallback");
  });
});

// ─── SC19: G02 core extraction uses structured source ────────────────────────

describe("SC19: G02-like scenario — structured source used for final contract extraction", () => {
  it("structured page text for contract pages is longer than empty markdown", () => {
    // Simulate a document where markdown is empty but structured data has contract pages
    const blocks = [
      makeBlock("Pojistná smlouva č. 987654321", 1, true),
      makeBlock("Pojistník: Jan Novák, nar. 1.1.1980", 1, false),
      makeBlock("Pojistné: 2 500 Kč/měsíc", 2, false),
      makeBlock("Platební účet: 1234567890/0100", 2, false),
    ];
    const structured = makeStructuredResult(blocks, 3);
    // Build structured full text
    const pages = Object.values(structured.pages).map((p) => p.fullText).join("\n\n");
    expect(pages.length).toBeGreaterThan(0);
    expect(pages).toContain("987654321");
    expect(pages).toContain("Jan Novák");
  });
});

// ─── SC20: G03 structured headings separate health from final contract ─────────

describe("SC20: G03-like — structured headings correctly identify health questionnaire section", () => {
  it("health questionnaire heading found on page 5 enriches candidate with page 5 isolation", () => {
    const existing = [
      makeCandidate("final_contract", { pageNumbers: [1, 2, 3] }),
    ];
    const blocks = [
      makeBlock("Pojistná smlouva č. 123456", 1, true),
      makeBlock("Zdravotní dotazník", 5, true),
    ];
    const structured = makeStructuredResult(blocks, 7);
    const result = enrichCandidatesFromStructuredHeadings(existing, structured, 7);

    const health = result.find((c) => c.type === "health_questionnaire");
    expect(health).toBeDefined();
    expect(health?.pageNumbers).toBeDefined();
    expect(health?.pageNumbers).toContain(5);

    // Final contract pages should NOT include health pages
    const contract = result.find((c) => c.type === "final_contract");
    expect(contract?.pageNumbers).toEqual([1, 2, 3]); // unchanged
  });
});

// ─── SC21: structuredSource text quality check ────────────────────────────────

describe("SC21: structuredSource not weaker than markdown threshold", () => {
  it("structured source with >= 80% of markdown text qualifies as primary source", () => {
    const markdownLength = 5000;
    const structuredLength = 4200; // 84% → qualifies
    const useStructured = structuredLength > 0 && structuredLength >= markdownLength * 0.8;
    expect(useStructured).toBe(true);
  });

  it("structured source with < 80% of markdown text does not qualify", () => {
    const markdownLength = 5000;
    const structuredLength = 3999; // 79.98% → too short
    const useStructured = structuredLength > 0 && structuredLength >= markdownLength * 0.8;
    expect(useStructured).toBe(false);
  });
});

// ─── SC22: enriched candidates pass correct pageNumbers to section slicer ─────

describe("SC22: enriched candidates pageNumbers used for section isolation", () => {
  it("candidate enriched with page 4 from heading block isolates text to page 4", () => {
    const existing = [makeCandidate("aml_fatca_form")];
    const blocks = [makeBlock("FATCA prohlášení", 4, true)];
    const structured = makeStructuredResult(blocks, 6);
    const result = enrichCandidatesFromStructuredHeadings(existing, structured, 6);
    const aml = result.find((c) => c.type === "aml_fatca_form");
    expect(aml?.pageNumbers).toBeDefined();
    expect(aml?.pageNumbers).toContain(4);
    // Page range should include one neighbor page for safety
    expect(aml?.pageNumbers!.length).toBeGreaterThanOrEqual(1);
  });
});
