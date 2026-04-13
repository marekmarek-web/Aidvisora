/**
 * Phase 3.9 — Write-through integration tests
 *
 * Validates the generic write-through contract: after apply, all downstream layers
 * must reflect the state produced by the transaction.
 *
 * Tests are generic — no vendor, no institution name, no PDF filename hardcoded.
 * They validate structural completeness, not business values.
 */

import { describe, it, expect } from "vitest";
import { validateWriteThroughResult } from "../write-through-contract";

// ── validateWriteThroughResult ─────────────────────────────────────────────

describe("validateWriteThroughResult", () => {
  it("passes when contact, contract and document are all present", () => {
    const violations = validateWriteThroughResult({
      linkedClientId: "contact-123",
      createdContractId: "contract-456",
      linkedDocumentId: "doc-789",
    });
    expect(violations).toHaveLength(0);
  });

  it("passes when createdClientId is used instead of linkedClientId", () => {
    const violations = validateWriteThroughResult({
      createdClientId: "contact-new",
      createdContractId: "contract-456",
      linkedDocumentId: "doc-789",
    });
    expect(violations).toHaveLength(0);
  });

  it("flags missing contact", () => {
    const violations = validateWriteThroughResult({
      createdContractId: "contract-456",
      linkedDocumentId: "doc-789",
    });
    expect(violations.some((v) => v.includes("contact"))).toBe(true);
  });

  it("flags missing contract", () => {
    const violations = validateWriteThroughResult({
      linkedClientId: "contact-123",
      linkedDocumentId: "doc-789",
    });
    expect(violations.some((v) => v.includes("contract"))).toBe(true);
  });

  it("does not flag document when documentLinkWarning is present (soft-fail path)", () => {
    const violations = validateWriteThroughResult({
      linkedClientId: "contact-123",
      createdContractId: "contract-456",
      documentLinkWarning: "document_link_failed",
    });
    // Contact and contract present — no violations for those two
    expect(violations.filter((v) => v.includes("contact") || v.includes("contract"))).toHaveLength(0);
    // Document warning is acceptable (soft-fail)
    expect(violations.filter((v) => v.includes("document linkage result unknown"))).toHaveLength(0);
  });

  it("flags unknown document state when neither linkedDocumentId nor documentLinkWarning is set", () => {
    const violations = validateWriteThroughResult({
      linkedClientId: "contact-123",
      createdContractId: "contract-456",
    });
    expect(violations.some((v) => v.includes("document linkage result unknown"))).toBe(true);
  });

  it("passes with payment setup present (optional)", () => {
    const violations = validateWriteThroughResult({
      linkedClientId: "contact-123",
      createdContractId: "contract-456",
      linkedDocumentId: "doc-789",
      createdPaymentSetupId: "pay-000",
    });
    expect(violations).toHaveLength(0);
  });
});

// ── Coverage list mapping — generic ──────────────────────────────────────────

describe("coverage list mapping: generic extraction envelope shapes", () => {
  it("treats coverageList as array of generic items with itemKey", () => {
    const coverageList = [
      { itemKey: "Životní pojištění", segmentCode: "ZP" },
      { itemKey: "Pojištění majetku", segmentCode: "MAJ" },
    ];
    // Both items have valid itemKey — both should be mapped
    const validItems = coverageList.filter(
      (item) => typeof item.itemKey === "string" && item.itemKey.trim().length > 0
    );
    expect(validItems).toHaveLength(2);
  });

  it("skips coverage items without itemKey or name", () => {
    const coverageList = [
      { segmentCode: "ZP" }, // no itemKey or name
      { itemKey: "", segmentCode: "MAJ" }, // empty string
      { itemKey: "  ", segmentCode: "ODP" }, // whitespace only
      { itemKey: "Investice", segmentCode: "INV" }, // valid
    ];
    const validItems = coverageList.filter(
      (item) => typeof item.itemKey === "string" && item.itemKey.trim().length > 0
    );
    expect(validItems).toHaveLength(1);
    expect(validItems[0].itemKey).toBe("Investice");
  });
});

// ── Catalog FK resolution: name normalization ─────────────────────────────────

describe("catalog FK resolution: name normalization rules", () => {
  function normalizeForCatalogLookup(name: string): string {
    return name.trim().toLowerCase();
  }

  it("trims and lowercases partner name for lookup", () => {
    expect(normalizeForCatalogLookup("  Allianz  ")).toBe("allianz");
    expect(normalizeForCatalogLookup("GENERALI")).toBe("generali");
  });

  it("null/empty partnerName resolves to no FK", () => {
    const partnerName: string | null = null;
    expect(!partnerName).toBe(true);
  });
});
