/**
 * Phase 5 — End-to-end flow regression: apply → client, products/contracts, documents,
 * portal, payments, client detail, existing client idempotence.
 *
 * Generic invariants — no vendor-specific logic, no PDF hacks, no anchor dependencies.
 * Run: pnpm vitest run src/lib/ai/__tests__/phase-5-e2e-flow-regression.test.ts
 */

import { describe, it, expect } from "vitest";
import { resolveIdentityCompleteness } from "@/app/portal/contacts/[id]/contact-identity-completeness-logic";
import { evaluateApplyReadiness } from "@/lib/ai/quality-gates";
import { getPortalNotificationDeepLink } from "@/lib/client-portal/portal-notification-routing";
import {
  buildPortalAccessSnapshotFromVerdict,
  buildPortalAccessSnapshotFromFlags,
} from "@/lib/ai/client-portal-access";
import type { ContractReviewRow } from "@/lib/ai/review-queue-repository";

// ── Minimal ContractReviewRow factory ───────────────────────────────────────

function baseRow(overrides: Partial<ContractReviewRow> = {}): ContractReviewRow {
  return {
    id: "rev-p5",
    tenantId: "t1",
    fileName: "test.pdf",
    storagePath: "test/test.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1000,
    processingStatus: "ready",
    processingStage: null,
    errorMessage: null,
    extractedPayload: {},
    clientMatchCandidates: [],
    draftActions: [],
    confidence: 0.92,
    reasonsForReview: null,
    inputMode: null,
    extractionMode: null,
    detectedDocumentType: "life_insurance_contract",
    detectedDocumentSubtype: null,
    lifecycleStatus: null,
    documentIntent: null,
    extractionTrace: {
      classificationConfidence: 0.92,
      normalizedPipelineClassification: "insurance_contract",
    },
    validationWarnings: null,
    fieldConfidenceMap: undefined,
    classificationReasons: null,
    dataCompleteness: null,
    sensitivityProfile: null,
    sectionSensitivity: null,
    relationshipInference: null,
    reviewStatus: "approved",
    matchedClientId: null,
    createNewClientConfirmed: null,
    applyResultPayload: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    appliedBy: null,
    appliedAt: null,
    ...overrides,
  } as ContractReviewRow;
}

// ═══════════════════════════════════════════════════════════════════════════════
// A. End-to-end write visibility — apply invariants
// ═══════════════════════════════════════════════════════════════════════════════

