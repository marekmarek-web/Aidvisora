import { describe, expect, it } from "vitest";
import { parseLifecycleStage, parseTagsFromCell } from "../import-parsers";

describe("parseLifecycleStage", () => {
  it("maps English keys", () => {
    expect(parseLifecycleStage("client")).toBe("client");
    expect(parseLifecycleStage("FORMER_CLIENT")).toBe("former_client");
  });
  it("maps Czech labels", () => {
    expect(parseLifecycleStage("Klient")).toBe("client");
    expect(parseLifecycleStage("Bývalý klient")).toBe("former_client");
  });
  it("returns null for empty or unknown", () => {
    expect(parseLifecycleStage("")).toBeNull();
    expect(parseLifecycleStage("  ")).toBeNull();
    expect(parseLifecycleStage("VIP")).toBeNull();
  });
});

describe("parseTagsFromCell", () => {
  it("splits on semicolon", () => {
    expect(parseTagsFromCell("VIP; rodina")).toEqual(["VIP", "rodina"]);
  });
  it("splits on comma when no semicolon", () => {
    expect(parseTagsFromCell("a, b")).toEqual(["a", "b"]);
  });
  it("returns null for empty", () => {
    expect(parseTagsFromCell("")).toBeNull();
  });
});
