/**
 * Phase 5 — AI Assistant final freeze / release gate.
 *
 * Run: pnpm --filter web test:assistant-phase5-freeze-gate
 *
 * Covers: canonical POST route, preview parity, safety (draft/needs_input/blocked),
 * implicit bundles, rating sources, multi-step mortgage confirm/cancel, wording snapshots.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExecutionPlan } from "../assistant-domain-model";

const CONTACT_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const CONTACT_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

const freezeHoisted = vi.hoisted(() => ({
  executePlanMock: vi.fn(),
  loadConversationHydration: vi.fn().mockResolvedValue(null),
  loadResumableExecutionPlanSnapshot: vi.fn().mockResolvedValue(null),
  upsertConversationFromSession: vi.fn().mockResolvedValue(undefined),
  appendConversationMessage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
    },
  }),
}));

vi.mock("@/lib/auth/get-membership", () => ({
  getMembership: vi.fn().mockResolvedValue({
    tenantId: "tenant-1",
    roleName: "Advisor",
  }),
}));

vi.mock("@/lib/security/rate-limit", () => ({
  checkRateLimit: vi.fn(() => ({ ok: true })),
}));

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
  logAuditAction: vi.fn(),
}));

vi.mock("@/lib/observability/assistant-sentry", () => ({
  captureAssistantApiError: vi.fn(),
}));

vi.mock("@/lib/ai/assistant-conversation-repository", () => ({
  loadConversationHydration: freezeHoisted.loadConversationHydration,
  loadResumableExecutionPlanSnapshot: freezeHoisted.loadResumableExecutionPlanSnapshot,
  upsertConversationFromSession: freezeHoisted.upsertConversationFromSession,
  appendConversationMessage: freezeHoisted.appendConversationMessage,
}));

vi.mock("@/lib/openai", () => ({
  createResponseStructured: vi.fn().mockResolvedValue({ parsed: {} }),
  createResponseSafe: vi.fn().mockResolvedValue({ ok: true, text: "ok" }),
  logOpenAICall: vi.fn(),
}));

vi.mock("db", () => ({
  db: {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    leftJoin: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    values: vi.fn(),
    update: vi.fn(),
    set: vi.fn(),
  },
  eq: vi.fn(),
  and: vi.fn(),
  or: vi.fn(),
  isNull: vi.fn(),
  isNotNull: vi.fn(),
  gte: vi.fn(),
  sql: vi.fn(),
  asc: vi.fn(),
  desc: vi.fn(),
  assistantConversations: {},
  assistantMessages: {},
  contacts: {},
  tasks: {},
  contracts: {},
  opportunities: {},
  documents: {},
  opportunityStages: {},
  contractUploadReviews: {},
  clientPaymentSetups: {},
  contractReviewCorrections: {},
}));

vi.mock("../assistant-execution-engine", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../assistant-execution-engine")>();
  return {
    ...mod,
    executePlan: (...args: Parameters<typeof mod.executePlan>) => freezeHoisted.executePlanMock(...args),
  };
});

import { POST } from "../../../app/api/ai/assistant/chat/route";
import { clearSession } from "../assistant-session";
import * as entityResolution from "../assistant-entity-resolution";

type EntityResolutionResult = Awaited<ReturnType<typeof entityResolution.resolveEntities>>;

function resolutionBase(overrides: Partial<EntityResolutionResult>): EntityResolutionResult {
  return {
    client: null,
    opportunity: null,
    document: null,
    contract: null,
    warnings: [],
    ...overrides,
  };
}

function resolvedClient(id: string, label: string, ambiguous = false): NonNullable<EntityResolutionResult["client"]> {
  return {
    entityType: "contact",
    entityId: id,
    displayLabel: label,
    confidence: ambiguous ? 0.6 : 1,
    ambiguous,
    alternatives: ambiguous ? [{ id: CONTACT_B, label: "Petr Novák" }] : [],
  };
}

async function postChat(body: Record<string, unknown>) {
  const request = new Request("http://localhost/api/ai/assistant/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": "user-1",
    },
    body: JSON.stringify(body),
  });
  const response = await POST(request);
  const json = await response.json();
  return { response, json };
}

/** Strip volatile IDs from advisor-facing strings for snapshot stability. */
function scrubVolatile(text: string): string {
  return text
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "<uuid>")
    .replace(/\bplan_[a-f0-9]{8}\b/gi, "<plan>")
    .replace(/\bstep_[a-f0-9]{8}\b/gi, "<step>");
}

