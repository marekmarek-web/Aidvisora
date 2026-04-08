/**
 * AI Photo / Image Intake — maps ImageIntakeOrchestratorResult to AssistantResponse.
 *
 * Phase 3 enhancements:
 * - richer message with extracted facts summary
 * - draft reply preview attached to suggestedActions
 * - missing fields / ambiguity reasons surfaced in warnings
 * - multimodal flag state in sourcesSummary
 *
 * Reuses the existing AssistantResponse type — no frontend changes needed.
 */

import type { AssistantResponse } from "../assistant-tool-router";
import type { ActionPayload } from "../action-catalog";
import type { ImageIntakeOrchestratorResult } from "./orchestrator";
import { buildFactsSummaryLines } from "./extractor";
import { buildStitchingSummary } from "./stitching";
import { buildThreadSummaryLines } from "./thread-reconstruction";
import { buildHandoffPreviewNote } from "./handoff-payload";
import { buildIntentChangeSummary } from "./intent-change-detection";
import { buildContactNewPrefillQuery, mapFactBundleToCreateContactDraft } from "./identity-contact-intake";

// ---------------------------------------------------------------------------
// Message templates by output mode
// ---------------------------------------------------------------------------

function buildIntakeMessage(result: ImageIntakeOrchestratorResult): string {
  const { response } = result;
  const mode = response.actionPlan.outputMode;
  const inputType = response.classification?.inputType;
  const clientLabel = response.clientBinding.clientLabel;
  const binding = response.clientBinding.state;

  switch (mode) {
    case "identity_contact_intake": {
      const draft = mapFactBundleToCreateContactDraft(result.response.factBundle);
      const p = draft.params;
      const pre: string[] = [];
      const push = (label: string, v: string | undefined) => {
        const t = v?.trim();
        if (t) pre.push(`${label}: ${t}`);
      };
      push("Jméno", p.firstName);
      push("Příjmení", p.lastName);
      push("Datum narození", p.birthDate);
      const addrParts = [p.street, p.city, p.zip].filter((x) => x?.trim());
      if (addrParts.length) pre.push(`Adresa: ${addrParts.join(", ")}`);
      push("E-mail", p.email);
      push("Telefon", p.phone);
      push("Titul", p.title);
      const preBlock = pre.length
        ? pre.join("\n")
        : "Žádné spolehlivé údaje nebyly z dokladu přečteny — vyplňte ručně v náhledu kroků.";

      const need: string[] = [];
      for (const line of draft.missingAdvisorLines) {
        need.push(`${line} — doplněte podle potřeby`);
      }
      if (!p.email?.trim()) need.push("E-mail — na dokladu často chybí nebo není čitelný");
      if (!p.phone?.trim()) need.push("Telefon — na dokladu často chybí nebo není čitelný");
      for (const line of draft.needsConfirmationLines) need.push(line);

      const needBlock = need.length
        ? need.slice(0, 10).join("\n")
        : "Údaje prosím před uložením ještě jednou zkontrolujte v náhledu kroků.";

      return [
        "Připravil jsem návrh nového klienta z nahraných dokladů.",
        "",
        "Předvyplněné údaje",
        preBlock,
        "",
        "Je potřeba doplnit nebo potvrdit",
        needBlock,
        "",
        "Další krok",
        "Ověřte údaje a pokračujte potvrzením plánu nebo tlačítkem pro úpravu ve formuláři.",
      ].join("\n");
    }

    case "no_action_archive_only": {
      // Check for review handoff recommendation
      const handoff = result.reviewHandoff;
      if (handoff?.recommended) {
        return `Obrázek vypadá jako kandidát na AI Review: ${handoff.advisorExplanation.slice(0, 200)} Image intake zpracovala jen orientační přehled.`;
      }
      return "Na obrázku jsem nenašel použitelné CRM informace. Obrázek lze archivovat, ale navrhovat žádnou CRM akci nemám.";
    }

    case "ambiguous_needs_input": {
      const bindingIssue =
        binding === "insufficient_binding"
          ? " Nepodařilo se mi bezpečně identifikovat klienta."
          : binding === "multiple_candidates"
            ? " Existuje více možných klientů — potřebuji upřesnění."
            : "";
      const classIssue =
        !inputType || inputType === "mixed_or_uncertain_image"
          ? " Typ vstupu není jednoznačný."
          : "";
      return `Obrázek jsem přijal, ale potřebuji doplnění.${bindingIssue}${classIssue} Vyberte klienta nebo upřesněte záměr.`;
    }

    case "supporting_reference_image":
      return clientLabel
        ? `Obrázek vypadá jako referenční podklad — navrhuji přiložit ke klientovi **${clientLabel}** nebo archivovat.`
        : "Obrázek vypadá jako referenční podklad. Navrhuji přiložit ke klientovi nebo archivovat.";

    case "client_message_update": {
      const client = clientLabel ? ` od klienta **${clientLabel}**` : "";
      const factLines = buildFactsSummaryLines(result.response.factBundle, 3);
      const factText = factLines.length > 0 ? `\n\nExtrahovaná fakta:\n${factLines.map((l) => `• ${l}`).join("\n")}` : "";
      const draftNote = result.response.actionPlan.draftReplyText
        ? "\n\n_Draft odpovědi je připraven k revizi (preview-only — nic nebylo odesláno)._"
        : "";
      return `Rozpoznal jsem screenshot klientské komunikace${client}. Navrhuji zaznamenat obsah a případně vytvořit úkol nebo poznámku.${factText}${draftNote}`;
    }

    case "structured_image_fact_intake": {
      const client = clientLabel ? ` ke klientovi **${clientLabel}**` : "";
      const typeLabel = inputType === "screenshot_payment_details"
        ? "platební screenshotem"
        : inputType === "screenshot_bank_or_finance_info"
          ? "bankovním screenshotem"
          : "dokumentem";
      const factLines = buildFactsSummaryLines(result.response.factBundle, 4);
      const factText = factLines.length > 0 ? `\n\nExtrahovaná fakta:\n${factLines.map((l) => `• ${l}`).join("\n")}` : "";
      const missing = result.response.factBundle.missingFields.length > 0
        ? `\n\nChybějící údaje: ${result.response.factBundle.missingFields.slice(0, 3).join(", ")}.`
        : "";
      return `Rozpoznal jsem obrázek s ${typeLabel}. Navrhuji uložit klíčové informace${client}.${factText}${missing}`;
    }

    default:
      return "Obrázek byl zpracován v režimu image intake.";
  }
}

