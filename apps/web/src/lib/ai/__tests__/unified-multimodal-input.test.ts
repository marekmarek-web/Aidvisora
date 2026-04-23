import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

const addBreadcrumbMock = vi.hoisted(() => vi.fn());
vi.mock("@sentry/nextjs", () => ({
  addBreadcrumb: addBreadcrumbMock,
}));

import {
  buildUnifiedExtractionCall,
  isUnifiedInputBuilderEnabled,
  type UnifiedExtractionDeps,
  type UnifiedExtractionInput,
} from "../unified-multimodal-input";

const ROUTING = { category: "ai_review" as const };
const SCHEMA: Record<string, unknown> = { type: "object" };

function makeDeps(overrides: Partial<UnifiedExtractionDeps> = {}): UnifiedExtractionDeps {
  return {
    createResponseWithFile: vi
      .fn()
      .mockResolvedValue('{"field":"from-pdf"}'),
    createResponseStructuredWithImage: vi
      .fn()
      .mockResolvedValue({ parsed: { field: "from-image" }, text: '{"field":"from-image"}', model: "m" }),
    createResponseStructuredWithImages: vi
      .fn()
      .mockResolvedValue({ parsed: { field: "from-multi" }, text: '{"field":"from-multi"}', model: "m" }),
    ...overrides,
  } as unknown as UnifiedExtractionDeps;
}

describe("buildUnifiedExtractionCall — routing", () => {
  it("hybrid_pdf_file routes to createResponseWithFile and attempts JSON parse when schema present", async () => {
    const deps = makeDeps();
    const input: UnifiedExtractionInput = {
      mode: "hybrid_pdf_file",
      prompt: "extract",
      routing: ROUTING,
      fileUrl: "https://example/file.pdf",
      schema: SCHEMA,
    };
    const res = await buildUnifiedExtractionCall<{ field: string }>(input, deps);
    expect((deps.createResponseWithFile as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(1);
    expect(deps.createResponseStructuredWithImage).not.toHaveBeenCalled();
    expect(deps.createResponseStructuredWithImages).not.toHaveBeenCalled();
    expect(res.sourceKind).toBe("pdf_input_file");
    expect(res.evidenceTierForRecoveredFields).toBeNull();
    expect(res.parsed).toEqual({ field: "from-pdf" });
    expect(res.pagesUsed).toBe(1);
  });

  it("hybrid_pdf_file without schema returns rawText only (parsed null)", async () => {
    const deps = makeDeps({
      createResponseWithFile: vi.fn().mockResolvedValue("plain text summary"),
    });
    const res = await buildUnifiedExtractionCall<unknown>(
      {
        mode: "hybrid_pdf_file",
        prompt: "summarize",
        routing: ROUTING,
        fileUrl: "https://example/file.pdf",
      },
      deps
    );
    expect(res.rawText).toBe("plain text summary");
    expect(res.parsed).toBeNull();
    expect(res.error).toBeUndefined();
  });

  it("single_page_rescue routes to createResponseStructuredWithImage and maps to recovered_from_image", async () => {
    const deps = makeDeps();
    const res = await buildUnifiedExtractionCall<{ field: string }>(
      {
        mode: "single_page_rescue",
        prompt: "find IBAN",
        routing: ROUTING,
        imageUrl: "data:image/png;base64,AAA",
        schema: SCHEMA,
        schemaName: "rescue_iban",
        pageNumber: 2,
      },
      deps
    );
    expect(deps.createResponseStructuredWithImage).toHaveBeenCalledTimes(1);
    expect(res.sourceKind).toBe("page_image_fallback");
    expect(res.evidenceTierForRecoveredFields).toBe("recovered_from_image");
    expect(res.parsed).toEqual({ field: "from-image" });
    expect(res.pagesUsed).toBe(1);
  });

  it("multi_page_vision routes to createResponseStructuredWithImages and maps to recovered_from_full_vision", async () => {
    const deps = makeDeps();
    const res = await buildUnifiedExtractionCall<{ field: string }>(
      {
        mode: "multi_page_vision",
        prompt: "extract all",
        routing: ROUTING,
        pageUrls: ["data:...1", "data:...2", "data:...3"],
        schema: SCHEMA,
        schemaName: "full_vision",
        maxImages: 6,
      },
      deps
    );
    expect(deps.createResponseStructuredWithImages).toHaveBeenCalledTimes(1);
    expect(res.sourceKind).toBe("full_document_vision");
    expect(res.evidenceTierForRecoveredFields).toBe("recovered_from_full_vision");
    expect(res.pagesUsed).toBe(3);
    expect(res.parsed).toEqual({ field: "from-multi" });
  });
});

describe("buildUnifiedExtractionCall — validation errors (never throw)", () => {
  it("hybrid_pdf_file without fileUrl returns MISSING_FILE_URL and calls nothing", async () => {
    const deps = makeDeps();
    const res = await buildUnifiedExtractionCall<unknown>(
      { mode: "hybrid_pdf_file", prompt: "x", routing: ROUTING },
      deps
    );
    expect(res.parsed).toBeNull();
    expect(res.error?.code).toBe("MISSING_FILE_URL");
    expect(deps.createResponseWithFile).not.toHaveBeenCalled();
  });

  it("single_page_rescue without imageUrl OR schema returns MISSING_INPUTS", async () => {
    const deps = makeDeps();
    const res = await buildUnifiedExtractionCall<unknown>(
      { mode: "single_page_rescue", prompt: "x", routing: ROUTING, schema: SCHEMA },
      deps
    );
    expect(res.error?.code).toBe("MISSING_INPUTS");
    expect(res.evidenceTierForRecoveredFields).toBe("recovered_from_image");
    expect(deps.createResponseStructuredWithImage).not.toHaveBeenCalled();
  });

  it("multi_page_vision with empty pageUrls returns MISSING_INPUTS", async () => {
    const deps = makeDeps();
    const res = await buildUnifiedExtractionCall<unknown>(
      {
        mode: "multi_page_vision",
        prompt: "x",
        routing: ROUTING,
        pageUrls: [],
        schema: SCHEMA,
      },
      deps
    );
    expect(res.error?.code).toBe("MISSING_INPUTS");
    expect(res.evidenceTierForRecoveredFields).toBe("recovered_from_full_vision");
    expect(deps.createResponseStructuredWithImages).not.toHaveBeenCalled();
  });
});

describe("buildUnifiedExtractionCall — provider errors are caught", () => {
  it("provider throw on single_page_rescue returns error envelope, not rejection", async () => {
    const deps = makeDeps({
      createResponseStructuredWithImage: vi.fn().mockRejectedValue(
        Object.assign(new Error("rate limit"), { code: "RATE_LIMIT" })
      ),
    });
    const res = await buildUnifiedExtractionCall<unknown>(
      {
        mode: "single_page_rescue",
        prompt: "x",
        routing: ROUTING,
        imageUrl: "data:img",
        schema: SCHEMA,
      },
      deps
    );
    expect(res.parsed).toBeNull();
    expect(res.error).toEqual({ code: "RATE_LIMIT", message: "rate limit" });
    expect(res.sourceKind).toBe("page_image_fallback");
  });

  it("provider throw on multi_page_vision with generic Error (no code) falls back to PROVIDER_ERROR", async () => {
    const deps = makeDeps({
      createResponseStructuredWithImages: vi.fn().mockRejectedValue(new Error("timeout")),
    });
    const res = await buildUnifiedExtractionCall<unknown>(
      {
        mode: "multi_page_vision",
        prompt: "x",
        routing: ROUTING,
        pageUrls: ["u1"],
        schema: SCHEMA,
      },
      deps
    );
    expect(res.error?.code).toBe("PROVIDER_ERROR");
    expect(res.error?.message).toBe("timeout");
  });
});

describe("buildUnifiedExtractionCall — Sentry breadcrumb (flag-gated)", () => {
  const originalEnv = process.env.AI_REVIEW_UNIFIED_INPUT_BUILDER;

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.AI_REVIEW_UNIFIED_INPUT_BUILDER;
    else process.env.AI_REVIEW_UNIFIED_INPUT_BUILDER = originalEnv;
  });

  it("does NOT emit ai_review.unified_extraction when flag is off", async () => {
    delete process.env.AI_REVIEW_UNIFIED_INPUT_BUILDER;
    addBreadcrumbMock.mockClear();
    await buildUnifiedExtractionCall<unknown>(
      {
        mode: "single_page_rescue",
        prompt: "x",
        routing: ROUTING,
        imageUrl: "data:img",
        schema: SCHEMA,
      },
      makeDeps()
    );
    expect(addBreadcrumbMock).not.toHaveBeenCalled();
  });

  it("emits ai_review.unified_extraction when flag is on", async () => {
    process.env.AI_REVIEW_UNIFIED_INPUT_BUILDER = "true";
    addBreadcrumbMock.mockClear();
    await buildUnifiedExtractionCall<unknown>(
      {
        mode: "single_page_rescue",
        prompt: "x",
        routing: ROUTING,
        imageUrl: "data:img",
        schema: SCHEMA,
        documentTypeHint: "commission_contract",
      },
      makeDeps()
    );
    expect(addBreadcrumbMock).toHaveBeenCalledTimes(1);
    const crumb = addBreadcrumbMock.mock.calls[0]?.[0] as {
      category: string;
      level: string;
      data: Record<string, unknown>;
    };
    expect(crumb.category).toBe("ai_review.unified_extraction");
    expect(crumb.level).toBe("info");
    expect(crumb.data.mode).toBe("single_page_rescue");
    expect(crumb.data.documentTypeHint).toBe("commission_contract");
  });
});

