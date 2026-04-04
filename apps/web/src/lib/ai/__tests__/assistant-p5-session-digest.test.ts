/**
 * P5: rolling conversation digest for canonical intent augmentation.
 */
import { describe, it, expect } from "vitest";
import { appendToConversationDigest, getOrCreateSession } from "../assistant-session";

describe("appendToConversationDigest", () => {
  it("concatenates snippets and truncates long digests", () => {
    const s = getOrCreateSession(undefined, "t1", "u1");
    appendToConversationDigest(s, "První dotaz od uživatele");
    appendToConversationDigest(s, "Druhý dotaz");
    expect(s.conversationDigest).toContain("První");
    expect(s.conversationDigest).toContain("Druhý");
    const long = "x".repeat(400);
    appendToConversationDigest(s, long);
    expect((s.conversationDigest ?? "").length).toBeLessThanOrEqual(560);
  });
});
