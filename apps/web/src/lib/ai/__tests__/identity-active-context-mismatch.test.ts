import { describe, it, expect } from "vitest";
import {
  identityDocumentLikelyMatchesActiveContact,
  normalizePersonNameForCompare,
} from "@/lib/ai/image-intake/identity-active-context-mismatch";
import { mapImageIntakeToAssistantResponse } from "@/lib/ai/image-intake/response-mapper";
import type { ImageIntakeOrchestratorResult } from "@/lib/ai/image-intake/orchestrator";
import { emptyActionPlan, emptyFactBundle } from "@/lib/ai/image-intake/types";

describe("normalizePersonNameForCompare", () => {
  it("strips diacritics and lowercases", () => {
    expect(normalizePersonNameForCompare("Novák")).toBe("novak");
  });
});

describe("identityDocumentLikelyMatchesActiveContact", () => {
  it("matches same name tokens", () => {
    const r = identityDocumentLikelyMatchesActiveContact({
      extractedFirstName: "Jan",
      extractedLastName: "Novák",
      activeContactDisplayLabel: "Jan Novák",
    });
    expect(r.verdict).toBe("match");
  });

  it("detects mismatch for different persons", () => {
    const r = identityDocumentLikelyMatchesActiveContact({
      extractedFirstName: "Petr",
      extractedLastName: "Svoboda",
      activeContactDisplayLabel: "Jan Novák",
    });
    expect(r.verdict).toBe("mismatch");
  });

  it("inconclusive when extracted name missing", () => {
    const r = identityDocumentLikelyMatchesActiveContact({
      extractedFirstName: "",
      extractedLastName: "Novák",
      activeContactDisplayLabel: "Jan Novák",
    });
    expect(r.verdict).toBe("inconclusive");
  });
});

describe("mapImageIntakeToAssistantResponse — identity route mismatch", () => {
  it("clears locked client from context but offers CTA to suppressed id", () => {
    const fb = emptyFactBundle();
    fb.facts = [
      {
        factType: "unknown_unusable",
        value: "Petr",
        normalizedValue: "petr",
        confidence: 0.9,
        evidence: null,
        isActionable: false,
        needsConfirmation: false,
        observedVsInferred: "observed",
        factKey: "id_doc_first_name",
      },
      {
        factType: "unknown_unusable",
        value: "Svoboda",
        normalizedValue: "svoboda",
        confidence: 0.9,
        evidence: null,
        isActionable: false,
        needsConfirmation: false,
        observedVsInferred: "observed",
        factKey: "id_doc_last_name",
      },
    ];
    const suppressedId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const result: ImageIntakeOrchestratorResult = {
      response: {
        intakeId: "img_t",
        laneDecision: {
          lane: "image_intake",
          confidence: 1,
          reason: "",
          handoffReason: null,
        },
        preflight: {
          eligible: true,
          qualityLevel: "good",
          isDuplicate: false,
          mimeSupported: true,
          sizeWithinLimits: true,
          rejectReason: null,
          warnings: [],
        },
        classification: {
          inputType: "photo_or_scan_document",
          subtype: null,
          confidence: 0.9,
          containsText: true,
          likelyMessageThread: false,
          likelyDocument: true,
          likelyPayment: false,
          likelyFinancialInfo: false,
          uncertaintyFlags: [],
        },
        clientBinding: {
          state: "insufficient_binding",
          clientId: null,
          clientLabel: "Jan Novák",
          confidence: 0.25,
          candidates: [],
          source: "identity_context_mismatch",
          warnings: ["Údaje na dokladu nesedí s otevřeným kontaktem v CRM (Jan Novák)."],
          suppressedActiveClientId: suppressedId,
          suppressedActiveClientLabel: "Jan Novák",
        },
        caseBinding: {
          state: "insufficient_binding",
          caseId: null,
          caseLabel: null,
          confidence: 0,
          candidates: [],
          source: "none",
        },
        factBundle: fb,
        actionPlan: emptyActionPlan("identity_contact_intake"),
        previewSteps: [],
        trace: {
          intakeId: "img_t",
          sessionId: "sess",
          assetIds: [],
          laneDecision: "image_intake",
          inputType: "photo_or_scan_document",
          outputMode: "identity_contact_intake",
          clientBindingState: "insufficient_binding",
          factCount: 2,
          actionCount: 0,
          writeReady: false,
          guardrailsTriggered: [],
          durationMs: 1,
          timestamp: new Date(),
        },
      },
      executionPlan: null,
      previewPayload: {
        intakeId: "img_t",
        outputMode: "identity_contact_intake",
        inputType: "photo_or_scan_document",
        clientLabel: null,
        caseLabel: null,
        summary: "",
        factsSummary: [],
        uncertainties: [],
        recommendedActions: [],
        writeReady: false,
        warnings: [],
        householdAmbiguityNote: null,
        documentSetNote: null,
        lifecycleStatusNote: null,
        intentAssistCacheStatus: null,
      },
      classifierUsedModel: false,
      multimodalUsed: false,
      multimodalResult: null,
      stitchingResult: null,
      reviewHandoff: null,
      caseBindingV2: null,
      threadReconstruction: null,
      handoffPayload: null,
      caseSignals: null,
      batchDecision: null,
      combinedMultimodalResult: null,
      crossSessionReconstruction: null,
      intentChange: null,
      householdBinding: null,
      documentSetResult: null,
      lifecycleFeedback: null,
      intentAssistCacheStatus: null,
    };

    const ar = mapImageIntakeToAssistantResponse(result, "sess");
    expect(ar.contextState?.lockedClientId).toBeNull();
    expect(ar.referencedEntities.some((e) => e.id === suppressedId)).toBe(false);
    expect(ar.suggestedActions.some((a) => a.label === "Otevřít kartu otevřeného klienta")).toBe(true);
    expect(ar.message).toContain("jinou osobu");
  });
});
