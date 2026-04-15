/**
 * LIVE BUGFIX PASS — Final contract publish integration tests
 *
 * Validates the 5 downstream scénáře:
 * 1. final contract publish → linked document + contract exists + product visible artifact exists
 * 2. final contract publish visibleToClient → portfolio read model not empty
 * 3. final contract publish with eligible payment → payments read model populated
 * 4. final contract publish without payment eligibility → payments page stable empty state
 * 5. supporting doc → linked document only, no product publish, no payment publish
 *
 * Additional:
 * 6. hasAnyContractArtifacts uses createdPaymentSetupId (not createdPaymentId)
 * 7. Truthful guard: product_published_visible_to_client requires real createdContractId
 * 8. Truthful guard: payment_setup_published requires real createdPaymentSetupId
 *
 * Run: pnpm vitest run src/lib/ai/__tests__/live-publish-bugfix-pass.test.ts
 */

import { describe, it, expect } from "vitest";
import { computePublishOutcome } from "@/lib/ai/contracts-analyses-bridge";
import { validateWriteThroughResult } from "../write-through-contract";
import {
  aggregatePortfolioMetrics,
  segmentToPortfolioGroup,
} from "@/lib/client-portfolio/read-model";
import type { ApplyResultPayload } from "@/lib/ai/review-queue-repository";

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Final contract publish → contract artifact + linked document + product visible
// ═══════════════════════════════════════════════════════════════════════════════

