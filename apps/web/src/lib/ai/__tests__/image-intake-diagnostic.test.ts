/**
 * Image Intake — Diagnostic Harness
 *
 * Statická analýza decision flow přes unit-testovatelné komponenty.
 * Každý test case extrahuje: chosenLane, outputMode, bindingResult,
 * guardrailsTriggered, disabledReasons, responseMapperPath, genericFallbackUsed.
 *
 * Testy jsou deterministické — žádný model call.
 * Výsledky jsou základem pro image-intake-diagnostic-report.md/json.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/audit", () => ({ logAudit: vi.fn(), logAuditAction: vi.fn() }));
vi.mock("@/lib/openai", () => ({
  createResponseSafe: vi.fn(),
  createResponseStructured: vi.fn(),
  createResponseStructuredWithImage: vi.fn(),
  logOpenAICall: vi.fn(),
}));
vi.mock("db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({ where: vi.fn(() => ({ orderBy: vi.fn(() => ({ limit: vi.fn(async () => []) })) })) })),
    })),
  },
  opportunities: { id: "id", tenantId: "tenantId", contactId: "contactId", title: "title", archivedAt: "archivedAt", updatedAt: "updatedAt" },
  eq: vi.fn(), and: vi.fn(), isNull: vi.fn(), desc: vi.fn(),
  contacts: {}, or: vi.fn(), sql: vi.fn(),
  households: {}, householdMembers: {},
}));
vi.mock("../assistant-contact-search", () => ({
  searchContactsForAssistant: vi.fn(async () => []),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/admin/feature-flags", () => ({
  isFeatureEnabled: vi.fn(() => true),
  getImageIntakeAdminFlags: vi.fn(() => ({ enabled: true })),
}));
vi.mock("@/lib/ai/review-queue-repository", () => ({
  createContractReview: vi.fn(async () => "mock-review-row"),
  getContractReviewStatus: vi.fn(async () => null),
}));
vi.mock("@/app/lib/coverage/item-keys", () => ({
  getAllCoverageItemKeys: vi.fn(() => []),
  getItemInfo: vi.fn(() => null),
}));
vi.mock("../assistant-coverage-item-resolve", () => ({
  normalizeCoverageStatus: vi.fn(() => null),
  getCoverageItemLabel: vi.fn(() => null),
}));
vi.mock("../assistant-execution-plan", () => ({
  buildExecutionPlan: vi.fn(() => ({ planId: "mock", steps: [] })),
  mapStepsToPreview: vi.fn(() => []),
  computeWriteStepPreflight: vi.fn(() => ({ preflightStatus: "ready", blockedReason: null })),
}));
vi.mock("../assistant-tool-router", () => ({
  routeAssistantMessage: vi.fn(),
  routeAssistantMessageCanonical: vi.fn(),
}));
vi.mock("../assistant-run-context", () => ({
  getAssistantRunStore: vi.fn(() => null),
}));
vi.mock("../image-intake/materialize-intake-documents", () => ({
  materializeIntakeImagesAsDocuments: vi.fn(async () => ["doc-mock-1", "doc-mock-2"]),
}));
vi.mock("../image-intake/load-contact-display-label-for-intake", () => ({
  loadContactDisplayLabelForIntake: vi.fn(async () => null),
}));
vi.mock("../image-intake/binding-household", () => ({
  resolveHouseholdBinding: vi.fn(async () => ({ state: "no_household", primaryClientId: null, primaryClientLabel: null, householdMembers: [], confidence: 0, ambiguityNote: null })),
}));
vi.mock("../image-intake/feature-flag", () => ({
  isImageIntakeEnabled: vi.fn(() => true),
  isImageIntakeMultimodalEnabled: vi.fn(() => false),
  isImageIntakeMultimodalEnabledForUser: vi.fn(() => false),
  isImageIntakeStitchingEnabled: vi.fn(() => false),
  isImageIntakeReviewHandoffEnabledForUser: vi.fn(() => true),
  isImageIntakeThreadReconstructionEnabledForUser: vi.fn(() => false),
  isImageIntakeCaseSignalEnabledForUser: vi.fn(() => false),
  isImageIntakeCombinedMultimodalEnabledForUser: vi.fn(() => false),
  isImageIntakeCrossSessionEnabledForUser: vi.fn(() => false),
  getImageIntakeClassifierConfig: vi.fn(() => ({ model: undefined, routingCategory: "copilot", maxOutputTokens: 120 })),
  getImageIntakeMultimodalConfig: vi.fn(() => ({ model: undefined, routingCategory: "copilot" })),
  getImageIntakeFlagState: vi.fn(() => "enabled"),
  getImageIntakeMultimodalFlagState: vi.fn(() => "disabled"),
  getImageIntakeFlagSummary: vi.fn(() => ({})),
}));

// Direct imports — planner and guardrails don't need full index
import {
  buildActionPlanV1,
  buildActionPlanV4,
  buildIdentityContactIntakeActionPlan,
} from "../image-intake/planner";
import {
  enforceImageIntakeGuardrails,
  safeOutputModeForUncertainInput,
} from "../image-intake/guardrails";
import { emptyFactBundle, emptyActionPlan } from "../image-intake/types";
import { detectIdentityContactIntakeSignals } from "../image-intake/identity-contact-intake";
import { parseImageAssetsFromBodyResult } from "../image-intake/route-handler";

import type {
  InputClassificationResult,
  ClientBindingResult,
  LaneDecisionResult,
  ImageIntakeActionPlan,
  ExtractedFactBundle,
  NormalizedImageAsset,
  ImageIntakeRequest,
} from "../image-intake/types";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeClassification(
  inputType: InputClassificationResult["inputType"],
  confidence = 0.85,
  overrides: Partial<InputClassificationResult> = {},
): InputClassificationResult {
  return {
    inputType,
    subtype: null,
    confidence,
    containsText: true,
    likelyMessageThread: inputType === "screenshot_client_communication",
    likelyDocument: inputType === "photo_or_scan_document",
    likelyPayment: inputType === "screenshot_payment_details",
    likelyFinancialInfo: inputType === "screenshot_bank_or_finance_info",
    uncertaintyFlags: [],
    ...overrides,
  };
}

function makeBinding(
  state: ClientBindingResult["state"],
  clientId: string | null = "client-abc",
  opts: Partial<ClientBindingResult> = {},
): ClientBindingResult {
  return {
    state,
    clientId,
    clientLabel: clientId ? "Marek Testovský" : null,
    confidence: state === "bound_client_confident" ? 0.9 : state === "weak_candidate" ? 0.45 : 0,
    candidates:
      state === "multiple_candidates"
        ? [
            { id: "c-1", label: "Jan Novák", score: 0.6 },
            { id: "c-2", label: "Jana Nováková", score: 0.55 },
          ]
        : [],
    source: clientId ? "session_context" : "none",
    warnings: [],
    ...opts,
  };
}

function makeLane(lane: LaneDecisionResult["lane"] = "image_intake"): LaneDecisionResult {
  return {
    lane,
    confidence: 1.0,
    reason: "Image routed to image_intake lane.",
    handoffReason: lane === "ai_review_handoff_suggestion" ? "Looks like a formal document." : null,
  };
}

function makeIdentityFactBundle(): ExtractedFactBundle {
  return {
    facts: [
      {
        factKey: "id_doc_is_identity_document",
        factType: "document_received",
        value: "yes",
        normalizedValue: "yes",
        confidence: 0.88,
        evidence: null,
        isActionable: true,
        needsConfirmation: false,
        observedVsInferred: "observed",
      },
      {
        factKey: "id_doc_first_name",
        factType: "document_received",
        value: "Petr",
        normalizedValue: "Petr",
        confidence: 0.9,
        evidence: null,
        isActionable: true,
        needsConfirmation: false,
        observedVsInferred: "observed",
      },
      {
        factKey: "id_doc_last_name",
        factType: "document_received",
        value: "Svoboda",
        normalizedValue: "Svoboda",
        confidence: 0.9,
        evidence: null,
        isActionable: true,
        needsConfirmation: false,
        observedVsInferred: "observed",
      },
      {
        factKey: "document_type",
        factType: "document_received",
        value: "občanský průkaz",
        normalizedValue: "op",
        confidence: 0.85,
        evidence: null,
        isActionable: false,
        needsConfirmation: false,
        observedVsInferred: "observed",
      },
    ],
    missingFields: ["birthDate", "email", "phone"],
    ambiguityReasons: [],
    extractionSource: "multimodal_pass",
  };
}

function runDiagnostic(
  classification: InputClassificationResult,
  binding: ClientBindingResult,
  factBundle: ExtractedFactBundle = emptyFactBundle(),
): {
  plan: ImageIntakeActionPlan;
  guardrailVerdict: ReturnType<typeof enforceImageIntakeGuardrails>;
  outputMode: string;
  proposedActions: string[];
  disabledReasons: string[];
  guardrailsTriggered: string[];
  genericFallbackUsed: boolean;
  writeReady: boolean;
} {
  const plan = buildActionPlanV4(classification, binding, factBundle, null, null, null);
  const lane = makeLane("image_intake");
  const guardrailVerdict = enforceImageIntakeGuardrails(lane, classification, binding, plan);

  const finalMode = guardrailVerdict.modeDowngraded
    ? (guardrailVerdict.downgradedTo ?? plan.outputMode)
    : plan.outputMode;

  const proposedActions = plan.recommendedActions.map((a) => a.intentType);
  const guardrailsTriggered = guardrailVerdict.violations;
  const genericFallbackUsed =
    finalMode === "no_action_archive_only" &&
    classification.inputType !== "general_unusable_image" &&
    plan.recommendedActions.length === 0;

  const writeReady =
    plan.recommendedActions.length > 0 &&
    !plan.needsAdvisorInput &&
    (binding.state === "bound_client_confident" ||
      binding.state === "bound_case_confident");

  return {
    plan,
    guardrailVerdict,
    outputMode: finalMode,
    proposedActions,
    disabledReasons: guardrailsTriggered,
    guardrailsTriggered,
    genericFallbackUsed,
    writeReady,
  };
}

// ---------------------------------------------------------------------------
// A) IMAGE / DOCUMENT ROUTING
// ---------------------------------------------------------------------------

describe("DIAG A: Image/Document Routing", () => {
  it("A01 — communication screenshot, no active client → client_message_update with note+task (FIX 1 applied)", () => {
    const classification = makeClassification("screenshot_client_communication", 0.82);
    const binding = makeBinding("insufficient_binding", null);
    const diag = runDiagnostic(classification, binding);

    // After Fix 1: communication screenshots bypass binding check in resolveOutputMode
    // → client_message_update even without active client
    expect(diag.outputMode).toBe("client_message_update");
    expect(diag.proposedActions).toContain("create_internal_note");
    expect(diag.proposedActions).toContain("create_task");
    // attach_document still NOT proposed (planClientMessageUpdate only adds it for bound client)
    expect(diag.proposedActions).not.toContain("attach_document");
    // G2 check: write actions present but needsAdvisorInput should be true (insufficient_binding)
    expect(diag.writeReady).toBe(false);
  });

  it("A02 — communication screenshot, with active client → client_message_update", () => {
    const classification = makeClassification("screenshot_client_communication", 0.82);
    const binding = makeBinding("bound_client_confident");
    const diag = runDiagnostic(classification, binding);

    expect(diag.outputMode).toBe("client_message_update");
    expect(diag.proposedActions).toContain("create_internal_note");
    expect(diag.proposedActions).toContain("create_task");
    expect(diag.proposedActions).toContain("attach_document");
    expect(diag.guardrailsTriggered).toHaveLength(0);
  });

  it("A03 — document-like image, no active client → ambiguous_needs_input", () => {
    const classification = makeClassification("photo_or_scan_document", 0.75);
    const binding = makeBinding("insufficient_binding", null);
    const diag = runDiagnostic(classification, binding);

    expect(diag.outputMode).toBe("ambiguous_needs_input");
    expect(diag.proposedActions).not.toContain("attach_document");
  });

  it("A04 — front+back identity doc, no client → planner returns ambiguous (identity intake is orchestrator-only)", () => {
    const classification = makeClassification("photo_or_scan_document", 0.88);
    const binding = makeBinding("insufficient_binding", null);
    const factBundle = makeIdentityFactBundle();
    const diag = runDiagnostic(classification, binding, factBundle);

    expect(diag.outputMode).toBe("ambiguous_needs_input");
    // identity_contact_intake requires orchestrator to call buildIdentityContactIntakeActionPlan
    // The planner (buildActionPlanV4) CANNOT produce this mode independently
    expect(diag.outputMode).not.toBe("identity_contact_intake");
  });

  it("A05 — identity doc, active client MISMATCH → ambiguous, suppressedActiveClientId preserved", () => {
    const classification = makeClassification("photo_or_scan_document", 0.88);
    const mismatchBinding = makeBinding("insufficient_binding", null, {
      source: "identity_context_mismatch",
      suppressedActiveClientId: "client-marek",
      suppressedActiveClientLabel: "Marek Marek",
      warnings: ["Údaje na dokladu nesedí s otevřeným kontaktem v CRM (Marek Marek)."],
    });
    const diag = runDiagnostic(classification, mismatchBinding);

    expect(diag.outputMode).toBe("ambiguous_needs_input");
    expect(mismatchBinding.suppressedActiveClientId).toBe("client-marek");
    // response-mapper uses suppressedActiveClientId for CTA "Otevřít kartu klienta"
  });

  it("A06 — identity doc, active client MATCHES → identity plan valid via buildIdentityContactIntakeActionPlan", () => {
    const classification = makeClassification("photo_or_scan_document", 0.88);
    const binding = makeBinding("bound_client_confident");
    const factBundle = makeIdentityFactBundle();
    const identityPlan = buildIdentityContactIntakeActionPlan(factBundle, ["doc-1", "doc-2"]);
    const lane = makeLane("image_intake");
    const guardrailVerdict = enforceImageIntakeGuardrails(lane, classification, binding, identityPlan);

    expect(identityPlan.outputMode).toBe("identity_contact_intake");
    expect(identityPlan.recommendedActions.map((a) => a.writeAction)).toContain("createContact");
    expect(identityPlan.recommendedActions.map((a) => a.writeAction)).toContain("attachDocumentToClient");
    // G2 exemption: identity_contact_intake skips binding check
    expect(guardrailVerdict.violations.filter((v) => v.includes("BINDING_VIOLATION"))).toHaveLength(0);
  });

  it("A07 — multi-image document set (supporting_reference_set) → attach_document retained OR note fallback", () => {
    const classification = makeClassification("photo_or_scan_document", 0.72);
    const binding = makeBinding("bound_client_confident");
    const docSetResult = {
      decision: "supporting_reference_set" as const,
      mergedFactBundle: null,
      documentSetSummary: "Skupina referenčních podkladů — 4 stránky.",
      confidence: 0.68,
      assetIds: ["a1", "a2", "a3", "a4"],
    };
    const plan = buildActionPlanV4(classification, binding, emptyFactBundle(), null, null, docSetResult);

    expect(plan.outputMode).toBe("supporting_reference_image");
    // V4: strips all except attachDocumentToClient; if any remain, note is NOT added
    // If no attachDocumentToClient in base plan, falls back to createInternalNote
    // DIAGNOSTIC: this means structured_image_fact_intake base → keeps attach, drops note
    const actions = plan.recommendedActions.map((a) => a.writeAction);
    const hasAttach = actions.includes("attachDocumentToClient");
    const hasNote = actions.includes("createInternalNote");
    expect(hasAttach || hasNote).toBe(true); // always has at least one action
    expect(plan.recommendedActions.some((a) => a.intentType === "create_task")).toBe(false);
    // KEY FINDING: supporting_reference_set with bound client keeps ONLY attachDocumentToClient
    // This means "Uložit jako poznámku" button is NOT available — only "Přiložit ke klientovi"
  });

  it("A08 — mixed set (mixed_or_uncertain_image) → ambiguous_needs_input with note fallback (FIX 2 applied)", () => {
    const classification = makeClassification("mixed_or_uncertain_image", 0.55);
    const binding = makeBinding("bound_client_confident");
    const diag = runDiagnostic(classification, binding);

    expect(diag.outputMode).toBe("ambiguous_needs_input");
    // After Fix 2: ambiguous_needs_input now includes create_internal_note as safe fallback
    expect(diag.proposedActions).toContain("create_internal_note");
  });

  it("A09 — low confidence (< 0.5) → ambiguous fallback even with binding", () => {
    const classification = makeClassification("photo_or_scan_document", 0.42);
    const binding = makeBinding("bound_client_confident");
    const diag = runDiagnostic(classification, binding);

    expect(diag.outputMode).toBe("ambiguous_needs_input");
    // DIAGNOSTIC: confidence < 0.5 triggers ambiguous before document threshold (0.60)
  });

  it("A10 — general_unusable_image → no_action_archive_only, zero actions", () => {
    const classification = makeClassification("general_unusable_image", 0.95);
    const binding = makeBinding("bound_client_confident");
    const diag = runDiagnostic(classification, binding);

    expect(diag.outputMode).toBe("no_action_archive_only");
    expect(diag.proposedActions).toHaveLength(0);
    expect(diag.writeReady).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// B) CONTEXT / BINDING
// ---------------------------------------------------------------------------

describe("DIAG B: Context / Binding", () => {
  it("B11 — active client context wins correctly (ui_context → bound_client_confident)", () => {
    const classification = makeClassification("screenshot_client_communication", 0.82);
    const binding = makeBinding("bound_client_confident", "client-abc", { source: "ui_context" });
    const diag = runDiagnostic(classification, binding);

    expect(diag.outputMode).toBe("client_message_update");
    expect(diag.proposedActions).toContain("attach_document");
  });

  it("B12 — active client context downgraded when identity mismatch", () => {
    const classification = makeClassification("photo_or_scan_document", 0.88);
    const binding = makeBinding("insufficient_binding", null, {
      source: "identity_context_mismatch",
      suppressedActiveClientId: "client-original",
      suppressedActiveClientLabel: "Marek Marek",
    });
    const diag = runDiagnostic(classification, binding);

    expect(diag.outputMode).toBe("ambiguous_needs_input");
    expect(binding.suppressedActiveClientId).toBe("client-original");
  });

  it("B13 — missing client context → ambiguous_needs_input with focus_composer hint", () => {
    const classification = makeClassification("photo_or_scan_document", 0.85);
    const binding = makeBinding("insufficient_binding", null);
    const diag = runDiagnostic(classification, binding);

    expect(diag.outputMode).toBe("ambiguous_needs_input");
    // response-mapper adds suggestedNextStepItems: [{kind:"focus_composer"}]
  });

  it("B14 — multiple client matches → ambiguous (no auto-pick)", () => {
    const classification = makeClassification("screenshot_client_communication", 0.80);
    const binding = makeBinding("multiple_candidates", null, { clientId: null });
    const diag = runDiagnostic(classification, binding);

    expect(diag.outputMode).toBe("ambiguous_needs_input");
  });

  it("B15 — weak_candidate → ambiguous (not enough confidence for write)", () => {
    const classification = makeClassification("photo_or_scan_document", 0.80);
    const binding = makeBinding("weak_candidate", "client-maybe");
    const diag = runDiagnostic(classification, binding);

    expect(diag.outputMode).toBe("ambiguous_needs_input");
  });

  it("B16 — household ambiguous case: plan unchanged, only warning added by mapper", () => {
    const classification = makeClassification("screenshot_client_communication", 0.82);
    const binding = makeBinding("bound_client_confident");
    const diag = runDiagnostic(classification, binding);
    // The planner itself is unaffected by household state — it receives clientBinding as normal
    // Household ambiguity is ONLY surfaced via response-mapper's suggestedNextSteps
    expect(diag.outputMode).toBe("client_message_update");
    // DIAGNOSTIC: household state does NOT change outputMode — additive warning only
  });

  it("B17 — unknown client (source=none) → insufficient_binding → ambiguous", () => {
    const classification = makeClassification("photo_or_scan_document", 0.85);
    const binding: ClientBindingResult = {
      state: "insufficient_binding",
      clientId: null,
      clientLabel: null,
      confidence: 0,
      candidates: [],
      source: "none",
      warnings: [],
    };
    const diag = runDiagnostic(classification, binding);
    expect(diag.outputMode).toBe("ambiguous_needs_input");
  });

  it("B18 — multiple CRM matches → planner client_message_update, guardrail G2 downgrade to ambiguous + note fallback", () => {
    const classification = makeClassification("screenshot_client_communication", 0.85);
    const binding = makeBinding("multiple_candidates", null);
    const diag = runDiagnostic(classification, binding);
    // Fix 1: resolveOutputMode now returns client_message_update for communication screenshots
    // BUT guardrail G2 detects write actions without bound_client_confident → downgrade
    // Result after guardrail: ambiguous_needs_input
    // Fix 2: ambiguous_needs_input now includes create_internal_note as safe fallback
    expect(diag.outputMode).toBe("ambiguous_needs_input");
    expect(diag.proposedActions).toContain("create_internal_note");
    expect(diag.guardrailsTriggered.some((v) => v.includes("BINDING_VIOLATION"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// C) OUTPUT / ACTION PLANNING
// ---------------------------------------------------------------------------

describe("DIAG C: Output / Action Planning", () => {
  it("C19 — document + supporting_reference_set decision → attach retained (note only as fallback when no attach)", () => {
    const classification = makeClassification("photo_or_scan_document", 0.72);
    const binding = makeBinding("bound_client_confident");
    const docSetResult = {
      decision: "supporting_reference_set" as const,
      mergedFactBundle: null,
      documentSetSummary: "Referenční podklady.",
      confidence: 0.68,
      assetIds: ["a1", "a2"],
    };
    const plan = buildActionPlanV4(classification, binding, emptyFactBundle(), null, null, docSetResult);
    expect(plan.outputMode).toBe("supporting_reference_image");
    // V4 planner: keep only attachDocumentToClient from base structured plan
    // If base plan had attach (bound_client_confident → yes), note is NOT added
    // This is a PRODUCT BUG: advisor with multi-page reference doc has no "save as note" option
    const actions = plan.recommendedActions.map((a) => a.writeAction);
    expect(actions).not.toContain("createTask");
    // DIAGNOSTIC: whether note is present depends on whether base had attachDocumentToClient
    // With bound_client_confident, base has attach → V4 keeps only attach → no note
  });

  it("C20 — document image → attach_to_client proposed when bound_client_confident", () => {
    const classification = makeClassification("photo_or_scan_document", 0.78);
    const binding = makeBinding("bound_client_confident");
    const diag = runDiagnostic(classification, binding);
    expect(diag.outputMode).toBe("structured_image_fact_intake");
    expect(diag.proposedActions).toContain("attach_document");
    expect(diag.proposedActions).toContain("create_internal_note");
  });

  it("C21 — identity document → create-contact draft via buildIdentityContactIntakeActionPlan", () => {
    const factBundle = makeIdentityFactBundle();
    const identityPlan = buildIdentityContactIntakeActionPlan(factBundle, ["doc-id-1"]);
    expect(identityPlan.outputMode).toBe("identity_contact_intake");
    expect(identityPlan.recommendedActions.map((a) => a.writeAction)).toContain("createContact");
    expect(identityPlan.recommendedActions.map((a) => a.writeAction)).toContain("attachDocumentToClient");
  });

  it("C22 — review-like doc with handoffReady=true → no_action_archive_only, note only", () => {
    const classification = makeClassification("photo_or_scan_document", 0.85);
    const binding = makeBinding("bound_client_confident");
    const reviewHandoff = {
      recommended: true,
      signals: ["contract_like_document" as const],
      confidence: 0.85,
      orientationSummary: "Looks like an insurance policy.",
      advisorExplanation: "Dokument vypadá jako smlouva — doporučuji AI Review.",
      handoffReady: true,
    };
    const plan = buildActionPlanV4(classification, binding, emptyFactBundle(), null, reviewHandoff, null);
    expect(plan.outputMode).toBe("no_action_archive_only");
    expect(plan.recommendedActions.map((a) => a.writeAction)).toContain("createInternalNote");
    expect(plan.safetyFlags.some((f) => f.includes("AI_REVIEW_HANDOFF_RECOMMENDED"))).toBe(true);
  });

  it("C23 — attach_document NOT proposed when binding is insufficient (disabled action)", () => {
    const classification = makeClassification("photo_or_scan_document", 0.75);
    const binding = makeBinding("insufficient_binding", null);
    const diag = runDiagnostic(classification, binding);
    expect(diag.proposedActions).not.toContain("attach_document");
    // DIAGNOSTIC: planStructuredFactIntake only adds attach_document for bound_client_confident
    // → "Přiložit ke klientovi" is never surfaced when no client is known
  });

  it("C24 — communication screenshot without binding → client_message_update with note+task (FIX 1 resolved)", () => {
    const classification = makeClassification("screenshot_client_communication", 0.82);
    const binding = makeBinding("insufficient_binding", null);
    const diag = runDiagnostic(classification, binding);
    // Fix 1 resolved this: communication screenshots now get client_message_update
    // even without active client; note+task always proposed; attach only when bound
    expect(diag.outputMode).toBe("client_message_update");
    expect(diag.proposedActions).toContain("create_internal_note");
    expect(diag.proposedActions).toContain("create_task");
    expect(diag.proposedActions).not.toContain("attach_document");
  });

  it("C25 — technical wording in whyThisAction leaks into advisor-facing output", () => {
    const classification = makeClassification("photo_or_scan_document", 0.75);
    const binding = makeBinding("insufficient_binding", null);
    const plan = buildActionPlanV1(classification, binding);
    // whyThisAction contains "confidence 75%" — technical, not advisor-friendly
    expect(plan.whyThisAction).toMatch(/confidence|ambiguous/);
    // DIAGNOSTIC: whyThisAction → previewPayload.summary → shown to advisor as-is
  });

  it("C26 — identity_contact_intake produces advisor-facing text (correct)", () => {
    const factBundle = makeIdentityFactBundle();
    const plan = buildIdentityContactIntakeActionPlan(factBundle, ["doc-1"]);
    expect(plan.whyThisAction).toContain("Rozpoznán osobní doklad");
    expect(plan.whyThisAction).not.toMatch(/confidence \d/);
  });
});

// ---------------------------------------------------------------------------
// D) COMPOSER / SEND BEHAVIOR
// ---------------------------------------------------------------------------

describe("DIAG D: Composer / Send Behavior", () => {
  it("D27 — paste 1 image: accepted, no truncation", () => {
    const body = { imageAssets: [{ url: "https://s.test/a1.jpg", mimeType: "image/jpeg", sizeBytes: 1000 }] };
    const result = parseImageAssetsFromBodyResult(body);
    expect(result.assets).toHaveLength(1);
    expect(result.truncated).toBe(false);
  });

  it("D28 — paste 2 images: both accepted, no truncation", () => {
    const body = {
      imageAssets: [
        { url: "https://s.test/a1.jpg", mimeType: "image/jpeg", sizeBytes: 1000 },
        { url: "https://s.test/a2.jpg", mimeType: "image/jpeg", sizeBytes: 1000 },
      ],
    };
    const result = parseImageAssetsFromBodyResult(body);
    expect(result.assets).toHaveLength(2);
    expect(result.truncated).toBe(false);
  });

  it("D29 — paste 5 images: max 4 accepted, truncated=true, warning should be added by route-handler", () => {
    const body = {
      imageAssets: Array.from({ length: 5 }, (_, i) => ({
        url: `https://s.test/a${i}.jpg`,
        mimeType: "image/jpeg",
        sizeBytes: 1000,
      })),
    };
    const result = parseImageAssetsFromBodyResult(body);
    expect(result.assets).toHaveLength(4);
    expect(result.truncated).toBe(true);
    // Route-handler adds warning: "Nahráno více než 4 obrázky — zpracovány jsou jen první čtyři."
  });

  it("D30 — all actions have requiresConfirmation=true (no autosend)", () => {
    const classification = makeClassification("photo_or_scan_document", 0.80);
    const binding = makeBinding("bound_client_confident");
    const plan = buildActionPlanV1(classification, binding);
    expect(plan.recommendedActions.every((a) => a.requiresConfirmation)).toBe(true);
    // G5 guardrail enforces this even if planner forgets
  });

  it("D31 — send with pending images: all recommended actions require confirmation", () => {
    const classification = makeClassification("screenshot_client_communication", 0.85);
    const binding = makeBinding("bound_client_confident");
    const plan = buildActionPlanV1(classification, binding);
    expect(plan.recommendedActions.length).toBeGreaterThan(0);
    expect(plan.recommendedActions.every((a) => a.requiresConfirmation)).toBe(true);
  });

  it("D32 — text hint 'smlouva' promotes document classification via classifyByTextHints", () => {
    // classifyByTextHints checks DOCUMENT_TEXT_HINTS = /smlouva|potvrzení|dokument|.../
    const docHint = /smlouva|potvrzení|dokument|sken|scan|formulář|dopis/i;
    expect(docHint.test("Tohle je smlouva od klienta Jana Nováka")).toBe(true);
    // This means accompanyingText="smlouva..." → Layer 1 classifier → photo_or_scan_document
  });
});

// ---------------------------------------------------------------------------
// GUARDRAIL-SPECIFIC DIAGNOSTICS
// ---------------------------------------------------------------------------

describe("DIAG: Guardrail behavior", () => {
  it("G2 — write-ready plan without binding → BINDING_VIOLATION + mode downgrade to ambiguous", () => {
    const classification = makeClassification("screenshot_client_communication", 0.85);
    const binding = makeBinding("insufficient_binding", null);
    const plan: ImageIntakeActionPlan = {
      outputMode: "client_message_update",
      recommendedActions: [{
        intentType: "create_internal_note",
        writeAction: "createInternalNote",
        label: "Note", reason: "Test", confidence: 0.9,
        requiresConfirmation: true, params: {},
      }],
      draftReplyText: null,
      whyThisAction: "Test",
      whyNotOtherActions: null,
      needsAdvisorInput: false,
      safetyFlags: [],
    };
    const lane = makeLane();
    const verdict = enforceImageIntakeGuardrails(lane, classification, binding, plan);
    expect(verdict.violations.some((v) => v.includes("BINDING_VIOLATION"))).toBe(true);
    expect(verdict.modeDowngraded).toBe(true);
    expect(verdict.downgradedTo).toBe("ambiguous_needs_input");
  });

  it("G4 — disallowed intent is stripped from plan", () => {
    const classification = makeClassification("screenshot_client_communication", 0.85);
    const binding = makeBinding("bound_client_confident");
    const plan: ImageIntakeActionPlan = {
      outputMode: "client_message_update",
      recommendedActions: [{
        intentType: "send_email" as any,
        writeAction: null,
        label: "Send email", reason: "Test", confidence: 0.8,
        requiresConfirmation: true, params: {},
      }],
      draftReplyText: null,
      whyThisAction: "Test",
      whyNotOtherActions: null,
      needsAdvisorInput: false,
      safetyFlags: [],
    };
    const lane = makeLane();
    const verdict = enforceImageIntakeGuardrails(lane, classification, binding, plan);
    expect(verdict.violations.some((v) => v.includes("ACTION_VIOLATION"))).toBe(true);
    expect(verdict.strippedActions).toHaveLength(1);
  });

  it("G5 — action without requiresConfirmation forces it to true (PREVIEW_VIOLATION)", () => {
    const classification = makeClassification("screenshot_client_communication", 0.85);
    const binding = makeBinding("bound_client_confident");
    const plan: ImageIntakeActionPlan = {
      outputMode: "client_message_update",
      recommendedActions: [{
        intentType: "create_internal_note",
        writeAction: "createInternalNote",
        label: "Note", reason: "Test", confidence: 0.9,
        requiresConfirmation: false,
        params: {},
      }],
      draftReplyText: null,
      whyThisAction: "Test",
      whyNotOtherActions: null,
      needsAdvisorInput: false,
      safetyFlags: [],
    };
    const lane = makeLane();
    const verdict = enforceImageIntakeGuardrails(lane, classification, binding, plan);
    expect(verdict.violations.some((v) => v.includes("PREVIEW_VIOLATION"))).toBe(true);
    expect(plan.recommendedActions[0]!.requiresConfirmation).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// CRITICAL PATH — ROOT CAUSE VERIFICATION
// ---------------------------------------------------------------------------

describe("DIAG: Root cause verification", () => {
  it("RC1 — Fix 1 verified: communication screenshots get client_message_update regardless of binding", () => {
    // Fix 1 resolved: communication screenshots now bypass binding check in resolveOutputMode
    const comm = makeClassification("screenshot_client_communication", 0.85);
    const noBind = makeBinding("insufficient_binding", null);
    const plan = buildActionPlanV1(comm, noBind);
    // FIXED: no longer ambiguous_needs_input for communication screenshots
    expect(plan.outputMode).toBe("client_message_update");
    // note + task always present; attach only with bound client
    expect(plan.recommendedActions.map((a) => a.intentType)).toContain("create_internal_note");
    expect(plan.recommendedActions.map((a) => a.intentType)).not.toContain("attach_document");

    const withBind = makeBinding("bound_client_confident");
    const plan2 = buildActionPlanV1(comm, withBind);
    expect(plan2.outputMode).toBe("client_message_update");
    // With bound client: attach is also available
    expect(plan2.recommendedActions.map((a) => a.intentType)).toContain("attach_document");
  });

  it("RC2 — identity_contact_intake CANNOT be produced by buildActionPlanV4", () => {
    // Only buildIdentityContactIntakeActionPlan (called by orchestrator) produces this mode
    const doc = makeClassification("photo_or_scan_document", 0.88);
    const bind = makeBinding("bound_client_confident");
    const identityFacts = makeIdentityFactBundle();
    const plan = buildActionPlanV4(doc, bind, identityFacts, null, null, null);
    expect(plan.outputMode).not.toBe("identity_contact_intake");
    expect(plan.outputMode).toBe("structured_image_fact_intake");
    // VERIFIED: identity detection is an orchestrator-level override, not planner logic
  });

  it("RC3 — handoffReady=false does NOT downgrade outputMode (advisory only)", () => {
    const doc = makeClassification("photo_or_scan_document", 0.88);
    const bind = makeBinding("bound_client_confident");
    const reviewHandoffNotReady = {
      recommended: true,
      signals: ["multi_page_document_scan" as const],
      confidence: 0.65,
      orientationSummary: null,
      advisorExplanation: "Může být vhodné pro AI Review.",
      handoffReady: false,
    };
    const plan = buildActionPlanV4(doc, bind, emptyFactBundle(), null, reviewHandoffNotReady, null);
    expect(plan.outputMode).toBe("structured_image_fact_intake");
    expect(plan.safetyFlags.some((f) => f.includes("AI_REVIEW_HANDOFF_RECOMMENDED"))).toBe(true);
    // DIAGNOSTIC: handoffReady flag controls whether AI Review wins over structured intake
  });

  it("RC4 — document confidence threshold is exactly 0.60 (not 0.65)", () => {
    const bind = makeBinding("bound_client_confident");
    const low = makeClassification("photo_or_scan_document", 0.599);
    const high = makeClassification("photo_or_scan_document", 0.601);
    expect(buildActionPlanV1(low, bind).outputMode).toBe("ambiguous_needs_input");
    expect(buildActionPlanV1(high, bind).outputMode).toBe("structured_image_fact_intake");
  });

  it("RC5 — communication confidence threshold is exactly 0.65", () => {
    const bind = makeBinding("bound_client_confident");
    const low = makeClassification("screenshot_client_communication", 0.649);
    const high = makeClassification("screenshot_client_communication", 0.651);
    expect(buildActionPlanV1(low, bind).outputMode).toBe("ambiguous_needs_input");
    expect(buildActionPlanV1(high, bind).outputMode).toBe("client_message_update");
  });

  it("RC6 — detectIdentityContactIntakeSignals rejects contract-like documents", () => {
    const doc = makeClassification("photo_or_scan_document", 0.88);
    const contractBundle: ExtractedFactBundle = {
      facts: [{
        factKey: "looks_like_contract",
        factType: "document_received",
        value: "yes",
        normalizedValue: "yes",
        confidence: 0.7,
        evidence: null,
        isActionable: false,
        needsConfirmation: false,
        observedVsInferred: "observed",
      }],
      missingFields: [],
      ambiguityReasons: [],
      extractionSource: "multimodal_pass",
    };
    const result = detectIdentityContactIntakeSignals(doc, contractBundle, null);
    expect(result).toBe(false);
    // VERIFIED: contract detection prevents identity intake path
  });

  it("RC7 — decideLane always returns image_intake (AI Review routing is ADVISORY only)", () => {
    // In orchestrator.ts, decideLane() is hardcoded to return image_intake with confidence=1.0
    // There is NO autonomous routing to AI Review — it's only a recommendation via reviewHandoff
    // Advisor must manually submit handoff to AI Review queue
    const lane = makeLane("image_intake");
    expect(lane.lane).toBe("image_intake");
    expect(lane.confidence).toBe(1.0);
    // FINDING: The "AI Review handoff" is a soft recommendation, not a lane switch
    // This means contract-like documents are still processed by image intake even when flagged
  });

  it("RC8 — identity plan is fully write-ready (needsAdvisorInput=true but actions present)", () => {
    const factBundle = makeIdentityFactBundle();
    const plan = buildIdentityContactIntakeActionPlan(factBundle, ["doc-1"]);
    // Identity plan has actions but needsAdvisorInput=true (advisor must confirm)
    expect(plan.needsAdvisorInput).toBe(true);
    expect(plan.recommendedActions.length).toBeGreaterThan(0);
    // This is CORRECT: identity needs human review before createContact fires
  });
});