describe("isUnifiedInputBuilderEnabled", () => {
  it("returns false by default", () => {
    const prev = process.env.AI_REVIEW_UNIFIED_INPUT_BUILDER;
    delete process.env.AI_REVIEW_UNIFIED_INPUT_BUILDER;
    try {
      expect(isUnifiedInputBuilderEnabled()).toBe(false);
    } finally {
      if (prev !== undefined) process.env.AI_REVIEW_UNIFIED_INPUT_BUILDER = prev;
    }
  });

  it("returns true only for the literal string 'true'", () => {
    const prev = process.env.AI_REVIEW_UNIFIED_INPUT_BUILDER;
    try {
      process.env.AI_REVIEW_UNIFIED_INPUT_BUILDER = "true";
      expect(isUnifiedInputBuilderEnabled()).toBe(true);
      process.env.AI_REVIEW_UNIFIED_INPUT_BUILDER = "1";
      expect(isUnifiedInputBuilderEnabled()).toBe(false);
      process.env.AI_REVIEW_UNIFIED_INPUT_BUILDER = "yes";
      expect(isUnifiedInputBuilderEnabled()).toBe(false);
    } finally {
      if (prev === undefined) delete process.env.AI_REVIEW_UNIFIED_INPUT_BUILDER;
      else process.env.AI_REVIEW_UNIFIED_INPUT_BUILDER = prev;
    }
  });
});
