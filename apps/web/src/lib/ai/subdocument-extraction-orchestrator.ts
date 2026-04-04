/**
 * Per-Subdocument Extraction Orchestrator
 *
 * Runs AFTER the primary extraction pipeline and canonical normalization.
 * Handles multi-section bundle documents by running targeted extraction passes
 * for specific section types (health questionnaire, AML/FATCA, modelation).
 *
 * Design:
 * - Additive only — never replaces primary extraction results, only enriches them.
 * - Health questionnaire: targeted LLM call (only when detected, confidence >= 0.4).
 * - AML/FATCA: heuristic detection only — no extra LLM call.
 * - Modelation lifecycle correction: heuristic patching based on primary subdoc type.
 * - Payment section: heuristic check + patch if missing from primary extraction.
 *
 * First iteration scope:
 * - Per-section LLM extraction for health questionnaires ✓
 * - Heuristic lifecycle patching for modelation ✓
 * - Heuristic publishHints correction for AML/mixed bundles ✓
 * - Merge layer into canonical envelope ✓
 * - Full page-level section text isolation: NOT YET (future iteration)
 */

import { createResponseStructured } from "@/lib/openai";
import type { DocumentReviewEnvelope } from "./document-review-types";
import type {
  PacketMeta,
  PacketSubdocumentCandidate,
  HealthQuestionnaireRecord,
  PublishHints,
} from "./document-packet-types";
import {
  buildHealthSectionExtractionPrompt,
  HEALTH_SECTION_EXTRACTION_SCHEMA,
  type HealthSectionExtractionOutput,
} from "./subdocument-section-prompts";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SubdocumentSectionOutcome =
  | { type: "health_questionnaire"; result: HealthSectionExtractionOutput; confidence: number }
  | { type: "aml_fatca_heuristic"; detected: boolean; pepFlag: boolean | null; confidence: number }
  | { type: "modelation_lifecycle_patch"; previousLifecycle: string | null | undefined; patched: boolean }
  | { type: "payment_section_detected"; confidence: number }
  | { type: "skipped"; reason: string };

