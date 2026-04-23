import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

const addBreadcrumbMock = vi.hoisted(() => vi.fn());
vi.mock("@sentry/nextjs", () => ({
  addBreadcrumb: addBreadcrumbMock,
}));

const unifiedMock = vi.hoisted(() => vi.fn());
vi.mock("../unified-multimodal-input", () => ({
  buildUnifiedExtractionCall: unifiedMock,
}));

vi.mock("../pdf-page-rasterize", () => ({
  rasterizePdfPageToDataUrl: vi.fn(),
}));

import {
  isVisionPrimaryForScanEnabled,
  runVisionPrimaryExtraction,
} from "../vision-primary-extraction";

describe("isVisionPrimaryForScanEnabled", () => {
  const orig = process.env.AI_REVIEW_VISION_PRIMARY_FOR_SCAN;
  afterEach(() => {
    if (orig === undefined) delete process.env.AI_REVIEW_VISION_PRIMARY_FOR_SCAN;
    else process.env.AI_REVIEW_VISION_PRIMARY_FOR_SCAN = orig;
  });

  it("is OFF by default", () => {
    delete process.env.AI_REVIEW_VISION_PRIMARY_FOR_SCAN;
    expect(isVisionPrimaryForScanEnabled()).toBe(false);
  });
  it("is ON only when env is exactly 'true'", () => {
    process.env.AI_REVIEW_VISION_PRIMARY_FOR_SCAN = "true";
    expect(isVisionPrimaryForScanEnabled()).toBe(true);
  });
});

describe("runVisionPrimaryExtraction", () => {
  const orig = process.env.AI_REVIEW_VISION_PRIMARY_FOR_SCAN;

  beforeEach(() => {
    unifiedMock.mockReset();
    addBreadcrumbMock.mockReset();
  });
  afterEach(() => {
    if (orig === undefined) delete process.env.AI_REVIEW_VISION_PRIMARY_FOR_SCAN;
    else process.env.AI_REVIEW_VISION_PRIMARY_FOR_SCAN = orig;
  });

  it("flag OFF → short-circuits to skippedReason='flag_off' (no rasterize, no provider call)", async () => {
    delete process.env.AI_REVIEW_VISION_PRIMARY_FOR_SCAN;
    const ras = vi.fn();
    const res = await runVisionPrimaryExtraction(
      { fileUrl: "https://x/y.pdf", pageCount: 3 },
      ras as never,
    );
    expect(res.skippedReason).toBe("flag_off");
    expect(ras).not.toHaveBeenCalled();
    expect(unifiedMock).not.toHaveBeenCalled();
  });

  it("flag ON + pageCount=0 → page_count_zero", async () => {
    process.env.AI_REVIEW_VISION_PRIMARY_FOR_SCAN = "true";
    const res = await runVisionPrimaryExtraction({ fileUrl: "x", pageCount: 0 });
    expect(res.skippedReason).toBe("page_count_zero");
  });

  it("flag ON → rasterizes up to maxPages and routes through unified builder (info breadcrumb)", async () => {
    process.env.AI_REVIEW_VISION_PRIMARY_FOR_SCAN = "true";
    unifiedMock.mockResolvedValue({
      parsed: { fields: { iban: { value: "CZ", confidence: 0.9 } } },
      rawText: "{}",
      sourceKind: "multi_page_full_vision",
      evidenceTierForRecoveredFields: "recovered_from_full_vision",
      pagesUsed: 2,
      durationMs: 10,
    });
    const ras = vi.fn(async (_url: string, _p: number) => ({
      dataUrl: "data:image/png;base64,AAA",
      widthPx: 100,
      heightPx: 100,
    }));
    const res = await runVisionPrimaryExtraction(
      { fileUrl: "u", pageCount: 10, maxPages: 2 },
      ras as never,
    );
    expect(ras).toHaveBeenCalledTimes(2);
    expect(res.ran).toBe(true);
    expect(res.fields.iban?.value).toBe("CZ");
    expect(res.pagesUsed).toBe(2);
    expect(addBreadcrumbMock).toHaveBeenCalled();
    const crumb = addBreadcrumbMock.mock.calls[0]?.[0] as { category: string; level: string };
    expect(crumb.category).toBe("ai_review.vision_primary");
    expect(crumb.level).toBe("info");
  });

  it("flag ON + provider error → skippedReason='provider_error' + warning breadcrumb", async () => {
    process.env.AI_REVIEW_VISION_PRIMARY_FOR_SCAN = "true";
    unifiedMock.mockResolvedValue({
      parsed: null,
      rawText: "",
      sourceKind: "multi_page_full_vision",
      evidenceTierForRecoveredFields: "recovered_from_full_vision",
      pagesUsed: 1,
      durationMs: 5,
      error: { code: "OPENAI_TIMEOUT", message: "t" },
    });
    const ras = vi.fn(async () => ({ dataUrl: "data:image/png;base64,AAA", widthPx: 1, heightPx: 1 }));
    const res = await runVisionPrimaryExtraction(
      { fileUrl: "u", pageCount: 1 },
      ras as never,
    );
    expect(res.skippedReason).toBe("provider_error");
    expect(res.errorCode).toBe("OPENAI_TIMEOUT");
    const crumb = addBreadcrumbMock.mock.calls[0]?.[0] as { category: string; level: string };
    expect(crumb.level).toBe("warning");
  });

  it("flag ON + rasterize throws → skippedReason='rasterize_failed' (no provider call)", async () => {
    process.env.AI_REVIEW_VISION_PRIMARY_FOR_SCAN = "true";
    const ras = vi.fn(async () => {
      throw new Error("pdf broken");
    });
    const res = await runVisionPrimaryExtraction(
      { fileUrl: "u", pageCount: 2 },
      ras as never,
    );
    expect(res.skippedReason).toBe("rasterize_failed");
    expect(res.errorCode).toContain("pdf broken");
    expect(unifiedMock).not.toHaveBeenCalled();
  });
});
