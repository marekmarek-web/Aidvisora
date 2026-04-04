/**
 * P4: legacy mortgage CRM write path must use canonical naming helpers (no "hypo:" style titles).
 */
import { describe, it, expect } from "vitest";
import { canonicalDealTitle } from "../assistant-canonical-names";

describe("P4 assistant-crm-writes naming contract", () => {
  it("canonical deal title for hypo domain has no domain shorthand prefix", () => {
    const title = canonicalDealTitle({
      productDomain: "hypo",
      amount: 5_500_000,
      purpose: "koupě bytu",
    });
    expect(title).not.toMatch(/^hypo\s*:/i);
    expect(title.length).toBeGreaterThan(5);
  });
});