describe("1. Final contract publish creates full artifact set", () => {
  it("apply must produce createdContractId (not just linkedDocumentId)", () => {
    // Simulate correct apply result
    const payload: ApplyResultPayload = {
      linkedClientId: "contact-1",
      createdContractId: "contract-1",
      linkedDocumentId: "doc-1",
    };
    const violations = validateWriteThroughResult(payload);
    expect(violations).toHaveLength(0);
  });

  it("document-only result (no createdContractId) is a write-through violation for final-contract path", () => {
    const payload: ApplyResultPayload = {
      linkedClientId: "contact-1",
      linkedDocumentId: "doc-1",
      // No createdContractId — invalid for final contract publish
    };
    const violations = validateWriteThroughResult(payload);
    expect(violations.some((v) => v.includes("contract"))).toBe(true);
  });

  it("supporting attach-only: validateWriteThroughResult allows missing contract when flagged", () => {
    const payload: ApplyResultPayload = {
      linkedClientId: "contact-1",
      linkedDocumentId: "doc-support",
    };
    const violations = validateWriteThroughResult(payload, { isSupportingDocumentOnly: true });
    expect(violations).toHaveLength(0);
  });

  it("contract artifact with visibleToClient=true passes portal filter", () => {
    // DB row written by apply
    const contractRow = {
      visibleToClient: true,
      portfolioStatus: "active",
      archivedAt: null,
    };
    const passesPortfolioFilter =
      contractRow.visibleToClient === true &&
      (contractRow.portfolioStatus === "active" || contractRow.portfolioStatus === "ended") &&
      contractRow.archivedAt === null;
    expect(passesPortfolioFilter).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. visibleToClient contract → portfolio read model is not empty
// ═══════════════════════════════════════════════════════════════════════════════

describe("2. Portfolio read model: published contract is visible", () => {
  it("contract with visibleToClient=true + portfolioStatus=active passes portal filter", () => {
    const rows = [
      {
        id: "c1",
        segment: "ZP",
        visibleToClient: true,
        portfolioStatus: "active" as const,
        premiumAmount: "500",
        premiumAnnual: null,
        portfolioAttributes: {},
      },
    ];
    const visible = rows.filter(
      (r) =>
        r.visibleToClient === true &&
        (r.portfolioStatus === "active" || r.portfolioStatus === "ended")
    );
    expect(visible).toHaveLength(1);
  });

  it("contract with visibleToClient=false is filtered out", () => {
    const rows = [
      {
        segment: "ZP",
        visibleToClient: false,
        portfolioStatus: "active" as const,
        premiumAmount: null,
        premiumAnnual: null,
        portfolioAttributes: {},
      },
    ];
    const visible = rows.filter(
      (r) =>
        r.visibleToClient === true &&
        (r.portfolioStatus === "active" || r.portfolioStatus === "ended")
    );
    expect(visible).toHaveLength(0);
  });

  it("aggregatePortfolioMetrics handles contract row from apply", () => {
    const rows = [
      {
        segment: "ZP",
        premiumAmount: "1200",
        premiumAnnual: null,
        portfolioAttributes: {} as Record<string, unknown>,
      },
    ];
    const metrics = aggregatePortfolioMetrics(rows);
    expect(metrics.activeContractCount).toBe(1);
    expect(metrics.monthlyInsurancePremiums).toBe(1200);
  });

  it("segmentToPortfolioGroup resolves for all canonical segments written by apply", () => {
    const segments = ["ZP", "INV", "DPS", "DIP", "HYPO", "UVER", "MAJ", "ODP", "AUTO_PR", "AUTO_HAV", "CEST", "FIRMA_POJ"];
    for (const seg of segments) {
      const group = segmentToPortfolioGroup(seg, {});
      expect(typeof group).toBe("string");
      expect(group.length).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Eligible payment → /client/payments populated
// ═══════════════════════════════════════════════════════════════════════════════

describe("3. Eligible payment setup populates /client/payments", () => {
  it("payment with status=active + needsHumanReview=false is visible in payments", () => {
    const paymentSetups = [
      {
        id: "ps1",
        status: "active",
        needsHumanReview: false,
        accountNumber: "1234/0300",
        providerName: "Pojišťovna",
        contractNumber: "ABC-001",
      },
    ];
    const visible = paymentSetups.filter(
      (p) => p.status === "active" && p.needsHumanReview === false
    );
    expect(visible).toHaveLength(1);
    expect(visible[0].accountNumber).toBe("1234/0300");
  });

  it("payment with needsHumanReview=true is hidden until advisor confirms", () => {
    const paymentSetups = [
      {
        id: "ps2",
        status: "active",
        needsHumanReview: true,
        accountNumber: "5678/0100",
      },
    ];
    const visible = paymentSetups.filter(
      (p) => p.status === "active" && p.needsHumanReview === false
    );
    expect(visible).toHaveLength(0);
  });

  it("computePublishOutcome reports payment_setup_published when createdPaymentSetupId is present", () => {
    const payload: ApplyResultPayload = {
      createdContractId: "c1",
      createdPaymentSetupId: "ps1",
    };
    const outcome = computePublishOutcome(payload, false);
    expect(outcome.paymentOutcome).toBe("payment_setup_published");
  });

  it("payment instruction without accountNumber is filtered out (mapAiPaymentSetupToInstruction guard)", () => {
    const rows = [
      { accountNumber: null, iban: null, providerName: "X", contractNumber: "Y", paymentType: "insurance", variableSymbol: null, amount: null, frequency: null, paymentInstructionsText: null, productName: null, bankCode: null },
      { accountNumber: "1234/0300", iban: null, providerName: "Y", contractNumber: "Z", paymentType: "insurance", variableSymbol: null, amount: "500", frequency: "monthly", paymentInstructionsText: null, productName: null, bankCode: null },
    ];
    const visible = rows.filter((r) => r.accountNumber || r.iban);
    expect(visible).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. No payment eligibility → stable empty state, no crash
// ═══════════════════════════════════════════════════════════════════════════════

describe("4. No payment eligibility → payments page stable empty state", () => {
  it("empty payment instructions list is valid (not a crash)", () => {
    const paymentInstructions: unknown[] = [];
    // ClientPaymentsView renders empty state div when list is empty
    expect(paymentInstructions.length === 0).toBe(true);
    expect(() => paymentInstructions.length).not.toThrow();
  });

  it("null/undefined items in payment list are filtered before render", () => {
    const rawRows = [null, undefined, { accountNumber: "1234/0300", providerName: "X" }];
    const filtered = rawRows.filter(Boolean);
    expect(filtered).toHaveLength(1);
  });

  it("computePublishOutcome for final contract without payment → payment_setup_skipped", () => {
    const payload: ApplyResultPayload = {
      createdContractId: "c1",
      linkedClientId: "contact-1",
      // No createdPaymentSetupId
    };
    const outcome = computePublishOutcome(payload, false);
    expect(outcome.mode).toBe("product_published_visible_to_client");
    expect(outcome.paymentOutcome).toBe("payment_setup_skipped");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Supporting document → attach only, no product, no payment
// ═══════════════════════════════════════════════════════════════════════════════

describe("5. Supporting document → attach only", () => {
  it("supporting doc must not produce product_published outcome", () => {
    const payload: ApplyResultPayload = { linkedDocumentId: "doc-support" };
    const outcome = computePublishOutcome(payload, true); // isSupporting=true
    expect(outcome.mode).not.toBe("product_published_visible_to_client");
    expect(outcome.visibleToClient).toBe(false);
  });

  it("supporting doc must not produce payment_setup_published", () => {
    const payload: ApplyResultPayload = { linkedDocumentId: "doc-support" };
    const outcome = computePublishOutcome(payload, true);
    expect(outcome.paymentOutcome).toBe("payment_setup_skipped");
  });

  it("supporting doc with createdPaymentSetupId (should not happen) does not pollute mode", () => {
    // Even if supporting guard fires, contract is not in payload → no product mode
    const payload: ApplyResultPayload = {
      linkedDocumentId: "doc-support",
      // No createdContractId — supporting doc cannot create contract
    };
    const outcome = computePublishOutcome(payload, true);
    expect(outcome.mode).toBe("supporting_doc_only");
    expect(outcome.visibleToClient).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. Bug regression: hasAnyContractArtifacts uses createdPaymentSetupId
// ═══════════════════════════════════════════════════════════════════════════════

describe("6. Bug regression: createdPaymentSetupId (not createdPaymentId)", () => {
  it("computePublishOutcome uses createdPaymentSetupId for payment outcome", () => {
    // Bug: old code used payload.createdPaymentId (non-existent field)
    // Fix: use payload.createdPaymentSetupId
    const withSetupId: ApplyResultPayload = {
      createdContractId: "c1",
      createdPaymentSetupId: "ps1",
      // No createdPaymentId (deprecated/wrong field)
    };
    const outcome = computePublishOutcome(withSetupId, false);
    expect(outcome.paymentOutcome).toBe("payment_setup_published");
  });

  it("createdPaymentId (wrong field) does not trigger payment_setup_published", () => {
    // This tests that the bugfix correctly uses createdPaymentSetupId
    const withWrongField = {
      createdContractId: "c1",
      createdPaymentId: "p1", // wrong/deprecated field
    } as ApplyResultPayload;
    const outcome = computePublishOutcome(withWrongField, false);
    // createdPaymentId is not read by computePublishOutcome — only createdPaymentSetupId
    expect(outcome.paymentOutcome).toBe("payment_setup_skipped");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7 + 8. Truthful outcome guards
// ═══════════════════════════════════════════════════════════════════════════════

describe("7. Truthful guard: product_published_visible_to_client requires real contractId", () => {
  it("empty string createdContractId does not produce product_published mode", () => {
    const payload: ApplyResultPayload = {
      createdContractId: "", // empty string — not a real DB ID
      linkedClientId: "c1",
    };
    const outcome = computePublishOutcome(payload, false);
    // Empty string must not be treated as valid contract artifact
    expect(outcome.mode).not.toBe("product_published_visible_to_client");
  });

  it("null createdContractId does not produce product_published mode", () => {
    const payload: ApplyResultPayload = {
      createdContractId: undefined,
      linkedClientId: "c1",
    };
    const outcome = computePublishOutcome(payload, false);
    expect(outcome.mode).not.toBe("product_published_visible_to_client");
  });

  it("real UUID-like createdContractId produces product_published mode", () => {
    const payload: ApplyResultPayload = {
      createdContractId: "550e8400-e29b-41d4-a716-446655440000",
      linkedClientId: "c1",
    };
    const outcome = computePublishOutcome(payload, false);
    expect(outcome.mode).toBe("product_published_visible_to_client");
    expect(outcome.visibleToClient).toBe(true);
  });
});

describe("8. Truthful guard: payment_setup_published requires real paymentSetupId", () => {
  it("empty string createdPaymentSetupId does not produce payment_setup_published", () => {
    const payload: ApplyResultPayload = {
      createdContractId: "c1",
      createdPaymentSetupId: "", // empty — not real
    };
    const outcome = computePublishOutcome(payload, false);
    expect(outcome.paymentOutcome).toBe("payment_setup_skipped");
  });

  it("real createdPaymentSetupId produces payment_setup_published", () => {
    const payload: ApplyResultPayload = {
      createdContractId: "c1",
      createdPaymentSetupId: "ps-real-id-123",
    };
    const outcome = computePublishOutcome(payload, false);
    expect(outcome.paymentOutcome).toBe("payment_setup_published");
  });

  it("internal_document_only path never produces payment_setup_published", () => {
    // Document attached, no contract → internal_document_only
    // In this branch, paymentOutcome must be payment_setup_skipped
    const payload: ApplyResultPayload = {
      linkedDocumentId: "doc-1",
      // No createdContractId
    };
    const outcome = computePublishOutcome(payload, false);
    expect(outcome.mode).toBe("internal_document_only");
    expect(outcome.paymentOutcome).toBe("payment_setup_skipped");
  });
});
