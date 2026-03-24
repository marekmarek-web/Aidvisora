import { describe, it, expect, vi } from "vitest";

vi.mock("db", () => ({
  db: { select: vi.fn().mockReturnThis(), from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]), orderBy: vi.fn().mockReturnThis(), insert: vi.fn().mockReturnThis(), values: vi.fn().mockReturnThis(), execute: vi.fn().mockResolvedValue({ rows: [] }) },
  eq: vi.fn(), and: vi.fn(), isNull: vi.fn(), sql: vi.fn(), asc: vi.fn(), desc: vi.fn(),
  tasks: {}, contacts: {}, contracts: {}, opportunities: {}, opportunityStages: {},
  contractUploadReviews: {}, clientPaymentSetups: {}, contractReviewCorrections: {},
}));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/openai", () => ({ createResponseSafe: vi.fn() }));

const { sanitizeContext, maskIban, maskPersonalId } = await import("../assistant-context-builder");

type Payload = Parameters<typeof sanitizeContext>[0];

function makePayload(overrides?: Partial<Payload>): Payload {
  return {
    summaryText: "Test summary",
    structuredFacts: [],
    warnings: [],
    suggestedQuestions: [],
    recommendedActions: [],
    sourceReferences: [],
    ...overrides,
  };
}

describe("maskIban", () => {
  it("masks an IBAN keeping last 4 digits", () => {
    expect(maskIban("CZ6508000000192000145399")).toBe("...5399");
  });
  it("handles null", () => {
    expect(maskIban(null)).toBe("");
  });
  it("handles short strings", () => {
    expect(maskIban("AB12")).toBe("***");
  });
});

describe("maskPersonalId", () => {
  it("masks a personal id keeping last 4", () => {
    expect(maskPersonalId("850101/1234")).toBe("XX/1234");
  });
  it("handles null", () => {
    expect(maskPersonalId(null)).toBe("");
  });
});

describe("sanitizeContext", () => {
  it("scrubs IBANs from summaryText", () => {
    const payload = makePayload({ summaryText: "IBAN je CZ6508000000192000145399 pro platbu." });
    const result = sanitizeContext(payload);
    expect(result.summaryText).not.toContain("192000145399");
    expect(result.summaryText).toContain("...5399");
  });

  it("scrubs personal IDs from summaryText", () => {
    const payload = makePayload({ summaryText: "Rodné číslo klienta je 850101/1234." });
    const result = sanitizeContext(payload);
    expect(result.summaryText).not.toContain("850101");
    expect(result.summaryText).toContain("XX/1234");
  });

  it("scrubs IBANs in structured facts", () => {
    const payload = makePayload({
      structuredFacts: [{ key: "iban", value: "CZ6508000000192000145399", category: "payment" }],
    });
    const result = sanitizeContext(payload);
    expect(result.structuredFacts[0].value).toBe("...5399");
  });

  it("preserves numeric facts untouched", () => {
    const payload = makePayload({
      structuredFacts: [{ key: "count", value: 42, category: "test" }],
    });
    const result = sanitizeContext(payload);
    expect(result.structuredFacts[0].value).toBe(42);
  });

  it("scrubs warnings", () => {
    const payload = makePayload({ warnings: ["IBAN CZ6508000000192000145399 je neplatný"] });
    const result = sanitizeContext(payload);
    expect(result.warnings[0]).not.toContain("192000145399");
  });

  it("preserves source references", () => {
    const payload = makePayload({
      sourceReferences: [
        { sourceType: "review" as const, sourceId: "abc", freshness: "live" as const, visibilityScope: "tenant" as const },
      ],
    });
    const result = sanitizeContext(payload);
    expect(result.sourceReferences).toHaveLength(1);
    expect(result.sourceReferences[0].sourceId).toBe("abc");
  });
});
