import type { ExtractedContractSchema } from "./extraction-schemas";
import type { DraftActionBase } from "./review-queue";
import type { DocumentReviewEnvelope } from "./document-review-types";
import { resolveDocumentSchema } from "./document-schema-router";

export { findClientCandidates } from "./client-matching";
export type { ClientMatchingContext } from "./client-matching";

export function buildCreateClientDraft(extracted: ExtractedContractSchema): DraftActionBase {
  const c = extracted.client;
  return {
    type: "create_client",
    label: "Vytvořit klienta",
    payload: {
      firstName: c?.firstName ?? "",
      lastName: c?.lastName ?? "",
      fullName: c?.fullName,
      email: c?.email,
      phone: c?.phone,
      birthDate: c?.birthDate,
      personalId: c?.personalId,
      companyId: c?.companyId,
      address: c?.address,
    },
  };
}

export function buildCreateContractDraft(extracted: ExtractedContractSchema): DraftActionBase {
  return {
    type: "create_contract",
    label: "Vytvořit smlouvu v CRM",
    payload: {
      contractNumber: extracted.contractNumber,
      institutionName: extracted.institutionName,
      productName: extracted.productName,
      effectiveDate: extracted.effectiveDate,
      expirationDate: extracted.expirationDate,
      documentType: extracted.documentType,
    },
  };
}

export function buildCreatePaymentDraft(extracted: ExtractedContractSchema): DraftActionBase {
  const p = extracted.paymentDetails;
  return {
    type: "create_payment",
    label: "Návrh platby",
    payload: {
      amount: p?.amount,
      currency: p?.currency,
      frequency: p?.frequency,
      iban: p?.iban,
      accountNumber: p?.accountNumber,
      bankCode: p?.bankCode,
      variableSymbol: p?.variableSymbol,
      firstPaymentDate: p?.firstPaymentDate,
    },
  };
}

export function buildCreateTaskDraft(extracted: ExtractedContractSchema): DraftActionBase {
  return {
    type: "create_task",
    label: "Úkol ze smlouvy",
    payload: {
      title: `Smlouva: ${extracted.productName ?? extracted.documentType ?? "Dokument"}`,
      notes: extracted.notes?.join("\n"),
      contractNumber: extracted.contractNumber,
    },
  };
}

export function buildDraftEmailSuggestion(extracted: ExtractedContractSchema): DraftActionBase {
  const c = extracted.client;
  return {
    type: "draft_email",
    label: "Návrh e-mailu",
    payload: {
      to: c?.email,
      subject: extracted.contractNumber
        ? `Smlouva ${extracted.contractNumber}`
        : "Smlouva – doplnění údajů",
      bodyPlaceholder: extracted.notes?.join("\n"),
    },
  };
}

/**
 * Build all draft actions for an extracted contract. No DB write.
 */
export function buildLegacyDraftActions(extracted: ExtractedContractSchema): DraftActionBase[] {
  const actions: DraftActionBase[] = [
    buildCreateClientDraft(extracted),
    buildCreateContractDraft(extracted),
    buildCreatePaymentDraft(extracted),
    buildCreateTaskDraft(extracted),
    buildDraftEmailSuggestion(extracted),
  ];
  return actions;
}

function fieldValue(envelope: DocumentReviewEnvelope, key: string): unknown {
  const direct = envelope.extractedFields[key];
  if (direct) return direct.value;
  const stripped = key.replace(/^extractedFields\./, "");
  return envelope.extractedFields[stripped]?.value;
}

