import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const addBreadcrumbMock = vi.hoisted(() => vi.fn());
vi.mock("@sentry/nextjs", () => ({
  addBreadcrumb: addBreadcrumbMock,
}));

const unifiedMock = vi.hoisted(() => vi.fn());
vi.mock("../unified-multimodal-input", () => ({
  buildUnifiedExtractionCall: unifiedMock,
}));

import {
  detectDocumentBoundariesVision,
  isVisionBoundaryDetectEnabled,
} from "../detect-document-boundaries-vision";

describe("isVisionBoundaryDetectEnabled", () => {
  const original = process.env.AI_REVIEW_VISION_BOUNDARY_DETECT;
  afterEach(() => {
    if (original === undefined) delete process.env.AI_REVIEW_VISION_BOUNDARY_DETECT;
    else process.env.AI_REVIEW_VISION_BOUNDARY_DETECT = original;
  });

  it("is OFF by default", () => {
    delete process.env.AI_REVIEW_VISION_BOUNDARY_DETECT;
    expect(isVisionBoundaryDetectEnabled()).toBe(false);
  });
  it("is ON only when env is exactly 'true'", () => {
    process.env.AI_REVIEW_VISION_BOUNDARY_DETECT = "true";
    expect(isVisionBoundaryDetectEnabled()).toBe(true);
    process.env.AI_REVIEW_VISION_BOUNDARY_DETECT = "false";
    expect(isVisionBoundaryDetectEnabled()).toBe(false);
  });
});

describe("detectDocumentBoundariesVision — flag-off short-circuit", () => {
  const original = process.env.AI_REVIEW_VISION_BOUNDARY_DETECT;
  afterEach(() => {
    if (original === undefined) delete process.env.AI_REVIEW_VISION_BOUNDARY_DETECT;
    else process.env.AI_REVIEW_VISION_BOUNDARY_DETECT = original;
    unifiedMock.mockReset();
    addBreadcrumbMock.mockReset();
  });

  it("skips with flag_off when env is off (no provider call)", async () => {
    delete process.env.AI_REVIEW_VISION_BOUNDARY_DETECT;
    const res = await detectDocumentBoundariesVision({
      pageImageUrls: ["data:image/png;base64,AAA"],
      pageCount: 5,
    });
    expect(res.ran).toBe(false);
    expect(res.skippedReason).toBe("flag_off");
    expect(unifiedMock).not.toHaveBeenCalled();
  });
});

describe("detectDocumentBoundariesVision — flag-on paths", () => {
  beforeEach(() => {
    process.env.AI_REVIEW_VISION_BOUNDARY_DETECT = "true";
    unifiedMock.mockReset();
    addBreadcrumbMock.mockReset();
  });
  afterEach(() => {
    delete process.env.AI_REVIEW_VISION_BOUNDARY_DETECT;
  });

  it("skips page_count_below_threshold when pageCount < minPages", async () => {
    const res = await detectDocumentBoundariesVision({
      pageImageUrls: ["data:image/png;base64,AAA", "data:image/png;base64,BBB"],
      pageCount: 2,
    });
    expect(res.skippedReason).toBe("page_count_below_threshold");
    expect(unifiedMock).not.toHaveBeenCalled();
  });

  it("skips no_page_images when images array is empty", async () => {
    const res = await detectDocumentBoundariesVision({
      pageImageUrls: [],
      pageCount: 5,
    });
    expect(res.skippedReason).toBe("no_page_images");
    expect(unifiedMock).not.toHaveBeenCalled();
  });

  it("returns provider_error and breadcrumb when unified call errors", async () => {
    unifiedMock.mockResolvedValue({
      parsed: null,
      rawText: "",
      sourceKind: "multi_page_full_vision",
      evidenceTierForRecoveredFields: "recovered_from_full_vision",
      pagesUsed: 3,
      durationMs: 10,
      error: { code: "PROVIDER_FAIL", message: "boom" },
    });
    const res = await detectDocumentBoundariesVision({
      pageImageUrls: ["a", "b", "c"],
      pageCount: 3,
    });
    expect(res.skippedReason).toBe("provider_error");
    expect(res.errorCode).toBe("PROVIDER_FAIL");
    expect(addBreadcrumbMock).toHaveBeenCalled();
    const crumb = addBreadcrumbMock.mock.calls[0]?.[0] as { category: string; level: string };
    expect(crumb.category).toBe("ai_review.vision_boundary_detect");
    expect(crumb.level).toBe("warning");
  });

  it("clamps and returns boundaries on success, emits info breadcrumb", async () => {
    unifiedMock.mockResolvedValue({
      parsed: {
        boundaries: [
          { startPage: 1, endPage: 2, documentType: "contract", rationale: "title page", confidence: 0.9 },
          { startPage: 3, endPage: 99, documentType: "aml_fatca_form", confidence: 1.2 },
          { startPage: 5, endPage: 4, documentType: "noise" },
        ],
      },
      rawText: "{}",
      sourceKind: "multi_page_full_vision",
      evidenceTierForRecoveredFields: "recovered_from_full_vision",
      pagesUsed: 3,
      durationMs: 20,
    });
    const res = await detectDocumentBoundariesVision({
      pageImageUrls: ["a", "b", "c"],
      pageCount: 5,
    });
    expect(res.ran).toBe(true);
    expect(res.boundaries).toHaveLength(2); // "noise" dropped (endPage < startPage)
    expect(res.boundaries[0]?.documentType).toBe("contract");
    expect(res.boundaries[1]?.endPage).toBe(5); // clamped from 99
    expect(res.boundaries[1]?.confidence).toBeNull(); // 1.2 out of range
    expect(addBreadcrumbMock).toHaveBeenCalled();
    const crumb = addBreadcrumbMock.mock.calls[0]?.[0] as { category: string; level: string };
    expect(crumb.level).toBe("info");
  });

  it("returns empty_output when model returns zero boundaries", async () => {
    unifiedMock.mockResolvedValue({
      parsed: { boundaries: [] },
      rawText: "{}",
      sourceKind: "multi_page_full_vision",
      evidenceTierForRecoveredFields: "recovered_from_full_vision",
      pagesUsed: 3,
      durationMs: 5,
    });
    const res = await detectDocumentBoundariesVision({
      pageImageUrls: ["a", "b", "c"],
      pageCount: 4,
    });
    expect(res.ran).toBe(true);
    expect(res.skippedReason).toBe("empty_output");
  });

  it("caps pagesUsed to maxPages", async () => {
    unifiedMock.mockResolvedValue({
      parsed: { boundaries: [{ startPage: 1, endPage: 1, documentType: "contract" }] },
      rawText: "{}",
      sourceKind: "multi_page_full_vision",
      evidenceTierForRecoveredFields: "recovered_from_full_vision",
      pagesUsed: 2,
      durationMs: 1,
    });
    const res = await detectDocumentBoundariesVision({
      pageImageUrls: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"],
      pageCount: 10,
      maxPages: 2,
    });
    expect(res.pagesUsed).toBe(2);
    const callArgs = unifiedMock.mock.calls[0]?.[0] as { pageUrls?: string[] };
    expect(callArgs?.pageUrls).toHaveLength(2);
  });
});
