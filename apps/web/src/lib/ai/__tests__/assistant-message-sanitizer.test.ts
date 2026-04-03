/**
 * H7: advisor-facing messages must never expose internal tokens, raw JSON, or raw ID lines.
 */
import { describe, it, expect } from "vitest";
import { sanitizeAssistantMessageForAdvisor, sanitizeWarningForAdvisor } from "../assistant-message-sanitizer";

const FORBIDDEN = [
  "[RESULT:",
  "[TOOL:",
  "[requires_confirmation]",
  "[confirmed]",
  "[client:",
  "[contact:",
  "[CONTEXT:",
  "contactId:",
  "dealId:",
  "taskId:",
  "sessionId:",
  "planId:",
  '"count":',
] as const;

const SAMPLE_UUID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

describe("sanitizeAssistantMessageForAdvisor (H7)", () => {
  it.each([
    {
      name: "RESULT block with JSON",
      raw: 'Text\n[RESULT:getFoo] {"a":1,"b":"x"}\nTail',
    },
    {
      name: "TOOL marker with params",
      raw: 'Ahoj [TOOL:getClientSummary {"contactId": "abc"}] konec',
    },
    {
      name: "status brackets",
      raw: "Hotovo.\n[requires_confirmation]\nDalší řádek",
    },
    {
      name: "entity ref tags",
      raw: "Klient [client:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa] je připraven.",
    },
    {
      name: "raw id lines",
      raw: "Shrnutí:\ncontactId: 11111111-1111-1111-1111-111111111111\ndone",
    },
    {
      name: "CONTEXT markers",
      raw: "OK\n[CONTEXT:client_switch pending]\nDěkuji.",
    },
    {
      name: "inline UUID",
      raw: `Soubor ${SAMPLE_UUID} je nahrán.`,
    },
    {
      name: "sessionId line",
      raw: `Hotovo.\nsessionId: ${SAMPLE_UUID}\nKonec`,
    },
    {
      name: "orphan JSON block",
      raw: 'Text před\n{\n  "count": 1\n}\nText po',
    },
  ])("strips $name", ({ raw }) => {
    const out = sanitizeAssistantMessageForAdvisor(raw);
    for (const token of FORBIDDEN) {
      expect(out, `must not contain ${token}`).not.toContain(token);
    }
  });

  it("preserves ordinary user-facing Czech text", () => {
    const raw = "Dobrý den, máte 3 úkoly na dnes.";
    expect(sanitizeAssistantMessageForAdvisor(raw)).toBe(raw);
  });

  it("handles empty string", () => {
    expect(sanitizeAssistantMessageForAdvisor("")).toBe("");
  });

  it("sanitizeWarningForAdvisor strips UUIDs and bracket entity refs (F2 P0)", () => {
    const w = `Konflikt u klienta [client:${SAMPLE_UUID}] a sessionId: ${SAMPLE_UUID}`;
    const out = sanitizeWarningForAdvisor(w);
    expect(out).not.toContain(SAMPLE_UUID);
    expect(out).not.toContain("[client:");
    expect(out).not.toContain("sessionId:");
  });
});
