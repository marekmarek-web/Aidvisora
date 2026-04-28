import {
  aiReviewCorrectionEvents,
  aiReviewEvalCases,
  aiReviewLearningPatterns,
  and,
  desc,
  eq,
  inArray,
  sql,
} from "db";
import { withServiceTenantContext } from "@/lib/db/service-db";
import type { ContractReviewRow } from "./review-queue-repository";

export type CorrectionType =
  | "missing_field_added"
  | "wrong_value_replaced"
  | "wrong_entity_mapping"
  | "wrong_premium_aggregation"
  | "wrong_document_classification"
  | "wrong_publish_decision"
  | "formatting_normalization"
  | "manual_override";

export type PatternType =
  | "extraction_hint"
  | "validation_rule"
  | "premium_aggregation_rule"
  | "participant_detection_rule"
  | "publish_decision_rule"
  | "classification_hint"
  | "field_alias";

export type LearningPatternDraft = {
  scope: "tenant" | "institution" | "product" | "document_type" | "global_safe";
  institutionName: string | null;
  productName: string | null;
  documentType: string | null;
  fieldPath: string | null;
  patternType: PatternType;
  ruleText: string;
  promptHint: string | null;
  validatorHintJson: Record<string, unknown> | null;
  supportCount: number;
  confidence: number;
  severity: "low" | "medium" | "high" | "critical";
  sourceCorrectionIds: string[];
};

export type CorrectionHints = {
  promptHints: string[];
  validatorHints: Record<string, unknown>[];
  patternIds: string[];
};