export type SubdocumentOrchestrationResult = {
  /** Whether orchestration actually ran (false = early-exit). */
  orchestrationRan: boolean;
  /** Per-section outcomes for tracing. */
  sectionOutcomes: SubdocumentSectionOutcome[];
  /** Number of canonical field mutations applied to the envelope. */
  mutationCount: number;
  /** Non-fatal warnings raised during orchestration. */
  warnings: string[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function candidatesByType(
  candidates: PacketSubdocumentCandidate[],
  type: PacketSubdocumentCandidate["type"],
  minConfidence = 0.35,
): PacketSubdocumentCandidate[] {
  return candidates.filter((c) => c.type === type && c.confidence >= minConfidence);
}

function hasPublishableSection(candidates: PacketSubdocumentCandidate[]): boolean {
  return candidates.some(
    (c) =>
      c.publishable &&
      c.confidence >= 0.35 &&
      (c.type === "final_contract" || c.type === "contract_proposal"),
  );
}

function strengthenPublishHints(
  existing: PublishHints | null | undefined,
  patch: Partial<PublishHints>,
): PublishHints {
  const base: PublishHints = existing ?? {
    contractPublishable: true,
    reviewOnly: false,
    needsSplit: false,
    needsManualValidation: false,
    sensitiveAttachmentOnly: false,
    reasons: [],
  };
  return {
    contractPublishable: patch.contractPublishable === false ? false : base.contractPublishable,
    reviewOnly: patch.reviewOnly === true ? true : base.reviewOnly,
    needsSplit: patch.needsSplit === true ? true : base.needsSplit,
    needsManualValidation: patch.needsManualValidation === true ? true : base.needsManualValidation,
    sensitiveAttachmentOnly:
      patch.sensitiveAttachmentOnly === true ? true : base.sensitiveAttachmentOnly,
    reasons: [
      ...(base.reasons ?? []),
      ...(patch.reasons ?? []),
    ],
  };
}

// ─── Health questionnaire extraction pass ────────────────────────────────────

async function runHealthSectionExtractionPass(
  markdownText: string,
  candidates: PacketSubdocumentCandidate[],
  envelope: DocumentReviewEnvelope,
  warnings: string[],
): Promise<SubdocumentSectionOutcome> {
  const healthCandidates = candidatesByType(candidates, "health_questionnaire", 0.4);
  if (healthCandidates.length === 0) {
    return { type: "skipped", reason: "no_health_candidates_above_threshold" };
  }

  const confidence = Math.max(...healthCandidates.map((c) => c.confidence));

  try {
    const prompt = buildHealthSectionExtractionPrompt(markdownText, candidates);
    const response = await createResponseStructured<HealthSectionExtractionOutput>(
      prompt,
      HEALTH_SECTION_EXTRACTION_SCHEMA,
      {
        routing: { category: "ai_review" },
        schemaName: "health_section_extraction",
      },
    );

    const output = response.parsed as HealthSectionExtractionOutput | null;
    if (!output || !output.healthSectionPresent) {
      return { type: "health_questionnaire", result: { healthSectionPresent: false, questionnaireEntries: [] }, confidence };
    }

    // Merge into envelope.healthQuestionnaires — additive
    const mergedEntries: HealthQuestionnaireRecord[] = Array.isArray(envelope.healthQuestionnaires)
      ? [...envelope.healthQuestionnaires]
      : [];

    for (const entry of output.questionnaireEntries ?? []) {
      if (!entry.questionnairePresent) continue;
      // Avoid duplicate entries for the same participant
      const alreadyPresent = mergedEntries.some(
        (e) =>
          e.linkedParticipantName &&
          entry.participantName &&
          e.linkedParticipantName.trim().toLowerCase() === entry.participantName.trim().toLowerCase(),
      );
      if (!alreadyPresent) {
        mergedEntries.push({
          linkedParticipantName: entry.participantName ?? null,
          questionnairePresent: true,
          sectionSummary: entry.sectionSummary ?? null,
          medicallyRelevantFlags: entry.medicallyRelevantFlags ?? [],
          publishableAsSeparateDocument: false,
        });
      }
    }

    // If no entries from LLM but section is present, add a generic entry
    if (mergedEntries.length === 0 && output.healthSectionPresent) {
      mergedEntries.push({
        linkedParticipantName: null,
        questionnairePresent: true,
        sectionSummary: "Zdravotní dotazník detekován v bundlu.",
        medicallyRelevantFlags: [],
        publishableAsSeparateDocument: false,
      });
    }

    // Patch envelope
    envelope.healthQuestionnaires = mergedEntries.length > 0 ? mergedEntries : null;

    return { type: "health_questionnaire", result: output, confidence };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    warnings.push(`health_section_extraction_failed: ${msg.slice(0, 100)}`);
    return { type: "skipped", reason: `health_extraction_error: ${msg.slice(0, 50)}` };
  }
}

// ─── AML / FATCA heuristic detection ─────────────────────────────────────────

function runAmlHeuristicDetection(
  candidates: PacketSubdocumentCandidate[],
  envelope: DocumentReviewEnvelope,
): SubdocumentSectionOutcome {
  const amlCandidates = candidatesByType(candidates, "aml_fatca_form", 0.35);
  if (amlCandidates.length === 0) {
    return { type: "skipped", reason: "no_aml_candidates" };
  }

  const confidence = Math.max(...amlCandidates.map((c) => c.confidence));
  const hasPublishable = hasPublishableSection(candidates);

  // Add warning if not already present
  if (!Array.isArray(envelope.reviewWarnings)) {
    envelope.reviewWarnings = [];
  }
  const alreadyWarned = envelope.reviewWarnings.some((w) => w.code === "aml_fatca_section_detected");
  if (!alreadyWarned) {
    envelope.reviewWarnings.push({
      code: "aml_fatca_section_detected",
      message:
        "Dokument obsahuje AML/FATCA formulář. Tato sekce nesmí být publikována jako smlouva.",
      severity: "warning",
    });
  }

  // Strengthen publishHints
  const onlyAml = !hasPublishable && amlCandidates.length > 0;
  envelope.publishHints = strengthenPublishHints(envelope.publishHints, {
    contractPublishable: onlyAml ? false : undefined,
    sensitiveAttachmentOnly: onlyAml,
    needsSplit: hasPublishable,
    needsManualValidation: true,
    reasons: onlyAml
      ? ["aml_fatca_section_only_no_publishable_contract"]
      : ["aml_fatca_section_present_bundle"],
  });

  return { type: "aml_fatca_heuristic", detected: true, pepFlag: null, confidence };
}

// ─── Modelation lifecycle correction ─────────────────────────────────────────

function runModelationLifecycleCorrection(
  packetMeta: PacketMeta,
  envelope: DocumentReviewEnvelope,
): SubdocumentSectionOutcome {
  const prevLifecycle = envelope.documentClassification?.lifecycleStatus;

  if (!packetMeta.primarySubdocumentType) {
    return { type: "skipped", reason: "no_primary_subdocument_type" };
  }

  const MODELATION_TYPES = new Set(["modelation", "contract_proposal"]);
  const isPrimaryModelation = MODELATION_TYPES.has(packetMeta.primarySubdocumentType);
  const FINAL_TYPES = new Set(["final_contract"]);
  const isPrimaryFinal = FINAL_TYPES.has(packetMeta.primarySubdocumentType);

  if (isPrimaryModelation) {
    // Correct lifecycle to modelation if LLM mis-classified
    if (
      prevLifecycle &&
      prevLifecycle !== "modelation" &&
      prevLifecycle !== "proposal" &&
      prevLifecycle !== "offer"
    ) {
      if (envelope.documentClassification) {
        envelope.documentClassification.lifecycleStatus = "modelation";
      }
      // Modelation is never publishable
      envelope.publishHints = strengthenPublishHints(envelope.publishHints, {
        contractPublishable: false,
        reviewOnly: true,
        reasons: ["primary_subdocument_is_modelation"],
      });
      return {
        type: "modelation_lifecycle_patch",
        previousLifecycle: prevLifecycle,
        patched: true,
      };
    }
    // Lifecycle already correct — just ensure publishHints are correct
    envelope.publishHints = strengthenPublishHints(envelope.publishHints, {
      contractPublishable: false,
      reviewOnly: true,
      reasons: ["primary_subdocument_is_modelation"],
    });
    return {
      type: "modelation_lifecycle_patch",
      previousLifecycle: prevLifecycle,
      patched: false,
    };
  }

  if (isPrimaryFinal) {
    // If LLM returned modelation lifecycle but packet says final_contract, correct it
    if (prevLifecycle === "modelation" || prevLifecycle === "proposal") {
      if (envelope.documentClassification) {
        envelope.documentClassification.lifecycleStatus = "final_contract";
      }
      return {
        type: "modelation_lifecycle_patch",
        previousLifecycle: prevLifecycle,
        patched: true,
      };
    }
  }

  return { type: "skipped", reason: "lifecycle_correction_not_needed" };
}

// ─── Payment section detection ────────────────────────────────────────────────

function runPaymentSectionDetection(
  candidates: PacketSubdocumentCandidate[],
  envelope: DocumentReviewEnvelope,
): SubdocumentSectionOutcome {
  const paymentCandidates = candidatesByType(candidates, "payment_instruction", 0.4);
  if (paymentCandidates.length === 0) {
    return { type: "skipped", reason: "no_payment_section_candidates" };
  }

  const confidence = Math.max(...paymentCandidates.map((c) => c.confidence));
  const hasPublishable = hasPublishableSection(candidates);

  if (!hasPublishable) {
    // Payment instruction only — mark accordingly
    envelope.publishHints = strengthenPublishHints(envelope.publishHints, {
      contractPublishable: false,
      reviewOnly: true,
      sensitiveAttachmentOnly: true,
      reasons: ["payment_instruction_only_no_contract"],
    });
  } else {
    // Mixed bundle: payment instructions + contract
    if (!Array.isArray(envelope.reviewWarnings)) envelope.reviewWarnings = [];
    const warned = envelope.reviewWarnings.some(
      (w) => w.code === "payment_instruction_in_bundle",
    );
    if (!warned) {
      envelope.reviewWarnings.push({
        code: "payment_instruction_in_bundle",
        message:
          "Bundle obsahuje platební instrukce jako samostatnou sekci. Ověřte před apply.",
        severity: "info",
      });
    }
    envelope.publishHints = strengthenPublishHints(envelope.publishHints, {
      needsManualValidation: true,
      reasons: ["payment_instruction_present_in_bundle"],
    });
  }

  return { type: "payment_section_detected", confidence };
}

// ─── Merge mutation count helper ─────────────────────────────────────────────

function countMutations(outcomes: SubdocumentSectionOutcome[]): number {
  return outcomes.filter((o) => o.type !== "skipped").length;
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

/**
 * Orchestrate per-subdocument extraction for a bundle document.
 *
 * Call this AFTER `applyCanonicalNormalizationToEnvelope` with the full
 * markdown text, the computed packetMeta, and the primary envelope (mutated in-place).
 *
 * Only runs when:
 * - `packetMeta.isBundle === true`
 * - `markdownText` has meaningful content (>= 200 chars)
 * - At least one candidate is present
 *
 * The function mutates `envelope` in-place (additive only) and returns
 * a detailed outcome for tracing.
 */
export async function orchestrateSubdocumentExtraction(
  markdownText: string,
  packetMeta: PacketMeta,
  envelope: DocumentReviewEnvelope,
): Promise<SubdocumentOrchestrationResult> {
  const warnings: string[] = [];

  // Early exit conditions
  if (!packetMeta.isBundle) {
    return { orchestrationRan: false, sectionOutcomes: [], mutationCount: 0, warnings };
  }
  if (markdownText.length < 200) {
    return { orchestrationRan: false, sectionOutcomes: [], mutationCount: 0, warnings };
  }
  const candidates = packetMeta.subdocumentCandidates ?? [];
  if (candidates.length === 0) {
    return { orchestrationRan: false, sectionOutcomes: [], mutationCount: 0, warnings };
  }

  const outcomes: SubdocumentSectionOutcome[] = [];

  // 1. Modelation lifecycle correction (synchronous, cheap)
  const modelationOutcome = runModelationLifecycleCorrection(packetMeta, envelope);
  outcomes.push(modelationOutcome);

  // 2. AML/FATCA heuristic detection (synchronous, cheap)
  const amlOutcome = runAmlHeuristicDetection(candidates, envelope);
  outcomes.push(amlOutcome);

  // 3. Payment section detection (synchronous, cheap)
  const paymentOutcome = runPaymentSectionDetection(candidates, envelope);
  outcomes.push(paymentOutcome);

  // 4. Health questionnaire targeted extraction (async LLM call — only when detected)
  const healthOutcome = await runHealthSectionExtractionPass(
    markdownText,
    candidates,
    envelope,
    warnings,
  );
  outcomes.push(healthOutcome);

  // 5. Ensure envelope.packetMeta is up-to-date (may have been partially applied earlier)
  envelope.packetMeta = packetMeta;

  return {
    orchestrationRan: true,
    sectionOutcomes: outcomes,
    mutationCount: countMutations(outcomes),
    warnings,
  };
}

/**
 * Derive extraction route label from primary subdocument type.
 * Used for trace logging.
 */
export function describeSubdocumentExtractionRoute(packetMeta: PacketMeta): string {
  if (!packetMeta.isBundle) return "single_document";
  const primary = packetMeta.primarySubdocumentType;
  const sections = packetMeta.subdocumentCandidates.map((c) => c.type).join("+");
  return `bundle[${primary ?? "unknown"}]:${sections}`;
}
