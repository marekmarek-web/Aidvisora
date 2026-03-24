import { describe, it, expect, vi } from "vitest";

vi.mock("db", () => ({
  db: { select: vi.fn().mockReturnThis(), from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]), orderBy: vi.fn().mockReturnThis(), execute: vi.fn().mockResolvedValue({ rows: [] }) },
  eq: vi.fn(), and: vi.fn(), isNull: vi.fn(), sql: vi.fn(), asc: vi.fn(), desc: vi.fn(),
  tasks: {}, contacts: {}, contracts: {}, opportunities: {}, opportunityStages: {},
  contractUploadReviews: {}, clientPaymentSetups: {}, contractReviewCorrections: {},
}));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/openai", () => ({ createResponseSafe: vi.fn() }));
vi.mock("@/lib/client-ai-context", () => ({
  getClientAiContext: vi.fn().mockResolvedValue(null),
}));

const { ASSISTANT_TOOLS, getToolByName, getToolDescriptions } = await import(
  "../assistant-tools"
);

describe("ASSISTANT_TOOLS", () => {
  it("defines at least 9 tools", () => {
    expect(ASSISTANT_TOOLS.length).toBeGreaterThanOrEqual(9);
  });

  it("each tool has required fields", () => {
    for (const tool of ASSISTANT_TOOLS) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(typeof tool.handler).toBe("function");
    }
  });

  it("draft tools require permission", () => {
    const taskTool = getToolByName("createTaskDraft");
    expect(taskTool?.requiredPermission).toBe("assistant:create_draft");
    const emailTool = getToolByName("createEmailDraft");
    expect(emailTool?.requiredPermission).toBe("assistant:create_draft");
  });
});

describe("getToolByName", () => {
  it("returns tool for valid name", () => {
    expect(getToolByName("getDashboardSummary")).toBeDefined();
  });
  it("returns undefined for unknown name", () => {
    expect(getToolByName("nonexistent")).toBeUndefined();
  });
});

describe("getToolDescriptions", () => {
  it("returns array with name and description", () => {
    const descs = getToolDescriptions();
    expect(descs.length).toBeGreaterThan(0);
    expect(descs[0].name).toBeTruthy();
    expect(descs[0].description).toBeTruthy();
  });
});

describe("tool handlers", () => {
  const ctx = { tenantId: "t1", userId: "u1", roleName: "Advisor" };

  it("getDashboardSummary returns data", async () => {
    const tool = getToolByName("getDashboardSummary")!;
    const result = await tool.handler({}, ctx);
    expect(result.data).toBeDefined();
    expect(result.sourceReferences).toBeDefined();
  });

  it("getClientSummary requires contactId", async () => {
    const tool = getToolByName("getClientSummary")!;
    const result = await tool.handler({}, ctx);
    expect(result.data.error).toBe("contactId required");
  });

  it("createTaskDraft returns draft", async () => {
    const tool = getToolByName("createTaskDraft")!;
    const result = await tool.handler({ title: "Test task" }, ctx);
    expect(result.data.draft).toBeDefined();
  });
});