// ---------------------------------------------------------------------------
// Map to AssistantResponse
// ---------------------------------------------------------------------------

/**
 * Maps an image intake result to the existing AssistantResponse format.
 * Reuses StepPreviewItem[] for preview/confirm UI.
 * Execution plan (if any) must be stored in session.lastExecutionPlan by caller.
 */
export function mapImageIntakeToAssistantResponse(
  result: ImageIntakeOrchestratorResult,
  sessionId: string,
): AssistantResponse {
  const { response, executionPlan, previewPayload } = result;
  const plan = executionPlan;

  const message = buildIntakeMessage(result);

  const executionState: AssistantResponse["executionState"] =
    plan && plan.steps.length > 0
      ? {
          status: "awaiting_confirmation",
          planId: plan.planId,
          totalSteps: plan.steps.length,
          pendingSteps: plan.steps.filter((s) => s.status === "requires_confirmation").length,
          stepPreviews: result.response.previewSteps as any[],
          clientLabel: response.clientBinding.clientLabel ?? undefined,
        }
      : null;

  const identityMode = response.actionPlan.outputMode === "identity_contact_intake";

  const warnings: string[] = [
    ...previewPayload.warnings,
    ...response.trace.guardrailsTriggered
      .filter((v) => {
        if (identityMode && v.startsWith("BINDING_VIOLATION")) return false;
        return true;
      })
      .map((v) =>
        v.startsWith("BINDING_VIOLATION")
          ? "Bez jistého klienta nelze připravit write-ready plán."
          : v.startsWith("LANE_VIOLATION")
            ? "Tato zpráva patří do image intake lane, ne AI Review."
            : v,
      ),
    // Surface missing fields as warnings
    ...response.factBundle.missingFields
      .slice(0, 2)
      .map((f) => `Chybějící údaj: ${f}`),
  ].filter(Boolean);

  const confidence =
    response.classification?.confidence ??
    (response.actionPlan.outputMode === "no_action_archive_only" ? 0.9 : 0.5);

  const suggestedNextSteps: string[] = [];
  if (response.actionPlan.outputMode === "ambiguous_needs_input") {
    suggestedNextSteps.push("Otevřete kartu klienta a nahrajte obrázek znovu.");
    suggestedNextSteps.push("Nebo sdělte jméno klienta v textovém poli.");
  }
  if (response.clientBinding.state === "weak_candidate") {
    suggestedNextSteps.push(
      `Potvrďte, zda obrázek patří klientovi: ${response.clientBinding.clientLabel ?? "nalezený kandidát"}.`,
    );
  }

  // Thread reconstruction summary (Phase 5)
  if (result.threadReconstruction) {
    const threadLines = buildThreadSummaryLines(result.threadReconstruction);
    if (threadLines.length > 0) {
      suggestedNextSteps.unshift(...threadLines);
    }
  }

  // Stitching summary (Phase 4)
  const stitchingSummary = result.stitchingResult
    ? buildStitchingSummary(result.stitchingResult)
    : null;
  if (stitchingSummary) {
    suggestedNextSteps.unshift(stitchingSummary);
  }

  // Handoff payload note (Phase 5)
  if (result.handoffPayload) {
    const handoffNote = buildHandoffPreviewNote(result.handoffPayload);
    suggestedNextSteps.push(handoffNote);
  }

  // Case signals summary (Phase 5)
  if (result.caseSignals?.summary) {
    suggestedNextSteps.push(`Signály k příležitosti: ${result.caseSignals.summary}`);
  }

  // Intent change detection summary (Phase 6)
  if (result.intentChange && result.intentChange.status !== "stable") {
    const intentNote = buildIntentChangeSummary(result.intentChange);
    if (intentNote) {
      suggestedNextSteps.push(intentNote);
    }
  }

  // Cross-session reconstruction note (Phase 6)
  if (result.crossSessionReconstruction?.hasPriorContext) {
    const cs = result.crossSessionReconstruction;
    const delta = cs.priorVsLatestDelta ?? "Navazuje na předchozí session.";
    suggestedNextSteps.push(`Cross-session kontext (jistota ${Math.round(cs.crossSessionConfidence * 100)}%): ${delta}`);
  }

  // Case binding v2 warning (Phase 4)
  if (result.caseBindingV2) {
    const cbv2 = result.caseBindingV2;
    if (cbv2.state === "multiple_case_candidates") {
      suggestedNextSteps.push("Vyberte správný case/příležitost — nalezeno více kandidátů.");
    } else if (cbv2.state === "weak_case_candidate") {
      suggestedNextSteps.push(
        `Potvrďte příslušnost ke case: ${cbv2.caseLabel ?? "nalezený kandidát"}.`,
      );
    }
  }

  // Phase 9: Household / multi-client ambiguity surfacing
  if (result.householdBinding) {
    const hh = result.householdBinding;
    if (hh.state === "household_ambiguous") {
      suggestedNextSteps.push(
        `⚠ Domácnost více klientů: ${hh.ambiguityNote ?? "Upřesněte, ke kterému klientovi obrázek patří."}`,
      );
    } else if (hh.state === "household_detected" && hh.ambiguityNote) {
      suggestedNextSteps.push(`Domácnost: ${hh.ambiguityNote}`);
    }
  }

  // Phase 9: Document multi-image set outcome
  if (result.documentSetResult) {
    const ds = result.documentSetResult;
    if (ds.documentSetSummary) {
      suggestedNextSteps.push(`Dokumentový set: ${ds.documentSetSummary}`);
    }
  }

  // Phase 9: AI Review handoff lifecycle note
  if (result.previewPayload.lifecycleStatusNote) {
    suggestedNextSteps.push(result.previewPayload.lifecycleStatusNote);
  }

  const sourceLabel = result.multimodalUsed
    ? `Image intake v4 (multimodal, ${response.actionPlan.outputMode})`
    : `Image intake (${response.actionPlan.outputMode})`;

  const suggestedActions: ActionPayload[] = [];
  if (identityMode) {
    const draft = mapFactBundleToCreateContactDraft(response.factBundle);
    const q = buildContactNewPrefillQuery(draft);
    suggestedActions.push({
      actionType: "open_portal_path",
      label: "Upravit údaje",
      entityType: "portal",
      entityId: "contacts_new_prefill",
      payload: { path: `/portal/contacts/new${q}` },
      requiresConfirmation: false,
      executionMode: "manual_only",
    });
  }

  return {
    message,
    referencedEntities: response.clientBinding.clientId
      ? [{ type: "contact", id: response.clientBinding.clientId, label: response.clientBinding.clientLabel ?? undefined }]
      : [],
    suggestedActions,
    warnings: [...new Set(warnings)],
    confidence,
    sourcesSummary: [sourceLabel],
    sessionId,
    executionState,
    contextState: {
      channel: null,
      lockedClientId: response.clientBinding.clientId,
      lockedClientLabel: response.clientBinding.clientLabel ?? null,
    },
    suggestedNextSteps,
    hasPartialFailure: false,
  };
}