function stableGatePayload(json: {
  message?: string;
  executionState?: {
    stepPreviews?: Record<string, unknown>[];
    status?: string;
    clientLabel?: string | null;
  } | null;
  sourcesSummary?: string[];
  confidence?: number;
}) {
  const previews = (json.executionState?.stepPreviews ?? []).map((p) => ({
    label: p.label,
    description:
      typeof p.description === "string" ? scrubVolatile(p.description) : p.description ?? null,
    preflightStatus: p.preflightStatus,
    contextHint: p.contextHint ?? null,
    domainGroup: p.domainGroup ?? null,
    validationWarnings: Array.isArray(p.validationWarnings) ? p.validationWarnings : [],
    blockedReason: p.blockedReason ?? null,
  }));
  return {
    status: json.executionState?.status ?? null,
    clientLabel: json.executionState?.clientLabel ?? null,
    confidence: json.confidence ?? null,
    message: scrubVolatile(json.message ?? ""),
    stepPreviews: previews,
    sourcesSummary: json.sourcesSummary ?? [],
  };
}

function mockExecuteSuccess() {
  freezeHoisted.executePlanMock.mockImplementation(async (plan: ExecutionPlan) => ({
    ...plan,
    status: "completed" as const,
    steps: plan.steps.map((s) => ({
      ...s,
      status: "succeeded" as const,
      result: {
        ok: true,
        outcome: "executed" as const,
        entityId: "mock-entity",
        entityType: "task",
        warnings: [],
        error: null,
      },
    })),
  }));
}