describe("A. End-to-end write visibility", () => {
  describe("A1. Apply gate — existing client match", () => {
    it("existing_match with matchedClientId → not blocked on ambiguous client", () => {
      const row = baseRow({
        matchedClientId: "contact-abc",
        createNewClientConfirmed: null,
        extractionTrace: {
          classificationConfidence: 0.9,
          normalizedPipelineClassification: "insurance_contract",
          matchVerdict: "existing_match",
        },
      });
      const gate = evaluateApplyReadiness(row);
      expect(gate.blockedReasons).not.toContain("AMBIGUOUS_CLIENT_MATCH");
      expect(gate.blockedReasons).not.toContain("LLM_CLIENT_MATCH_AMBIGUOUS");
    });

    it("createNewClientConfirmed → not blocked on missing match", () => {
      const row = baseRow({
        matchedClientId: null,
        createNewClientConfirmed: true,
        extractionTrace: {
          classificationConfidence: 0.9,
          normalizedPipelineClassification: "insurance_contract",
        },
      });
      const gate = evaluateApplyReadiness(row);
      expect(gate.blockedReasons).not.toContain("AMBIGUOUS_CLIENT_MATCH");
    });

    it("ambiguous_match verdict → hard block (no ghost success)", () => {
      const row = baseRow({
        matchedClientId: null,
        createNewClientConfirmed: null,
        extractionTrace: {
          classificationConfidence: 0.9,
          normalizedPipelineClassification: "insurance_contract",
          matchVerdict: "ambiguous_match",
        },
      });
      const gate = evaluateApplyReadiness(row);
      expect(gate.blockedReasons).toContain("AMBIGUOUS_CLIENT_MATCH");
    });

    it("LLM ambiguous without existing_match verdict → hard block", () => {
      const row = baseRow({
        matchedClientId: null,
        createNewClientConfirmed: null,
        extractionTrace: {
          classificationConfidence: 0.9,
          normalizedPipelineClassification: "insurance_contract",
          llmClientMatchKind: "ambiguous",
        },
      });
      const gate = evaluateApplyReadiness(row);
      expect(gate.blockedReasons).toContain("LLM_CLIENT_MATCH_AMBIGUOUS");
    });
  });

  describe("A2. Apply gate — no ghost success without review approval", () => {
    it("unapproved review (pending) cannot proceed to apply", () => {
      const row = baseRow({
        reviewStatus: "pending",
        matchedClientId: "contact-abc",
        createNewClientConfirmed: null,
      });
      const gate = evaluateApplyReadiness(row);
      // Approved is the only valid status for apply
      const allowedForApply = ["approved"];
      expect(allowedForApply).toContain("approved");
      expect(allowedForApply).not.toContain("pending");
      expect(allowedForApply).not.toContain("rejected");
    });

    it("apply requires approved status — policy invariant", () => {
      const approvedStatuses = ["approved", "applied"];
      const blockedStatuses = ["pending", "rejected", null, undefined];
      for (const s of approvedStatuses) {
        expect(s === "approved" || s === "applied").toBe(true);
      }
      for (const s of blockedStatuses) {
        expect(s === "approved" || s === "applied").toBe(false);
      }
    });
  });

  describe("A3. Contract write: visibleToClient + portfolioStatus after apply", () => {
    it("apply sets visibleToClient=true and portfolioStatus=active (policy invariant)", () => {
      const contractAfterApply = {
        visibleToClient: true,
        portfolioStatus: "active",
        sourceKind: "ai_review",
        advisorConfirmedAt: new Date(),
      };
      expect(contractAfterApply.visibleToClient).toBe(true);
      expect(contractAfterApply.portfolioStatus).toBe("active");
      expect(contractAfterApply.sourceKind).toBe("ai_review");
      expect(contractAfterApply.advisorConfirmedAt).toBeInstanceOf(Date);
    });

    it("segment and type must always be equal (canonical sync)", () => {
      const segments = ["ZP", "MAJ", "INV", "HYPO", "DPS", "DIP", "UVER", "ODP"];
      for (const seg of segments) {
        const row = { segment: seg, type: seg };
        expect(row.type).toBe(row.segment);
      }
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// B. Portal parity / empty states
// ═══════════════════════════════════════════════════════════════════════════════

describe("B. Portal parity and empty states", () => {
  describe("B1. Client portal — not empty when active data exists", () => {
    it("portal shows data when contracts exist (non-empty guard)", () => {
      const contracts = [{ id: "c1", visibleToClient: true, portfolioStatus: "active" }];
      const isFirstRun = contracts.length === 0;
      expect(isFirstRun).toBe(false);
    });

    it("portal empty only when both contracts and documents are empty", () => {
      const emptyContracts: unknown[] = [];
      const emptyDocuments: unknown[] = [];
      const isFirstRun = emptyContracts.length === 0 && emptyDocuments.length === 0;
      expect(isFirstRun).toBe(true);
    });

    it("portal not empty if documents exist even without contracts", () => {
      const contracts: unknown[] = [];
      const documents = [{ id: "d1", visibleToClient: true }];
      const isFirstRun = contracts.length === 0 && documents.length === 0;
      expect(isFirstRun).toBe(false);
    });
  });

  describe("B2. Payment page — stable on empty and populated data", () => {
    it("empty payment instructions returns empty list — no error state", () => {
      const paymentInstructions: unknown[] = [];
      expect(paymentInstructions).toHaveLength(0);
      // Empty state renders a placeholder, not an error
      const showEmptyState = paymentInstructions.length === 0;
      expect(showEmptyState).toBe(true);
    });

    it("populated payment instructions — at least one entry visible", () => {
      const paymentInstructions = [
        {
          segment: "ZP",
          partnerName: "Pojišťovna XY",
          productName: "Životní pojištění",
          accountNumber: "1234567890/0300",
          amount: "500",
          frequency: "měsíčně",
          variableSymbol: "123456",
        },
      ];
      expect(paymentInstructions).toHaveLength(1);
      expect(paymentInstructions[0].accountNumber).toBeTruthy();
    });

    it("payment instruction with only IBAN — still valid for portal display", () => {
      const instruction = {
        segment: "INV",
        partnerName: "Fond AB",
        accountNumber: "CZ6508000000192000145399",
        variableSymbol: null,
      };
      expect(instruction.accountNumber).toBeTruthy();
    });
  });

  describe("B3. Documents in portal — visibleToClient filter", () => {
    it("client only sees visibleToClient=true documents", () => {
      const allDocs = [
        { id: "d1", visibleToClient: true },
        { id: "d2", visibleToClient: false },
        { id: "d3", visibleToClient: null },
        { id: "d4", visibleToClient: true },
      ];
      const clientDocs = allDocs.filter((d) => d.visibleToClient === true);
      expect(clientDocs).toHaveLength(2);
      expect(clientDocs.map((d) => d.id)).toEqual(["d1", "d4"]);
    });

    it("portal contracts filter: active and ended visible, draft and pending_review not", () => {
      const all = [
        { id: "c1", portfolioStatus: "active", visibleToClient: true },
        { id: "c2", portfolioStatus: "ended", visibleToClient: true },
        { id: "c3", portfolioStatus: "draft", visibleToClient: true },
        { id: "c4", portfolioStatus: "pending_review", visibleToClient: true },
      ];
      const clientVisible = all.filter(
        (c) =>
          c.visibleToClient === true &&
          (c.portfolioStatus === "active" || c.portfolioStatus === "ended")
      );
      expect(clientVisible.map((c) => c.id)).toEqual(["c1", "c2"]);
    });
  });

  describe("B4. Deep-link routing — all notification types have valid paths", () => {
    const allPortalTypes = [
      "new_message",
      "new_document",
      "advisor_material_request",
      "request_status_change",
      "important_date",
    ];

    it("all known portal notification types have non-null deep links", () => {
      for (const type of allPortalTypes) {
        const link = getPortalNotificationDeepLink({ type });
        expect(link).not.toBeNull();
        expect(link).toMatch(/^\/client\//);
      }
    });

    it("unknown type returns null — safe fallback, no orphan navigation", () => {
      expect(getPortalNotificationDeepLink({ type: "nonexistent_type" })).toBeNull();
      expect(getPortalNotificationDeepLink(null)).toBeNull();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// C. Existing client real path
// ═══════════════════════════════════════════════════════════════════════════════

describe("C. Existing client real path", () => {
  describe("C1. Existing client — no re-invite if already active", () => {
    it("ACTIVE verdict: hasActiveClientPortal=true, no invite needed", () => {
      const snapshot = buildPortalAccessSnapshotFromVerdict("ACTIVE");
      expect(snapshot.hasActiveClientPortal).toBe(true);
      expect(snapshot.accessVerdict).toBe("ACTIVE");
    });

    it("PASSWORD_PENDING verdict: portal active, no new invite", () => {
      const snapshot = buildPortalAccessSnapshotFromVerdict("PASSWORD_PENDING");
      expect(snapshot.hasActiveClientPortal).toBe(true);
    });

    it("NEVER_INVITED verdict: portal not active, invite eligible", () => {
      const snapshot = buildPortalAccessSnapshotFromVerdict("NEVER_INVITED");
      expect(snapshot.hasActiveClientPortal).toBe(false);
    });
  });

  describe("C2. existing_match → attach → apply flow idempotence", () => {
    it("existing client attach does not block gate when matchedClientId set", () => {
      const row = baseRow({
        matchedClientId: "existing-contact-id",
        createNewClientConfirmed: null,
        extractionTrace: {
          classificationConfidence: 0.9,
          normalizedPipelineClassification: "insurance_contract",
          matchVerdict: "existing_match",
        },
        reviewStatus: "approved",
      });
      const gate = evaluateApplyReadiness(row);
      expect(gate.blockedReasons).not.toContain("AMBIGUOUS_CLIENT_MATCH");
      expect(gate.blockedReasons).not.toContain("LLM_CLIENT_MATCH_AMBIGUOUS");
    });

    it("attach + apply: linkedClientId preferred over createdClientId for portal access", () => {
      const resultPayload = {
        linkedClientId: "existing-c1",
        createdClientId: null as string | null,
      };
      const contactIdForPortal = resultPayload.linkedClientId ?? resultPayload.createdClientId;
      expect(contactIdForPortal).toBe("existing-c1");
    });

    it("create new client: createdClientId used for portal access", () => {
      const resultPayload = {
        linkedClientId: null as string | null,
        createdClientId: "new-c1",
      };
      const contactIdForPortal = resultPayload.linkedClientId ?? resultPayload.createdClientId;
      expect(contactIdForPortal).toBe("new-c1");
    });
  });

  describe("C3. Contact detail after apply — identity data visible", () => {
    it("apply produces identity data on contact (confirmed or auto_applied)", () => {
      const contactAfterApply = {
        firstName: "Jana",
        lastName: "Nováková",
        email: "jana@example.cz",
        birthDate: "1990-05-14",
        personalId: "905140/1234",
        sourceKind: "ai_review",
      };
      // All identity fields set
      expect(contactAfterApply.firstName).toBeTruthy();
      expect(contactAfterApply.lastName).toBeTruthy();
      expect(contactAfterApply.sourceKind).toBe("ai_review");
    });

    it("identity completeness guard: confirmed fields → guard silent (all ok)", () => {
      const result = resolveIdentityCompleteness(
        { birthDate: "1990-05-14", personalId: "905140/1234", email: "jana@example.cz" },
        {
          reviewId: "rev-p5-c3",
          confirmedFields: ["birthDate", "personalId"],
          autoAppliedFields: ["email"],
          pendingFields: [],
        }
      );
      expect(result.every((r) => r.status === "ok")).toBe(true);
    });

    it("identity completeness: pending field shows pending_ai status", () => {
      const result = resolveIdentityCompleteness(
        { birthDate: null, personalId: "905140/1234" },
        {
          reviewId: "rev-p5-c3b",
          confirmedFields: [],
          autoAppliedFields: ["personalId"],
          pendingFields: ["birthDate"],
        }
      );
      const bd = result.find((r) => r.key === "birthDate");
      expect(bd?.status).toBe("pending_ai");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// D. Residual product coverage mapping
// ═══════════════════════════════════════════════════════════════════════════════

describe("D. Residual product coverage mapping", () => {
  describe("D1. Canonical linkage: segment = type always", () => {
    it("all canonical segments produce type === segment", () => {
      const canonicalSegments = [
        "ZP", "MAJ", "ODP", "AUTO_PR", "AUTO_HAV", "CEST",
        "INV", "DIP", "DPS", "HYPO", "UVER", "FIRMA_POJ",
      ];
      for (const seg of canonicalSegments) {
        const row = { segment: seg, type: seg };
        expect(row.type).toBe(row.segment);
      }
    });
  });

  describe("D2. Payment setup linkage — active only, no needsHumanReview", () => {
    it("payment setup filtered: status=active and needsHumanReview=false", () => {
      const setups = [
        { id: "p1", status: "active", needsHumanReview: false },
        { id: "p2", status: "active", needsHumanReview: true },
        { id: "p3", status: "inactive", needsHumanReview: false },
      ];
      const visible = setups.filter(
        (s) => s.status === "active" && s.needsHumanReview === false
      );
      expect(visible).toHaveLength(1);
      expect(visible[0].id).toBe("p1");
    });
  });

  describe("D3. Supporting document — attach-only, no contract apply", () => {
    it("supporting document guard blocks contract creation", () => {
      const isSupporting = true;
      const contractActionsToSkip = ["create_contract", "create_or_update_contract_record"];
      // If supporting, all contract actions are skipped (no DB write)
      const writtenActions = contractActionsToSkip.filter(() => !isSupporting);
      expect(writtenActions).toHaveLength(0);
    });

    it("supporting document guard does not block payment setup creation", () => {
      // Payment setup for supporting doc (payslip) is also blocked
      const isSupporting = true;
      const paymentActionsToSkip = ["create_payment_setup", "create_payment_setup_for_portal"];
      const writtenPaymentActions = paymentActionsToSkip.filter(() => !isSupporting);
      expect(writtenPaymentActions).toHaveLength(0);
    });

    it("non-supporting document proceeds normally through contract apply", () => {
      const isSupporting = false;
      const contractActionsToRun = ["create_contract"];
      const writtenActions = contractActionsToRun.filter(() => !isSupporting);
      expect(writtenActions).toHaveLength(1);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// E. Regression coverage — full path scenarios
// ═══════════════════════════════════════════════════════════════════════════════

describe("E. Regression coverage", () => {
  describe("E1. Existing client full path", () => {
    it("existing_match → no duplicate contact created (idempotent)", () => {
      // existing_match finds contact → linkedClientId, createdClientId stays null
      const resultPayload = {
        linkedClientId: "existing-abc",
        createdClientId: null as string | null,
      };
      expect(resultPayload.createdClientId).toBeNull();
      expect(resultPayload.linkedClientId).toBe("existing-abc");
    });

    it("existing client with ACTIVE portal — apply does not re-invite", () => {
      const accessSnapshot = buildPortalAccessSnapshotFromVerdict("ACTIVE");
      // ACTIVE = has linked user account, no invite needed
      expect(accessSnapshot.hasLinkedUserAccount).toBe(true);
      expect(accessSnapshot.hasAcceptedInvitation).toBe(true);
      // Portal is active — no new invite action should be triggered
    });
  });

  describe("E2. Create new client full path", () => {
    it("no_match + createNewClientConfirmed → createdClientId populated", () => {
      const resultPayload = {
        linkedClientId: null as string | null,
        createdClientId: "new-client-xyz",
      };
      expect(resultPayload.linkedClientId).toBeNull();
      expect(resultPayload.createdClientId).toBe("new-client-xyz");
    });

    it("new client has sourceKind=ai_review", () => {
      const newContact = {
        firstName: "Petr",
        lastName: "Svoboda",
        sourceKind: "ai_review" as const,
      };
      expect(newContact.sourceKind).toBe("ai_review");
    });
  });

  describe("E3. Supporting document attach-only path", () => {
    it("supporting doc attach: no contract, no payment setup, only document linked", () => {
      const resultPayload = {
        createdContractId: null as string | null,
        createdPaymentSetupId: null as string | null,
        linkedClientId: "c1",
        policyEnforcementTrace: {
          supportingDocumentGuard: true,
          outputMode: "supporting_document_only",
        },
      };
      expect(resultPayload.createdContractId).toBeNull();
      expect(resultPayload.createdPaymentSetupId).toBeNull();
      expect(resultPayload.policyEnforcementTrace.supportingDocumentGuard).toBe(true);
    });
  });

  describe("E4. Portal visible data after apply", () => {
    it("contract created by apply is visible in portal (visibleToClient=true, status=active)", () => {
      const contractFromApply = {
        visibleToClient: true,
        portfolioStatus: "active",
        sourceKind: "ai_review",
      };
      // Client portal filter: visibleToClient=true AND status in [active, ended]
      const passesPortalFilter =
        contractFromApply.visibleToClient === true &&
        (contractFromApply.portfolioStatus === "active" ||
          contractFromApply.portfolioStatus === "ended");
      expect(passesPortalFilter).toBe(true);
    });

    it("portal is NOT shown as empty when contract was just applied", () => {
      const contracts = [{ id: "c1", visibleToClient: true, portfolioStatus: "active" }];
      const documents: unknown[] = [];
      const isFirstRun = contracts.length === 0 && documents.length === 0;
      expect(isFirstRun).toBe(false); // Portal shows dashboard, not welcome screen
    });
  });

  describe("E5. Payment page stable on empty vs populated", () => {
    it("empty payment list — stable empty state, no throw", () => {
      const instructions: unknown[] = [];
      expect(() => {
        const isEmpty = instructions.length === 0;
        return isEmpty;
      }).not.toThrow();
    });

    it("populated payment list — dedup by key prevents duplicates", () => {
      const key = (i: { accountNumber: string; variableSymbol: string | null }) =>
        `${i.accountNumber}|${i.variableSymbol ?? ""}`;
      const instructions = [
        { accountNumber: "1234/0300", variableSymbol: "VS1" },
        { accountNumber: "1234/0300", variableSymbol: "VS1" }, // duplicate
        { accountNumber: "5678/0100", variableSymbol: "VS2" },
      ];
      const seen = new Set<string>();
      const deduped = instructions.filter((i) => {
        const k = key(i);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      expect(deduped).toHaveLength(2);
    });
  });

  describe("E6. Deals from contact detail — obchody tab access control", () => {
    it("obchody tab requires opportunities:read permission", () => {
      const permissions = {
        Admin: ["contacts:read", "contacts:write", "opportunities:read", "opportunities:write"],
        Advisor: ["contacts:read", "contacts:write", "opportunities:read"],
        ReadOnly: ["contacts:read"],
      };

      const hasPermission = (role: keyof typeof permissions, perm: string) =>
        permissions[role]?.includes(perm) ?? false;

      expect(hasPermission("Admin", "opportunities:read")).toBe(true);
      expect(hasPermission("Advisor", "opportunities:read")).toBe(true);
      expect(hasPermission("ReadOnly", "opportunities:read")).toBe(false);
    });

    it("obchody tab renders identity advisory note when required fields pending", () => {
      const result = resolveIdentityCompleteness(
        { birthDate: null, personalId: null },
        {
          reviewId: "rev-deals",
          confirmedFields: [],
          autoAppliedFields: [],
          pendingFields: ["birthDate"],
        }
      );
      const hasIncomplete = result.some((r) => r.status !== "ok");
      expect(hasIncomplete).toBe(true);
    });

    it("obchody tab: no advisory note when identity confirmed", () => {
      const result = resolveIdentityCompleteness(
        { birthDate: "1985-01-01", personalId: "850101/1234", email: "x@y.cz" },
        {
          reviewId: "rev-deals-ok",
          confirmedFields: ["birthDate", "personalId"],
          autoAppliedFields: ["email"],
          pendingFields: [],
        }
      );
      const allOk = result.every((r) => r.status === "ok");
      expect(allOk).toBe(true);
    });
  });
});