const CRITICAL_FIELD_PATTERNS = [
  /^policyHolder(\.|$)|fullName$/i,
  /^participants(\[|\.)/i,
  /^insuredPersons(\[|\.)/i,
  /^contractNumber$/i,
  /^institutionName$/i,
  /^productName$/i,
  /^premium\.totalMonthlyPremium$/i,
  /^premium\.frequency$/i,
  /payment.*(variableSymbol|account)/i,
  /^publishHints\.|publish/i,
  /document(Type|Classification)|lifecycle/i,
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function pathParts(path: string): string[] {
  return path.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
}

export function getValueByPath(obj: unknown, path: string): unknown {
  let current: unknown = obj;
  for (const part of pathParts(path)) {
    if (!isRecord(current) && !Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function normalizeValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value.trim().replace(/\s+/g, " ").slice(0, 500);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value).slice(0, 500);
}

function normalizeScopeValue(value: unknown): string | null {
  const normalized = normalizeValue(value);
  return normalized && normalized !== "—" ? normalized : null;
}

function inferCorrectionType(fieldPath: string, originalValue: unknown, correctedValue: unknown): CorrectionType {
  const lower = fieldPath.toLowerCase();
  if (lower.includes("premium") || lower.includes("pojistn")) return "wrong_premium_aggregation";
  if (lower.includes("publish")) return "wrong_publish_decision";
  if (lower.includes("documenttype") || lower.includes("classification") || lower.includes("lifecyclestatus")) {
    return "wrong_document_classification";
  }
  if (lower.includes("participant") || lower.includes("insured")) return "wrong_entity_mapping";
  if ((originalValue == null || originalValue === "") && correctedValue != null && correctedValue !== "") {
    return "missing_field_added";
  }
  if (normalizeValue(originalValue)?.toLowerCase() === normalizeValue(correctedValue)?.toLowerCase()) {
    return "formatting_normalization";
  }
  return "wrong_value_replaced";
}

function extractMetadata(row: ContractReviewRow, payload: unknown) {
  const trace = row.extractionTrace ?? {};
  return {
    institutionName:
      normalizeScopeValue(getValueByPath(payload, "institutionName")) ??
      normalizeScopeValue(getValueByPath(payload, "extractedFields.institutionName.value")) ??
      null,
    productName:
      normalizeScopeValue(getValueByPath(payload, "productName")) ??
      normalizeScopeValue(getValueByPath(payload, "extractedFields.productName.value")) ??
      null,
    documentType:
      row.correctedDocumentType ??
      row.detectedDocumentType ??
      normalizeScopeValue(getValueByPath(payload, "primaryType")) ??
      normalizeScopeValue(getValueByPath(payload, "documentType")) ??
      null,
    lifecycleStatus:
      row.correctedLifecycleStatus ??
      row.lifecycleStatus ??
      normalizeScopeValue(getValueByPath(payload, "lifecycleStatus")) ??
      null,
    promptVersion: trace.promptVersion ?? null,
    schemaVersion: trace.schemaVersion ?? null,
    modelName: trace.aiReviewModel ?? null,
    pipelineVersion: trace.pipelineVersion ?? (trace.aiReviewPipeline ? String(trace.aiReviewPipeline) : null),
    extractionRunId: normalizeScopeValue(getValueByPath(trace, "extractionRunId")),
  };
}

export function isCriticalCorrectionField(fieldPath: string): boolean {
  return CRITICAL_FIELD_PATTERNS.some((pattern) => pattern.test(fieldPath));
}

export function buildCorrectionEventValues(params: {
  row: ContractReviewRow;
  correctedPayload: unknown;
  correctedFields: string[];
  correctedBy: string;
}) {
  const originalPayload = params.row.extractedPayload;
  const metadata = extractMetadata(params.row, params.correctedPayload);
  return params.correctedFields.map((fieldPath) => {
    const originalValue = getValueByPath(originalPayload, fieldPath);
    const correctedValue = getValueByPath(params.correctedPayload, fieldPath);
    return {
      tenantId: params.row.tenantId,
      reviewId: params.row.id,
      documentHash: normalizeScopeValue(params.row.storagePath),
      extractionRunId: metadata.extractionRunId,
      institutionName: metadata.institutionName,
      productName: metadata.productName,
      documentType: metadata.documentType,
      lifecycleStatus: metadata.lifecycleStatus,
      fieldPath,
      fieldLabel: fieldPath,
      originalValueJson: originalValue === undefined ? null : originalValue,
      correctedValueJson: correctedValue === undefined ? null : correctedValue,
      normalizedOriginalValue: normalizeValue(originalValue),
      normalizedCorrectedValue: normalizeValue(correctedValue),
      correctionType: inferCorrectionType(fieldPath, originalValue, correctedValue),
      promptVersion: metadata.promptVersion,
      schemaVersion: metadata.schemaVersion,
      modelName: metadata.modelName,
      pipelineVersion: metadata.pipelineVersion,
      createdBy: params.correctedBy,
      piiLevel: "contains_customer_data",
    };
  });
}

export async function recordAiReviewCorrectionEvents(params: {
  row: ContractReviewRow;
  correctedPayload: unknown;
  correctedFields: string[];
  correctedBy: string;
}): Promise<void> {
  if (!params.correctedFields.length) return;
  const values = buildCorrectionEventValues(params);
  await withServiceTenantContext({ tenantId: params.row.tenantId, userId: params.correctedBy }, async (tx) => {
    await tx.insert(aiReviewCorrectionEvents).values(values);
  });
}

export async function acceptAiReviewCorrectionEventsOnApproval(params: {
  tenantId: string;
  reviewId: string;
  acceptedAt?: Date;
}): Promise<string[]> {
  const acceptedAt = params.acceptedAt ?? new Date();
  return await withServiceTenantContext({ tenantId: params.tenantId }, async (tx) => {
    const rows = await tx
      .update(aiReviewCorrectionEvents)
      .set({ acceptedOnApproval: true, acceptedAt })
      .where(and(
        eq(aiReviewCorrectionEvents.tenantId, params.tenantId),
        eq(aiReviewCorrectionEvents.reviewId, params.reviewId),
        eq(aiReviewCorrectionEvents.acceptedOnApproval, false),
        eq(aiReviewCorrectionEvents.rejected, false),
      ))
      .returning({ id: aiReviewCorrectionEvents.id });
    return rows.map((row) => row.id);
  });
}

function patternKey(pattern: Pick<LearningPatternDraft, "scope" | "institutionName" | "productName" | "documentType" | "fieldPath" | "patternType">): string {
  return [
    pattern.scope,
    pattern.institutionName ?? "",
    pattern.productName ?? "",
    pattern.documentType ?? "",
    pattern.fieldPath ?? "",
    pattern.patternType,
  ].join("|");
}

function confidenceFromSupport(supportCount: number): number {
  return Math.min(0.95, 0.5 + supportCount * 0.1);
}

export function mineLearningPatternDrafts(events: Array<{
  id: string;
  institutionName: string | null;
  productName: string | null;
  documentType: string | null;
  fieldPath: string;
  correctionType: string;
}>): LearningPatternDraft[] {
  const grouped = new Map<string, Array<typeof events[number]>>();
  for (const event of events) {
    const groupKey = [
      event.institutionName ?? "",
      event.productName ?? "",
      event.documentType ?? "",
      event.fieldPath,
      event.correctionType,
    ].join("|");
    grouped.set(groupKey, [...(grouped.get(groupKey) ?? []), event]);
  }

  const drafts = new Map<string, LearningPatternDraft>();
  const add = (draft: LearningPatternDraft) => drafts.set(patternKey(draft), draft);

  for (const bucket of grouped.values()) {
    if (bucket.length < 1) continue;
    const sample = bucket[0];
    const supportCount = bucket.length;
    const sourceCorrectionIds = bucket.map((event) => event.id);
    const scope: LearningPatternDraft["scope"] = sample.productName ? "product" : sample.institutionName ? "institution" : "tenant";
    const base = {
      scope,
      institutionName: sample.institutionName,
      productName: sample.productName,
      documentType: sample.documentType,
      fieldPath: sample.fieldPath,
      supportCount,
      confidence: confidenceFromSupport(supportCount),
      sourceCorrectionIds,
    };

    if (sample.correctionType === "wrong_premium_aggregation" || sample.fieldPath.includes("premium.totalMonthlyPremium")) {
      add({
        ...base,
        patternType: "premium_aggregation_rule",
        ruleText: "Repeated advisor corrections changed total premium, likely requiring per-insured premium aggregation.",
        promptHint: "For this institution/product, inspect all numbered insured person sections. Per-insured premium rows must be summed to contract total unless an explicit whole-contract total exists.",
        validatorHintJson: { rule: "sum_numbered_insured_premiums", fieldPath: sample.fieldPath },
        severity: "high",
      });
    } else if (sample.correctionType === "wrong_entity_mapping" || /participants|insured/i.test(sample.fieldPath)) {
      add({
        ...base,
        patternType: "participant_detection_rule",
        ruleText: "Repeated advisor corrections added or remapped insured participants.",
        promptHint: "Always search for numbered sections like '2. pojištěný', 'dítě', or 'spolupojištěný' before finalizing participants.",
        validatorHintJson: { rule: "require_numbered_participants", fieldPath: sample.fieldPath },
        severity: "high",
      });
    } else if (sample.correctionType === "wrong_publish_decision") {
      add({
        ...base,
        patternType: "publish_decision_rule",
        ruleText: "Repeated advisor corrections changed publish eligibility.",
        promptHint: "AI classification may warn about proposal/modelation, but CRM publishing is controlled by upload intent and advisor approval.",
        validatorHintJson: { rule: "publish_from_upload_intent_and_approval" },
        severity: "critical",
      });
    } else if (sample.correctionType === "wrong_document_classification") {
      add({
        ...base,
        patternType: "classification_hint",
        ruleText: "Repeated advisor corrections changed document classification.",
        promptHint: "Check lifecycle labels and document titles carefully; do not treat the word 'návrh' alone as a publish blocker.",
        validatorHintJson: { rule: "classification_evidence_required" },
        severity: "medium",
      });
    } else {
      add({
        ...base,
        patternType: "extraction_hint",
        ruleText: `Repeated advisor corrections touched ${sample.fieldPath}.`,
        promptHint: `Pay special attention to ${sample.fieldPath}; use only evidence present in the current document.`,
        validatorHintJson: { rule: "field_attention", fieldPath: sample.fieldPath },
        severity: "medium",
      });
    }
  }

  return [...drafts.values()];
}

export async function buildAiReviewLearningPatterns(params: {
  tenantId: string;
  institutionName?: string | null;
  productName?: string | null;
  documentType?: string | null;
}): Promise<LearningPatternDraft[]> {
  const rows = await withServiceTenantContext({ tenantId: params.tenantId }, async (tx) => {
    return await tx
      .select({
        id: aiReviewCorrectionEvents.id,
        institutionName: aiReviewCorrectionEvents.institutionName,
        productName: aiReviewCorrectionEvents.productName,
        documentType: aiReviewCorrectionEvents.documentType,
        fieldPath: aiReviewCorrectionEvents.fieldPath,
        correctionType: aiReviewCorrectionEvents.correctionType,
      })
      .from(aiReviewCorrectionEvents)
      .where(and(
        eq(aiReviewCorrectionEvents.tenantId, params.tenantId),
        eq(aiReviewCorrectionEvents.acceptedOnApproval, true),
        eq(aiReviewCorrectionEvents.rejected, false),
      ));
  });

  const relevant = rows.filter((row) =>
    (!params.institutionName || row.institutionName === params.institutionName) &&
    (!params.productName || row.productName === params.productName) &&
    (!params.documentType || row.documentType === params.documentType)
  );
  const drafts = mineLearningPatternDrafts(relevant);
  if (!drafts.length) return drafts;

  await withServiceTenantContext({ tenantId: params.tenantId }, async (tx) => {
    const now = new Date();
    for (const draft of drafts) {
      const existing = await tx
        .select({ id: aiReviewLearningPatterns.id })
        .from(aiReviewLearningPatterns)
        .where(and(
          eq(aiReviewLearningPatterns.tenantId, params.tenantId),
          eq(aiReviewLearningPatterns.scope, draft.scope),
          draft.institutionName == null
            ? sql`${aiReviewLearningPatterns.institutionName} IS NULL`
            : eq(aiReviewLearningPatterns.institutionName, draft.institutionName),
          draft.productName == null
            ? sql`${aiReviewLearningPatterns.productName} IS NULL`
            : eq(aiReviewLearningPatterns.productName, draft.productName),
          draft.documentType == null
            ? sql`${aiReviewLearningPatterns.documentType} IS NULL`
            : eq(aiReviewLearningPatterns.documentType, draft.documentType),
          draft.fieldPath == null
            ? sql`${aiReviewLearningPatterns.fieldPath} IS NULL`
            : eq(aiReviewLearningPatterns.fieldPath, draft.fieldPath),
          eq(aiReviewLearningPatterns.patternType, draft.patternType),
        ))
        .limit(1);
      if (existing[0]) {
        await tx
          .update(aiReviewLearningPatterns)
          .set({
            ruleText: draft.ruleText,
            promptHint: draft.promptHint,
            validatorHintJson: draft.validatorHintJson,
            supportCount: draft.supportCount,
            confidence: String(draft.confidence),
            severity: draft.severity,
            sourceCorrectionIds: draft.sourceCorrectionIds,
            updatedAt: now,
            lastSeenAt: now,
          })
          .where(eq(aiReviewLearningPatterns.id, existing[0].id));
      } else {
        await tx.insert(aiReviewLearningPatterns).values({
          tenantId: params.tenantId,
          ...draft,
          confidence: String(draft.confidence),
          sourceCorrectionIds: draft.sourceCorrectionIds,
          createdAt: now,
          updatedAt: now,
          lastSeenAt: now,
        });
      }
    }
  });

  return drafts;
}

function hintIsSafe(hint: string): boolean {
  return hint.length <= 500 && !/[\w.+-]+@[\w.-]+\.[a-z]{2,}|(\+?\d[\d\s]{7,})|\b\d{6}\/?\d{3,4}\b/i.test(hint);
}

export async function getCorrectionHints(params: {
  tenantId: string;
  institutionName?: string | null;
  productName?: string | null;
  documentType?: string | null;
  documentText?: string | null;
  maxHints?: number;
}): Promise<CorrectionHints> {
  const maxHints = params.maxHints ?? 8;
  const currentText = (params.documentText ?? "").toLowerCase();
  const textContains = (value: string | null): boolean =>
    Boolean(value && currentText.includes(value.toLowerCase()));
  const rows = await withServiceTenantContext({ tenantId: params.tenantId }, async (tx) => {
    return await tx
      .select({
        id: aiReviewLearningPatterns.id,
        scope: aiReviewLearningPatterns.scope,
        institutionName: aiReviewLearningPatterns.institutionName,
        productName: aiReviewLearningPatterns.productName,
        documentType: aiReviewLearningPatterns.documentType,
        promptHint: aiReviewLearningPatterns.promptHint,
        validatorHintJson: aiReviewLearningPatterns.validatorHintJson,
        confidence: aiReviewLearningPatterns.confidence,
        supportCount: aiReviewLearningPatterns.supportCount,
      })
      .from(aiReviewLearningPatterns)
      .where(and(
        eq(aiReviewLearningPatterns.tenantId, params.tenantId),
        eq(aiReviewLearningPatterns.enabled, true),
      ))
      .orderBy(desc(aiReviewLearningPatterns.supportCount), desc(aiReviewLearningPatterns.updatedAt));
  });

  const relevant = rows.filter((row) => {
    const institutionOk =
      !row.institutionName ||
      row.institutionName === params.institutionName ||
      (!params.institutionName && textContains(row.institutionName));
    const productOk =
      !row.productName ||
      row.productName === params.productName ||
      (!params.productName && textContains(row.productName));
    const typeOk = !row.documentType || !params.documentType || row.documentType === params.documentType;
    return institutionOk && productOk && typeOk;
  }).slice(0, maxHints);

  return {
    promptHints: relevant.map((row) => row.promptHint).filter((hint): hint is string => Boolean(hint && hintIsSafe(hint))),
    validatorHints: relevant.map((row) => row.validatorHintJson).filter((hint): hint is Record<string, unknown> => isRecord(hint)),
    patternIds: relevant.map((row) => row.id),
  };
}

export async function createEvalCaseDraftsForAcceptedCorrections(params: {
  tenantId: string;
  reviewId: string;
  correctionIds: string[];
  expectedOutput: unknown;
}): Promise<number> {
  if (!params.correctionIds.length) return 0;
  const rows = await withServiceTenantContext({ tenantId: params.tenantId }, async (tx) => {
    return await tx
      .select({
        id: aiReviewCorrectionEvents.id,
        reviewId: aiReviewCorrectionEvents.reviewId,
        documentHash: aiReviewCorrectionEvents.documentHash,
        institutionName: aiReviewCorrectionEvents.institutionName,
        productName: aiReviewCorrectionEvents.productName,
        documentType: aiReviewCorrectionEvents.documentType,
        fieldPath: aiReviewCorrectionEvents.fieldPath,
      })
      .from(aiReviewCorrectionEvents)
      .where(and(
        eq(aiReviewCorrectionEvents.tenantId, params.tenantId),
        inArray(aiReviewCorrectionEvents.id, params.correctionIds),
        eq(aiReviewCorrectionEvents.acceptedOnApproval, true),
      ));
  });
  const critical = rows.filter((row) => isCriticalCorrectionField(row.fieldPath));
  if (!critical.length) return 0;
  const first = critical[0];
  await withServiceTenantContext({ tenantId: params.tenantId }, async (tx) => {
    await tx.insert(aiReviewEvalCases).values({
      tenantId: params.tenantId,
      sourceReviewId: params.reviewId,
      sourceCorrectionIds: critical.map((row) => row.id),
      documentHash: first.documentHash,
      institutionName: first.institutionName,
      productName: first.productName,
      documentType: first.documentType,
      expectedOutputJson: params.expectedOutput,
      criticalFields: critical.map((row) => row.fieldPath),
      piiScrubbed: false,
      active: true,
    });
  });
  return 1;
}

export async function listAiReviewLearningDebug(params: { tenantId: string; limit?: number }) {
  const limit = params.limit ?? 50;
  return await withServiceTenantContext({ tenantId: params.tenantId }, async (tx) => {
    const [events, patterns, evalCases] = await Promise.all([
      tx.select().from(aiReviewCorrectionEvents).where(eq(aiReviewCorrectionEvents.tenantId, params.tenantId)).orderBy(desc(aiReviewCorrectionEvents.createdAt)).limit(limit),
      tx.select().from(aiReviewLearningPatterns).where(eq(aiReviewLearningPatterns.tenantId, params.tenantId)).orderBy(desc(aiReviewLearningPatterns.updatedAt)).limit(limit),
      tx.select().from(aiReviewEvalCases).where(eq(aiReviewEvalCases.tenantId, params.tenantId)).orderBy(desc(aiReviewEvalCases.createdAt)).limit(limit),
    ]);
    return { events, patterns, evalCases };
  });
}

export async function listActiveAiReviewEvalCases(params: { tenantId: string; limit?: number }) {
  return await withServiceTenantContext({ tenantId: params.tenantId }, async (tx) => {
    return await tx
      .select()
      .from(aiReviewEvalCases)
      .where(and(
        eq(aiReviewEvalCases.tenantId, params.tenantId),
        eq(aiReviewEvalCases.active, true),
      ))
      .orderBy(desc(aiReviewEvalCases.createdAt))
      .limit(params.limit ?? 500);
  });
}

export function scoreAiReviewEvalCase(params: {
  expectedOutput: unknown;
  actualOutput: unknown;
  criticalFields: string[];
}) {
  const criticalResults = params.criticalFields.map((fieldPath) => {
    const expected = getValueByPath(params.expectedOutput, fieldPath);
    const actual = getValueByPath(params.actualOutput, fieldPath);
    const expectedNumber = typeof expected === "number" ? expected : Number.parseFloat(String(expected ?? "").replace(",", "."));
    const actualNumber = typeof actual === "number" ? actual : Number.parseFloat(String(actual ?? "").replace(",", "."));
    const numeric = Number.isFinite(expectedNumber) && Number.isFinite(actualNumber);
    const match = numeric
      ? Math.abs(expectedNumber - actualNumber) <= 0.01
      : JSON.stringify(expected) === JSON.stringify(actual);
    return { fieldPath, match, numeric };
  });
  const criticalExact = criticalResults.filter((r) => r.match).length / Math.max(1, criticalResults.length);
  const numericResults = criticalResults.filter((r) => r.numeric);
  const numericPremium = numericResults.filter((r) => r.match).length / Math.max(1, numericResults.length || 1);
  const expectedParticipants = getValueByPath(params.expectedOutput, "participants") ?? getValueByPath(params.expectedOutput, "insuredPersons");
  const actualParticipants = getValueByPath(params.actualOutput, "participants") ?? getValueByPath(params.actualOutput, "insuredPersons");
  const participantCount = Array.isArray(expectedParticipants) && Array.isArray(actualParticipants)
    ? expectedParticipants.length === actualParticipants.length
    : true;
  const expectedPublish = getValueByPath(params.expectedOutput, "publishHints.contractPublishable");
  const actualPublish = getValueByPath(params.actualOutput, "publishHints.contractPublishable");
  const publishDecision = expectedPublish == null || expectedPublish === actualPublish;
  return {
    criticalExact,
    numericPremium,
    participantCount,
    premiumAggregation: criticalResults.find((r) => r.fieldPath === "premium.totalMonthlyPremium")?.match ?? true,
    publishDecision,
    schemaValid: true,
    criticalResults,
  };
}

export async function buildFineTuneDatasetRows(params: {
  tenantId: string;
  requireConsent: boolean;
}) {
  if (!params.requireConsent) {
    throw new Error("AI Review fine-tune export requires explicit admin consent.");
  }
  const cases = await withServiceTenantContext({ tenantId: params.tenantId }, async (tx) => {
    return await tx
      .select()
      .from(aiReviewEvalCases)
      .where(and(
        eq(aiReviewEvalCases.tenantId, params.tenantId),
        eq(aiReviewEvalCases.active, true),
        eq(aiReviewEvalCases.piiScrubbed, true),
      ))
      .orderBy(desc(aiReviewEvalCases.createdAt));
  });
  return cases.map((row, index) => ({
    split: index % 5 === 0 ? "holdout" : "train",
    messages: [
      {
        role: "system",
        content: "Extract a DocumentReviewEnvelope for an internal advisor AI Review. Use only anonymized input and current-document evidence.",
      },
      {
        role: "user",
        content: JSON.stringify({
          anonymizedInputRef: row.anonymizedInputRef,
          institutionName: row.institutionName,
          productName: row.productName,
          documentType: row.documentType,
          criticalFields: row.criticalFields,
        }),
      },
      {
        role: "assistant",
        content: JSON.stringify(row.expectedOutputJson),
      },
    ],
  }));
}