describe("Phase 5: AI assistant freeze gate (release blocker suite)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    freezeHoisted.loadConversationHydration.mockResolvedValue(null);
    freezeHoisted.loadResumableExecutionPlanSnapshot.mockResolvedValue(null);
    mockExecuteSuccess();
  });

  afterEach(() => {
    freezeHoisted.executePlanMock.mockReset();
  });

  it("RB1 mortgage + trade + note + client_request — endpoint, canonical labels, preview snapshot", async () => {
    vi.spyOn(entityResolution, "resolveEntities").mockResolvedValueOnce(
      resolutionBase({ client: resolvedClient(CONTACT_A, "Test Novák") }),
    );

    const { response, json } = await postChat({
      orchestration: "canonical",
      message:
        "Klient Test Novák chce hypotéku 4 000 000 Kč, vytvoř obchod, interní poznámku a požadavek na občanku.",
      activeContext: { clientId: CONTACT_A },
    });

    expect(response.status).toBe(200);
    expect(json.executionState?.status).toBe("awaiting_confirmation");
    expect(json.executionState?.stepPreviews).toHaveLength(3);
    expect(json.executionState?.stepPreviews.map((s: { label: string }) => s.label)).toEqual(
      expect.arrayContaining([
        "Vytvořit obchod",
        "Vytvořit interní poznámku",
        "Vytvořit požadavek klienta",
      ]),
    );
    expect(stableGatePayload(json)).toMatchSnapshot();
  });

  it("RB1b confirmExecution applies same step count as preview (parity with canonical plan)", async () => {
    vi.spyOn(entityResolution, "resolveEntities").mockResolvedValueOnce(
      resolutionBase({ client: resolvedClient(CONTACT_A, "Test Novák") }),
    );

    const { json: first } = await postChat({
      orchestration: "canonical",
      message:
        "Klient Test Novák chce hypotéku 4 000 000 Kč, vytvoř obchod, interní poznámku a požadavek na občanku.",
      activeContext: { clientId: CONTACT_A },
    });
    const sessionId = first.sessionId as string;
    const previewCount = first.executionState?.stepPreviews?.length ?? 0;
    expect(previewCount).toBe(3);

    const { response: r2, json: second } = await postChat({
      orchestration: "canonical",
      sessionId,
      confirmExecution: true,
      message: "",
    });

    expect(r2.status).toBe(200);
    expect(freezeHoisted.executePlanMock).toHaveBeenCalledTimes(1);
    const executedPlan = freezeHoisted.executePlanMock.mock.calls[0]![0] as ExecutionPlan;
    expect(executedPlan.steps.filter((s) => s.status === "confirmed").length).toBe(previewCount);
    expect(second.executionState?.status).toBe("completed");
    expect(second.message).toMatch(/proveden|úspěšn/i);
    clearSession(sessionId);
  });

  it("RB2 implicit investment bundle — endpoint OK, snapshot, no overconfident wording", async () => {
    vi.spyOn(entityResolution, "resolveEntities").mockResolvedValueOnce(
      resolutionBase({ client: resolvedClient(CONTACT_A, "Marek Marek") }),
    );

    const { response, json } = await postChat({
      orchestration: "canonical",
      message: "Marek Marek chce investice 10 000 měsíčně do fondu ATRIS.",
      activeContext: { clientId: CONTACT_A },
    });

    expect(response.status).toBe(200);
    expect(json.executionState?.status).toBe("awaiting_confirmation");
    expect(json.executionState?.stepPreviews.map((s: { label: string }) => s.label)).toEqual(
      expect.arrayContaining(["Vytvořit obchod", "Vytvořit úkol", "Vytvořit požadavek klienta"]),
    );
    expect(json.message).not.toMatch(/hypoték/i);
    expect(json.confidence).toBeLessThanOrEqual(0.95);
    expect(stableGatePayload(json)).toMatchSnapshot();
  });

  it("RB3 meeting without time — needs_input, confirmExecution returns 400", async () => {
    vi.spyOn(entityResolution, "resolveEntities").mockResolvedValueOnce(
      resolutionBase({ client: resolvedClient(CONTACT_A, "Test Novák") }),
    );

    const { json: first } = await postChat({
      orchestration: "canonical",
      message: "Naplánuj schůzku s klientem příští úterý.",
      activeContext: { clientId: CONTACT_A },
    });
    expect(first.executionState?.status).toBe("draft");
    expect(first.executionState?.stepPreviews?.[0]?.preflightStatus).toBe("needs_input");

    const sessionId = first.sessionId as string;
    const { response, json } = await postChat({
      orchestration: "canonical",
      sessionId,
      confirmExecution: true,
      message: "",
    });
    expect(response.status).toBe(400);
    expect(json.error).toMatch(/Není aktivní plán čekající na potvrzení/i);
    clearSession(sessionId);
  });

  it("RB3b draft plan — cancelExecution also returns 400 (no awaiting_confirmation)", async () => {
    vi.spyOn(entityResolution, "resolveEntities").mockResolvedValueOnce(
      resolutionBase({ client: resolvedClient(CONTACT_A, "Test Novák") }),
    );

    const { json: first } = await postChat({
      orchestration: "canonical",
      message: "Naplánuj schůzku s klientem příští úterý.",
      activeContext: { clientId: CONTACT_A },
    });
    const sessionId = first.sessionId as string;
    const { response, json } = await postChat({
      orchestration: "canonical",
      sessionId,
      cancelExecution: true,
      message: "",
    });
    expect(response.status).toBe(400);
    expect(json.error).toMatch(/Není aktivní plán/i);
    clearSession(sessionId);
  });

  it("RB4 Klient chce dipko — DIP domain + implicit bundle, clean preview snapshot", async () => {
    vi.spyOn(entityResolution, "resolveEntities").mockResolvedValueOnce(
      resolutionBase({ client: resolvedClient(CONTACT_A, "Test Novák") }),
    );

    const { response, json } = await postChat({
      orchestration: "canonical",
      message: "Klient chce dipko.",
      activeContext: { clientId: CONTACT_A },
    });

    expect(response.status).toBe(200);
    const chips = (json.executionState?.stepPreviews ?? [])
      .map((s: { domainGroup?: string | null }) => s.domainGroup ?? "")
      .join(" ");
    expect(chips).toMatch(/\bDIP\b/i);
    expect(json.message).toMatch(/DIP|penzijní/i);
    expect(json.message).not.toMatch(/contactId|planId|sessionId|tenantId|\{"/i);
    expect(stableGatePayload(json)).toMatchSnapshot();
  });

  it("RB5 penzijko — DPS / retirement, not DIP-only playbook", async () => {
    vi.spyOn(entityResolution, "resolveEntities").mockResolvedValueOnce(
      resolutionBase({ client: resolvedClient(CONTACT_A, "Test Novák") }),
    );

    const { response, json } = await postChat({
      orchestration: "canonical",
      message: "Klient chce penzijko.",
      activeContext: { clientId: CONTACT_A },
    });

    expect(response.status).toBe(200);
    const blob = JSON.stringify(json.executionState?.stepPreviews ?? []);
    expect(blob).toMatch(/DPS|penzijn|důchod|třetí pilíř/i);
    expect(blob).not.toMatch(/\bDIP\b.*\bDIP\b/s);
    expect(stableGatePayload(json)).toMatchSnapshot();
  });

  it("RB6 POV + HAV combo — stable preview snapshot", async () => {
    vi.spyOn(entityResolution, "resolveEntities").mockResolvedValueOnce(
      resolutionBase({ client: resolvedClient(CONTACT_A, "Test Novák") }),
    );

    const { response, json } = await postChat({
      orchestration: "canonical",
      message: "Klient chce povko a havko.",
      activeContext: { clientId: CONTACT_A },
    });

    expect(response.status).toBe(200);
    expect(json.executionState?.status).toBe("awaiting_confirmation");
    expect(stableGatePayload(json)).toMatchSnapshot();
  });

  it("RB7 ambiguous client — blocked surface, confirmExecution 400", async () => {
    vi.spyOn(entityResolution, "resolveEntities").mockResolvedValueOnce(
      resolutionBase({
        client: resolvedClient(CONTACT_A, "Jan Novák", true),
        warnings: ["Nalezeno více klientů pro „Novák“."],
      }),
    );

    const { json: first } = await postChat({
      orchestration: "canonical",
      message: "Založ obchod pro Nováka.",
    });
    expect(first.executionState ?? null).toBeNull();

    const sessionId = first.sessionId as string;
    const { response, json } = await postChat({
      orchestration: "canonical",
      sessionId,
      confirmExecution: true,
      message: "",
    });
    expect(response.status).toBe(400);
    expect(json.error).toMatch(/Není aktivní plán/i);
    clearSession(sessionId);
  });

  it("RB8 life insurance rating — EUCS sourcesSummary snapshot", async () => {
    const { response, json } = await postChat({
      orchestration: "canonical",
      message: "Jaké životní pojištění má nejlepší rating?",
    });

    expect(response.status).toBe(200);
    expect(json.sourcesSummary).toEqual(["EUCS rating (interní podklad)"]);
    expect(stableGatePayload(json)).toMatchSnapshot();
  });

  it("RB9 cancelExecution clears pending plan and blocks second cancel", async () => {
    vi.spyOn(entityResolution, "resolveEntities").mockResolvedValueOnce(
      resolutionBase({ client: resolvedClient(CONTACT_A, "Test Novák") }),
    );

    const { json: first } = await postChat({
      orchestration: "canonical",
      message: "Klient Test Novák chce hypotéku 2 000 000 Kč a vytvoř obchod.",
      activeContext: { clientId: CONTACT_A },
    });
    const sessionId = first.sessionId as string;
    expect(first.executionState?.status).toBe("awaiting_confirmation");

    const { response: r2, json: second } = await postChat({
      orchestration: "canonical",
      sessionId,
      cancelExecution: true,
      message: "",
    });
    expect(r2.status).toBe(200);
    expect(second.message).toMatch(/Plán zrušen/i);

    const { response: r3, json: third } = await postChat({
      orchestration: "canonical",
      sessionId,
      cancelExecution: true,
      message: "",
    });
    expect(r3.status).toBe(400);
    expect(third.error).toMatch(/Není aktivní plán/i);
    clearSession(sessionId);
  });

  it("RB10 portal message — portal step preview snapshot (needs_input until text supplied)", async () => {
    vi.spyOn(entityResolution, "resolveEntities").mockResolvedValueOnce(
      resolutionBase({ client: resolvedClient(CONTACT_A, "Test Novák") }),
    );

    const { response, json } = await postChat({
      orchestration: "canonical",
      message:
        "Pošli portálovou zprávu klientovi Test Novák: prosím nahrajte občanku z obou stran.",
      activeContext: { clientId: CONTACT_A },
    });

    expect(response.status).toBe(200);
    const portalPreview = json.executionState?.stepPreviews?.find((s: { label?: string }) =>
      /portálovou zprávu/i.test(s.label ?? ""),
    );
    expect(portalPreview?.label).toMatch(/portálovou zprávu/i);
    expect(portalPreview?.preflightStatus).toBe("needs_input");
    expect(json.executionState?.status).toBe("draft");
    expect(stableGatePayload(json)).toMatchSnapshot();
  });

  it("RB11 create_contract preview — životní smlouva", async () => {
    vi.spyOn(entityResolution, "resolveEntities").mockResolvedValueOnce(
      resolutionBase({ client: resolvedClient(CONTACT_A, "Test Novák") }),
    );

    const { response, json } = await postChat({
      orchestration: "canonical",
      message: "Založ smlouvu životní pojištění u NN pro klienta Test Novák.",
      activeContext: { clientId: CONTACT_A },
    });

    expect(response.status).toBe(200);
    const actions = (json.executionState?.stepPreviews ?? []).map((s: { label: string }) => s.label).join("|");
    expect(actions).toMatch(/smlouv|Založit smlouvu/i);
    expect(stableGatePayload(json)).toMatchSnapshot();
  });

  it("RB12 update_coverage preview — OŽP hotové", async () => {
    vi.spyOn(entityResolution, "resolveEntities").mockResolvedValueOnce(
      resolutionBase({ client: resolvedClient(CONTACT_A, "Test Novák") }),
    );

    const { response, json } = await postChat({
      orchestration: "canonical",
      message: "Klient Test Novák, nastav OŽP jako hotové pokrytí.",
      activeContext: { clientId: CONTACT_A },
    });

    expect(response.status).toBe(200);
    const blob = JSON.stringify(json.executionState?.stepPreviews ?? []);
    expect(blob).toMatch(/pokryt|OŽP|život/i);
    expect(stableGatePayload(json)).toMatchSnapshot();
  });

  it("RB13 multi-client safety — explicit switch still OK (endpoint)", async () => {
    vi.spyOn(entityResolution, "resolveEntities").mockResolvedValueOnce(
      resolutionBase({ client: resolvedClient(CONTACT_B, "Petr Svoboda") }),
    );

    const { response, json } = await postChat({
      orchestration: "canonical",
      message: "Teď klient Petr Svoboda, vytvoř obchod na investice 5 000 Kč měsíčně.",
      activeContext: { clientId: CONTACT_A },
    });

    expect(response.status).toBe(200);
    expect(json.contextState?.lockedClientId).toBe(CONTACT_B);
    expect(json.executionState?.clientLabel).toBe("Petr Svoboda");
    if (json.sessionId) clearSession(json.sessionId as string);
  });

  it("RB14 legacy orchestration rejects confirmExecution (route safety)", async () => {
    const { response, json } = await postChat({
      orchestration: "legacy",
      confirmExecution: true,
      message: "ano",
    });
    expect(response.status).toBe(400);
    expect(json.error).toMatch(/kanonickém režimu/i);
  });

  it("RB15 no raw JSON / entity tokens in advisor message for RB1 scenario", async () => {
    vi.spyOn(entityResolution, "resolveEntities").mockResolvedValueOnce(
      resolutionBase({ client: resolvedClient(CONTACT_A, "Test Novák") }),
    );

    const { json } = await postChat({
      orchestration: "canonical",
      message:
        "Klient Test Novák chce hypotéku 4 000 000 Kč, vytvoř obchod, interní poznámku a požadavek na občanku.",
      activeContext: { clientId: CONTACT_A },
    });

    expect(json.message).not.toMatch(/contactId|entityId|requestedActions|"dip"|"dps"|\{[\s\S]*"action"/i);
    const previews = json.executionState?.stepPreviews ?? [];
    expect(previews.every((s: { description?: string }) => !/"[a-z_]+"\s*:/i.test(s.description ?? ""))).toBe(
      true,
    );
    if (json.sessionId) clearSession(json.sessionId as string);
  });
});
