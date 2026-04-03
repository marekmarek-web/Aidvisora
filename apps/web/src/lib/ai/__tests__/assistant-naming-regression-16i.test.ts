/**
 * Phase 16I — regression pack for Czech naming, internal-token hygiene, and advisor preview.
 * Locks in plan §16 mandatory scenarios from ai-assistant-czech-naming-normalization-plan.md
 */

import { describe, it, expect } from "vitest";
import { PRODUCT_DOMAINS } from "../assistant-domain-model";
import {
  canonicalDealTitle,
  canonicalDealDetailLine,
  canonicalTaskTitle,
  canonicalClientRequestSubject,
  canonicalPortalMessageTemplate,
  canonicalMaterialRequestTitle,
} from "../assistant-canonical-names";
import { opportunityTitleFromSlots } from "../assistant-case-type-map";
import { sanitizeAssistantMessageForAdvisor } from "../assistant-message-sanitizer";
import { buildExecutionPlan, buildStepDescription } from "../assistant-execution-plan";
import { emptyCanonicalIntent, type CanonicalIntent } from "../assistant-domain-model";
import { getOrCreateSession, lockAssistantClient } from "../assistant-session";

const TENANT = "t-16i";
const USER = "u-16i";

const FORBIDDEN_TITLE_SNIPPETS = [/\bhypo\b/i, /hypo:/i, /investice\s*\(/i, /^invest\s/i];

function resolutionFor(clientId: string) {
  return {
    client: {
      entityType: "contact" as const,
      entityId: clientId,
      displayLabel: "Test Novák",
      confidence: 1,
      ambiguous: false,
      alternatives: [] as { id: string; label: string }[],
    },
    opportunity: null,
    document: null,
    contract: null,
    warnings: [] as string[],
  };
}

describe("16I-1 Hypotéka 4 000 000 Kč", () => {
  it("title is Hypotéka + amount, not raw hypo slug", () => {
    const title = canonicalDealTitle({ productDomain: "hypo", amount: 4_000_000 });
    expect(title).toMatch(/Hypotéka/);
    expect(title).toMatch(/4/);
    for (const re of FORBIDDEN_TITLE_SNIPPETS) {
      expect(title).not.toMatch(re);
    }
  });

  it("opportunityTitleFromSlots never produces hypo: hypotéka style", () => {
    const t = opportunityTitleFromSlots({
      productDomain: "hypo",
      purpose: "hypotéka na byt",
      amount: 4_000_000,
    });
    expect(t).not.toMatch(/hypo:/i);
    expect(t).toMatch(/Hypotéka/);
  });

  it("detail (bank, rate, maturity) is separate from short title", () => {
    const title = canonicalDealTitle({ productDomain: "hypo", amount: 4_000_000 });
    const detail = canonicalDealDetailLine({
      bank: "Raiffeisenbank",
      interestRate: "4,5 %",
      maturity: "30 let",
    });
    expect(detail).toMatch(/Raiffeisenbank/);
    expect(detail).toMatch(/4,5/);
    expect(title).not.toMatch(/Raiffeisenbank/);
    expect(title).not.toMatch(/4,5/);
  });

  it("buildStepDescription for createOpportunity uses detail line, not title dump", () => {
    const desc = buildStepDescription("createOpportunity", {
      productDomain: "hypo",
      amount: 4_000_000,
      bank: "RB",
      interestRate: "4,5 %",
    });
    expect(desc).toMatch(/RB/);
    expect(desc).not.toMatch(/Hypotéka 4/);
  });
});

describe("16I-2 Investice 10 000 Kč měsíčně", () => {
  it("title is clean with monthly suffix", () => {
    const title = canonicalDealTitle({
      productDomain: "investice",
      amount: 10_000,
      periodicity: "měsíčně",
    });
    expect(title).toMatch(/Investice/);
    expect(title).toMatch(/měsíčně/);
    expect(title).not.toMatch(/investice\s*\(/i);
  });

  it("subtitle/detail line can carry extra facts", () => {
    const detail = canonicalDealDetailLine({
      bank: "Conseq",
      interestRate: "0,8 %",
    });
    expect(detail).toBeTruthy();
    expect(detail).toMatch(/Conseq/);
  });
});

describe("16I-3 Klientský požadavek", () => {
  it("canonical subject is literary Czech, not internal slug", () => {
    const s = canonicalClientRequestSubject({ productDomain: "hypo" });
    expect(s).toMatch(/Doložit/);
    expect(s).toMatch(/hypotéce/);
    expect(looksInternalSubject(s)).toBe(false);
  });

  it("replaces raw hypo-docs style", () => {
    const s = canonicalClientRequestSubject({
      productDomain: "investice",
      taskTitle: "invest docs pls",
    });
    expect(s).not.toMatch(/invest docs/i);
    expect(s.length).toBeGreaterThan(8);
  });
});

function looksInternalSubject(s: string): boolean {
  return /^(hypo|uver|invest|dip)[\s:_]/i.test(s) || /^[a-z_]{2,8}$/i.test(s);
}

describe("16I-4 Portálová zpráva", () => {
  it("template is professional Czech when body missing", () => {
    const body = canonicalPortalMessageTemplate({ productDomain: "hypo" });
    expect(body.startsWith("Dobrý den")).toBe(true);
    expect(body.length).toBeGreaterThan(40);
    expect(body).not.toMatch(/\[TOOL/i);
    expect(body).not.toMatch(/hypo:/i);
  });

  it("keeps explicit advisor-written body when clean", () => {
    const custom =
      "Dobrý den, prosím o zaslání výpisů z účtu za poslední tři měsíce. Děkuji.";
    expect(canonicalPortalMessageTemplate({ existingBody: custom })).toBe(custom);
  });
});

describe("16I-5 Úkoly", () => {
  const verbStart =
    /^(Zkontrolovat|Doplnit|Ověřit|Prověřit|Naplánovat|Připomínka|Úkol|[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ])/u;

  it("default createTask titles start with a verb (domain coverage)", () => {
    for (const domain of PRODUCT_DOMAINS) {
      const t = canonicalTaskTitle({ action: "createTask", productDomain: domain });
      expect(t, domain).toMatch(verbStart);
      expect(t).not.toMatch(/^hypo\b/i);
    }
  });

  it("follow-up titles start with Naplánovat or fallback", () => {
    for (const domain of PRODUCT_DOMAINS) {
      const t = canonicalTaskTitle({ action: "createFollowUp", productDomain: domain });
      expect(t, domain).toMatch(verbStart);
    }
  });

  it("material request titles are clean", () => {
    const m = canonicalMaterialRequestTitle({ productDomain: "hypo", taskTitle: "hypo stuff" });
    expect(m).not.toMatch(/^hypo\b/i);
    expect(m).toMatch(/Podklady|hypotéce/i);
  });
});

describe("16I-6 Assistant preview / message hygiene", () => {
  it("sanitizeAssistantMessageForAdvisor strips internal markers", () => {
    const dirty = `Ahoj
[TOOL:create_opportunity]
[RESULT:foo] {"a":1}
[contact:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee]
Status: [awaiting_confirmation]
dealId: ffffffff-ffff-ffff-ffff-ffffffffffff
`;
    const clean = sanitizeAssistantMessageForAdvisor(dirty);
    expect(clean).not.toMatch(/\[TOOL/);
    expect(clean).not.toMatch(/\[RESULT/);
    expect(clean).not.toMatch(/\[contact:/i);
    expect(clean).not.toMatch(/\[awaiting_confirmation\]/i);
    expect(clean).not.toMatch(/dealId:/i);
  });

  it("execution plan step labels are Czech, not camelCase actions", () => {
    const session = getOrCreateSession(undefined, TENANT, USER);
    lockAssistantClient(session, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    const intent: CanonicalIntent = {
      ...emptyCanonicalIntent(),
      intentType: "multi_action",
      requestedActions: ["create_opportunity", "create_task", "send_portal_message"],
      productDomain: "hypo",
      extractedFacts: [{ key: "amount", value: 2_000_000, source: "user_text" }],
      temporalExpressions: [],
    };
    const plan = buildExecutionPlan(intent, resolutionFor("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"), session);
    for (const s of plan.steps) {
      expect(s.label).not.toMatch(/^[a-z]+[A-Z]/);
      expect(s.label).not.toMatch(/createOpportunity|scheduleCalendar|sendPortal/i);
    }
  });
});
