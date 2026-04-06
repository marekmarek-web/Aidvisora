import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/openai", () => ({
  createResponseStructured: vi.fn(),
}));

import { extractCanonicalIntent } from "../assistant-intent-extract";
import { emptyCanonicalIntent } from "../assistant-domain-model";
import { buildExecutionPlan, buildStepDescription } from "../assistant-execution-plan";
import type { EntityResolutionResult } from "../assistant-entity-resolution";
import { getOrCreateSession, lockAssistantClient } from "../assistant-session";
import { createResponseStructured } from "@/lib/openai";

const CLIENT_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const CLIENT_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

function resolution(clientId: string, displayLabel: string): EntityResolutionResult {
  return {
    client: {
      entityType: "contact",
      entityId: clientId,
      displayLabel,
      confidence: 1,
      ambiguous: false,
      alternatives: [],
    },
    opportunity: null,
    document: null,
    contract: null,
    warnings: [],
  };
}

beforeEach(() => {
  vi.mocked(createResponseStructured).mockReset();
  vi.mocked(createResponseStructured).mockResolvedValue({ parsed: {} } as never);
});

describe("AI Assistant Phase 1 grounding", () => {
  it("Test Novák chce hypotéku 4 000 000 Kč -> klient, hypo, 3 kroky", async () => {
    const intent = await extractCanonicalIntent(
      "Klient Test Novák chce hypotéku 4 000 000 Kč, vytvoř obchod, interní poznámku a požadavek na občanku.",
    );

    expect(intent.targetClient?.ref).toBe("Test Novák");
    expect(intent.productDomain).toBe("hypo");
    expect(intent.intentType).toBe("multi_action");
    expect(intent.requestedActions).toEqual(
      expect.arrayContaining(["create_opportunity", "create_internal_note", "create_client_request"]),
    );

    const plan = buildExecutionPlan(intent, resolution(CLIENT_A, "Test Novák"));
    expect(plan.steps.map((s) => s.action)).toEqual(
      expect.arrayContaining(["createOpportunity", "createInternalNote", "createClientRequest"]),
    );
    expect(plan.steps.map((s) => s.label)).toEqual(
      expect.arrayContaining(["Vytvořit obchod", "Vytvořit interní poznámku", "Vytvořit požadavek klienta"]),
    );
  });

  it("Marek Marek chce investice 10 000 měsíčně do fondu ATRIS -> investice, ne hypo", async () => {
    const intent = await extractCanonicalIntent(
      "Marek Marek chce investice 10 000 měsíčně do fondu ATRIS, dej to do obchodů, vytvoř úkol a pošli požadavek na občanku.",
    );

    expect(intent.targetClient?.ref).toBe("Marek Marek");
    expect(intent.productDomain).toBe("investice");
    expect(intent.productDomain).not.toBe("hypo");
    expect(intent.requestedActions).toEqual(
      expect.arrayContaining(["create_opportunity", "create_task", "create_client_request"]),
    );

    const plan = buildExecutionPlan(intent, resolution(CLIENT_A, "Marek Marek"));
    const opp = plan.steps.find((s) => s.action === "createOpportunity");
    expect(opp?.params.productDomain).toBe("investice");
    expect(opp?.params.amount).toBe(10000);
    expect(opp?.params.productName).toBe("ATRIS");
  });

  it("slang mapping: hypoška, životko, penzijko, spotřebák, povko, havko", async () => {
    expect((await extractCanonicalIntent("udělej hypošku 4 000 000 Kč pro klienta")).productDomain).toBe("hypo");
    expect((await extractCanonicalIntent("založ životko pro klienta")).productDomain).toBe("zivotni_pojisteni");
    expect((await extractCanonicalIntent("doplníme penzijko")).productDomain).toBe("dps");
    expect((await extractCanonicalIntent("řeší spotřebák")).productDomain).toBe("uver");
    expect((await extractCanonicalIntent("nastav povko jako hotovo")).productDomain).toBe("auto");
    expect((await extractCanonicalIntent("doplň havko")).productDomain).toBe("auto");
  });

  it("explicitní nový klient přebíjí starý lock ve vlákně", async () => {
    const session = getOrCreateSession(undefined, "tenant-phase1", "user-phase1");
    lockAssistantClient(session, CLIENT_A);
    expect(session.lockedClientId).toBe(CLIENT_A);

    const intent = await extractCanonicalIntent("Teď klient Petr Svoboda, vytvoř obchod na investice 5 000 Kč měsíčně.");
    expect(intent.targetClient?.ref).toBe("Petr Svoboda");
    expect(intent.switchClient).toBe(true);
  });

  it("preview popisy jsou česky a bez raw technických tokenů", () => {
    const session = getOrCreateSession(undefined, "tenant-phase1-desc", "user-phase1-desc");
    lockAssistantClient(session, CLIENT_A);

    const plan = buildExecutionPlan(
      {
        ...emptyCanonicalIntent(),
        intentType: "multi_action",
        requestedActions: ["create_opportunity", "send_portal_message"],
        productDomain: "hypo",
        targetClient: { ref: CLIENT_A, resolved: true },
        extractedFacts: [
          { key: "amount", value: 4000000, source: "user_text" },
          { key: "bank", value: "Raiffeisenbank", source: "user_text" },
          { key: "interestRate", value: "4,5 %", source: "user_text" },
          { key: "maturity", value: "30 let", source: "user_text" },
        ],
        missingFields: [],
        temporalExpressions: [],
        confidence: 0.9,
        requiresConfirmation: true,
        switchClient: false,
        noEmail: false,
        subIntent: null,
        targetOpportunity: null,
        targetDocument: null,
        userConstraints: [],
      },
      resolution(CLIENT_A, "Test Novák"),
      session,
    );

    const opportunityStep = plan.steps.find((s) => s.action === "createOpportunity");
    const portalStep = plan.steps.find((s) => s.action === "sendPortalMessage");

    expect(opportunityStep?.label).toBe("Vytvořit obchod");
    expect(buildStepDescription("createOpportunity", opportunityStep?.params ?? {})).toBe(
      "Sazba 4,5 % · Raiffeisenbank · splatnost 30 let",
    );
    expect(portalStep?.label).toBe("Poslat portálovou zprávu");
    expect(buildStepDescription("sendPortalMessage", portalStep?.params ?? {})).not.toMatch(
      /clientId|contactId|execution|raw|json/i,
    );
  });
});