function toLegacyProjection(envelope: DocumentReviewEnvelope): ExtractedContractSchema {
  const fullName = String(fieldValue(envelope, "fullName") ?? fieldValue(envelope, "clientFullName") ?? "");
  const names = fullName.split(" ");
  return {
    documentType: envelope.documentClassification.primaryType,
    contractNumber: String(fieldValue(envelope, "contractNumber") ?? ""),
    institutionName: String(fieldValue(envelope, "insurer") ?? fieldValue(envelope, "lender") ?? fieldValue(envelope, "bankName") ?? ""),
    productName: String(fieldValue(envelope, "productName") ?? ""),
    client: {
      fullName,
      firstName: String(fieldValue(envelope, "firstName") ?? names[0] ?? ""),
      lastName: String(fieldValue(envelope, "lastName") ?? names.slice(1).join(" ") ?? ""),
      birthDate: String(fieldValue(envelope, "birthDate") ?? ""),
      personalId: String(fieldValue(envelope, "maskedPersonalId") ?? ""),
      companyId: String(fieldValue(envelope, "companyId") ?? ""),
      email: String(fieldValue(envelope, "email") ?? ""),
      phone: String(fieldValue(envelope, "phone") ?? ""),
      address: String(fieldValue(envelope, "address") ?? ""),
    },
    paymentDetails: {
      amount: fieldValue(envelope, "loanAmount") as number | string | undefined,
      currency: String(fieldValue(envelope, "currency") ?? ""),
      frequency: String(fieldValue(envelope, "paymentFrequency") ?? ""),
      iban: String(fieldValue(envelope, "ibanMasked") ?? fieldValue(envelope, "iban") ?? ""),
      accountNumber: String(fieldValue(envelope, "accountNumberMasked") ?? fieldValue(envelope, "accountNumber") ?? ""),
      bankCode: String(fieldValue(envelope, "bankCode") ?? ""),
      variableSymbol: String(fieldValue(envelope, "variableSymbol") ?? ""),
      firstPaymentDate: String(fieldValue(envelope, "firstInstallmentDate") ?? ""),
    },
    effectiveDate: String(fieldValue(envelope, "policyStartDate") ?? fieldValue(envelope, "disbursementDate") ?? ""),
    expirationDate: String(fieldValue(envelope, "policyEndDate") ?? fieldValue(envelope, "lastInstallmentDate") ?? ""),
    notes: envelope.reviewWarnings.map((w) => w.message),
    missingFields: [],
    confidence: envelope.documentMeta.overallConfidence ?? envelope.documentClassification.confidence,
    needsHumanReview: envelope.reviewWarnings.some((w) => w.severity === "critical"),
  };
}

function dedupeActions(actions: DraftActionBase[]): DraftActionBase[] {
  const key = (a: DraftActionBase) => `${a.type}:${JSON.stringify(a.payload)}`;
  const seen = new Set<string>();
  return actions.filter((a) => {
    const k = key(a);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function buildAllDraftActions(
  extracted: ExtractedContractSchema | DocumentReviewEnvelope
): DraftActionBase[] {
  const maybeEnvelope = extracted as DocumentReviewEnvelope;
  if (!maybeEnvelope?.documentClassification || !maybeEnvelope?.extractedFields) {
    return buildLegacyDraftActions(extracted as ExtractedContractSchema);
  }

  const schema = resolveDocumentSchema(maybeEnvelope.documentClassification.primaryType);
  const legacy = toLegacyProjection(maybeEnvelope);
  const actions: DraftActionBase[] = [];
  const requested = schema.extractionRules.suggestedActionRules;
  if (requested.includes("create_or_link_client")) {
    actions.push(buildCreateClientDraft(legacy));
  }
  if (requested.includes("create_contract_record")) {
    actions.push(buildCreateContractDraft(legacy));
  }
  if (requested.includes("create_task") || requested.includes("create_task_followup") || requested.includes("create_task_onboarding")) {
    actions.push(buildCreateTaskDraft(legacy));
  }
  if (requested.includes("create_opportunity")) {
    actions.push({
      type: "create_opportunity",
      label: "Vytvořit obchodní příležitost",
      payload: {
        title: `${maybeEnvelope.documentClassification.primaryType} – follow-up`,
        lifecycleStatus: maybeEnvelope.documentClassification.lifecycleStatus,
      },
    });
  }
  if (requested.includes("create_income_verification_record")) {
    actions.push({
      type: "create_income_verification_record",
      label: "Vytvořit záznam ověření příjmu",
      payload: {
        employerName: fieldValue(maybeEnvelope, "employerName"),
        avgIncome3m: fieldValue(maybeEnvelope, "averageNetIncomeLast3Months"),
        avgIncome12m: fieldValue(maybeEnvelope, "averageNetIncomeLast12Months"),
      },
    });
  }
  if (requested.includes("attach_to_existing_client")) {
    actions.push({
      type: "attach_to_existing_client",
      label: "Připojit k existujícímu klientovi",
      payload: {},
    });
  }
  if (requested.includes("propose_financial_analysis_update")) {
    actions.push({
      type: "propose_financial_analysis_update",
      label: "Navrhnout update finanční analýzy",
      payload: {
        sourceType: maybeEnvelope.documentClassification.primaryType,
      },
    });
  }
  if (requested.includes("request_manual_review")) {
    actions.push({
      type: "request_manual_review",
      label: "Požádat o manuální review",
      payload: {
        reason: maybeEnvelope.reviewWarnings.map((w) => w.code).join(", "),
      },
    });
  }
  // Keep email helper for user convenience.
  actions.push(buildDraftEmailSuggestion(legacy));
  return dedupeActions(actions);
}
