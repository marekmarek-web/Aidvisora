/**
 * Ambiguous image intake: structured next-step chips + pending session builder.
 */
import { describe, it, expect, vi } from "vitest";
import { dispatchSuggestedNextStepItem } from "@/lib/ai/suggested-next-step-dispatch";
import { looksLikeClientNameInput } from "@/lib/ai/image-intake/client-name-input-heuristic";
import { buildPendingImageIntakeResolutionFromOrchestratorResult } from "@/lib/ai/image-intake/pending-resolution-metadata";
import type { ImageIntakeOrchestratorResult } from "@/lib/ai/image-intake/orchestrator";
import type { SuggestedNextStepItem } from "@/lib/ai/suggested-next-step-types";

describe("dispatchSuggestedNextStepItem", () => {
  it("focus_composer calls onFocusComposer and not onSend", () => {
    const onSend = vi.fn();
    const onFocusComposer = vi.fn();
    const item: SuggestedNextStepItem = {
      label: "Nebo sdělte jméno klienta v textovém poli.",
      kind: "focus_composer",
    };
    dispatchSuggestedNextStepItem(item, { onSend, onFocusComposer });
    expect(onSend).not.toHaveBeenCalled();
    expect(onFocusComposer).toHaveBeenCalledTimes(1);
  });

  it("send_message calls onSend with label", () => {
    const onSend = vi.fn();
    const onFocusComposer = vi.fn();
    const item: SuggestedNextStepItem = { label: "Potvrďte akci", kind: "send_message" };
    dispatchSuggestedNextStepItem(item, { onSend, onFocusComposer });
    expect(onSend).toHaveBeenCalledWith("Potvrďte akci");
    expect(onFocusComposer).not.toHaveBeenCalled();
  });

  it("hint is a no-op", () => {
    const onSend = vi.fn();
    const onFocusComposer = vi.fn();
    const item: SuggestedNextStepItem = { label: "Nápověda", kind: "hint" };
    dispatchSuggestedNextStepItem(item, { onSend, onFocusComposer });
    expect(onSend).not.toHaveBeenCalled();
    expect(onFocusComposer).not.toHaveBeenCalled();
  });
});

describe("looksLikeClientNameInput", () => {
  it("rejects instructional chip copy", () => {
    expect(looksLikeClientNameInput("Nebo sdělte jméno klienta v textovém poli.")).toBe(false);
    expect(looksLikeClientNameInput("Otevřete kartu klienta a nahrajte obrázek znovu.")).toBe(false);
  });

  it("accepts a real name", () => {
    expect(looksLikeClientNameInput("Lucie Opalecká")).toBe(true);
  });
});

function minimalAmbiguousOrchestratorResult(): ImageIntakeOrchestratorResult {
  return {
    response: {
      intakeId: "intake_test_1",
      laneDecision: "image_intake",
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
        inputType: "screenshot_client_communication",
        inputSubtype: "client_chat_single",
        confidence: 0.8,
        rationale: "test",
        needsDeepExtraction: false,
        safePreviewAlready: false,
        likelyFinancialInfo: false,
        uncertaintyFlags: [],
      },
      clientBinding: {
        state: "insufficient_binding",
        clientId: null,
        clientLabel: null,
        confidence: 0,
        candidates: [],
        source: "none",
        warnings: [],
      },
      caseBinding: {
        state: "insufficient_binding",
        caseId: null,
        caseLabel: null,
        confidence: 0,
        candidates: [],
        source: "none",
      },
      factBundle: {
        facts: [],
        missingFields: [],
        ambiguityReasons: [],
        extractionSource: "stub",
      },
      actionPlan: {
        outputMode: "ambiguous_needs_input",
        recommendedActions: [],
        draftReplyText: null,
        whyThisAction: "test",
        whyNotOtherActions: null,
        needsAdvisorInput: true,
        safetyFlags: [],
      },
      previewSteps: [],
      trace: {
        intakeId: "intake_test_1",
        sessionId: "sess",
        assetIds: [],
        laneDecision: "image_intake",
        inputType: "screenshot_client_communication",
        outputMode: "ambiguous_needs_input",
        clientBindingState: "insufficient_binding",
        factCount: 0,
        actionCount: 0,
        writeReady: false,
        guardrailsTriggered: [],
        durationMs: 1,
        timestamp: new Date(),
      },
    },
    executionPlan: null,
    previewPayload: {
      writeReady: false,
      warnings: [],
      advisorSummaryLines: [],
      lifecycleStatusNote: null,
    },
    classifierUsedModel: null,
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
}

describe("buildPendingImageIntakeResolutionFromOrchestratorResult", () => {
  it("returns pending only for ambiguous_needs_input", () => {
    const r = minimalAmbiguousOrchestratorResult();
    const p = buildPendingImageIntakeResolutionFromOrchestratorResult(r);
    expect(p).not.toBeNull();
    expect(p!.intakeId).toBe("intake_test_1");
    expect(p!.bindingState).toBe("insufficient_binding");
    expect(p!.actionPlan.outputMode).toBe("ambiguous_needs_input");
  });

  it("returns null when output mode is not ambiguous", () => {
    const r = minimalAmbiguousOrchestratorResult();
    r.response.actionPlan = { ...r.response.actionPlan, outputMode: "no_action_archive_only" };
    expect(buildPendingImageIntakeResolutionFromOrchestratorResult(r)).toBeNull();
  });
});
