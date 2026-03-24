import type {
  ExtractionDocument,
  ExtractedGroup,
  ExtractedField,
  AIRecommendation,
  FieldStatus,
  ExtractionDiagnostics,
  ProcessingStatus,
  ReviewStatus,
  ClientMatchCandidate,
  DraftAction,
} from "./types";

type ApiReviewDetail = Record<string, unknown>;

const SECTION_LABELS: Record<string, string> = {
  contract: "Smlouva",
  client: "Klient",
  institution: "Instituce",
  product: "Produkt",
  paymentDetails: "Platby",
  dates: "Datum",
  coverage: "Krytí",
  risks: "Krytá rizika",
  parties: "Smluvní strany",
  other: "Ostatní",
};

const SECTION_ICONS: Record<string, string> = {
  client: "User",
  contract: "FileText",
  institution: "Building2",
  product: "FileText",
  paymentDetails: "FileText",
  dates: "FileText",
  coverage: "Shield",
  risks: "Shield",
  parties: "User",
  other: "Heart",
};

const FIELD_LABELS: Record<string, string> = {
  contractNumber: "Číslo smlouvy",
  institutionName: "Pojišťovna / instituce",
  productName: "Produkt",
  fullName: "Jméno a příjmení",
  firstName: "Jméno",
  lastName: "Příjmení",
  email: "E-mail",
  phone: "Telefon",
  birthDate: "Datum narození",
  personalId: "Rodné číslo",
  address: "Adresa",
  startDate: "Počátek smlouvy",
  endDate: "Konec smlouvy",
  premiumAmount: "Pojistné",
  premiumFrequency: "Frekvence plateb",
  deathBenefit: "Pojistná částka na smrt",
  beneficiary: "Obmyšlená osoba",
  vinkulace: "Vinkulace",
};

function fieldConfidence(
  fieldKey: string,
  fieldConfidenceMap: Record<string, number> | undefined,
  globalConfidence: number
): number {
  if (fieldConfidenceMap) {
    for (const [section, val] of Object.entries(fieldConfidenceMap)) {
      if (fieldKey.toLowerCase().includes(section.toLowerCase())) {
        return Math.round(val * 100);
      }
    }
  }
  return Math.round(globalConfidence * 100);
}

function fieldStatus(conf: number, value: unknown): FieldStatus {
  if (!value || value === "—" || value === "Nenalezeno" || value === "Nevyplněno") return "error";
  if (conf < 85) return "warning";
  return "success";
}

function flattenPayload(
  payload: Record<string, unknown>,
  fieldConfidenceMap: Record<string, number> | undefined,
  globalConfidence: number,
): ExtractedGroup[] {
  const groups: ExtractedGroup[] = [];

  for (const [sectionKey, sectionVal] of Object.entries(payload)) {
    if (
      sectionKey === "missingFields" ||
      sectionKey === "rawConfidence" ||
      sectionKey === "additionalNotes" ||
      sectionKey.startsWith("_")
    ) continue;

    if (typeof sectionVal === "object" && sectionVal !== null && !Array.isArray(sectionVal)) {
      const fields: ExtractedField[] = [];
      const section = sectionVal as Record<string, unknown>;

      for (const [fKey, fVal] of Object.entries(section)) {
        if (fKey.startsWith("_")) continue;
        const strVal = fVal == null ? "—" : String(fVal);
        const conf = fieldConfidence(fKey, fieldConfidenceMap, globalConfidence);
        const status = fieldStatus(conf, fVal);
        fields.push({
          id: `${sectionKey}.${fKey}`,
          groupId: sectionKey,
          label: FIELD_LABELS[fKey] ?? fKey,
          value: strVal,
          confidence: conf,
          status,
          message: status === "error"
            ? "Údaj nebyl nalezen nebo chybí v dokumentu."
            : status === "warning"
              ? "Nižší jistota čtení. Doporučujeme ověřit s originálem."
              : undefined,
          sourceType: "ai",
          isConfirmed: false,
          isEdited: false,
          originalAiValue: strVal,
        });
      }
      if (fields.length > 0) {
        groups.push({
          id: sectionKey,
          name: SECTION_LABELS[sectionKey] ?? sectionKey,
          iconName: SECTION_ICONS[sectionKey] ?? "FileText",
          fields,
        });
      }
    } else if (typeof sectionVal === "string" || typeof sectionVal === "number") {
      const ungrouped = groups.find((g) => g.id === "__ungrouped");
      const strVal = String(sectionVal);
      const conf = fieldConfidence(sectionKey, fieldConfidenceMap, globalConfidence);
      const status = fieldStatus(conf, sectionVal);
      const field: ExtractedField = {
        id: `root.${sectionKey}`,
        groupId: "__ungrouped",
        label: FIELD_LABELS[sectionKey] ?? sectionKey,
        value: strVal,
        confidence: conf,
        status,
        message: status === "error"
          ? "Údaj nebyl nalezen nebo chybí v dokumentu."
          : status === "warning"
            ? "Nižší jistota čtení. Doporučujeme ověřit s originálem."
            : undefined,
        sourceType: "ai",
        isConfirmed: false,
        isEdited: false,
        originalAiValue: strVal,
      };
      if (ungrouped) {
        ungrouped.fields.push(field);
      } else {
        groups.push({
          id: "__ungrouped",
          name: "Obecné údaje",
          iconName: "FileText",
          fields: [field],
        });
      }
    }
  }

  return groups;
}

function buildRecommendations(
  detail: ApiReviewDetail,
  groups: ExtractedGroup[]
): AIRecommendation[] {
  const recs: AIRecommendation[] = [];
  let idx = 0;

  const reasons = (detail.reasonsForReview as string[] | undefined) ?? [];
  for (const reason of reasons) {
    recs.push({
      id: `reason-${idx++}`,
      type: "warning",
      severity: "high",
      title: "Důvod ke kontrole",
      description: reason,
      linkedFieldIds: [],
      actionState: "pending",
      dismissed: false,
      createdAt: new Date().toISOString(),
    });
  }

  const warnings = (detail.validationWarnings as Array<{ code?: string; message: string; field?: string }> | undefined) ?? [];
  for (const w of warnings) {
    recs.push({
      id: `vw-${idx++}`,
      type: "compliance",
      severity: "medium",
      title: w.field ? `Validace: ${w.field}` : "Validační upozornění",
      description: w.message,
      linkedFieldIds: w.field
        ? groups.flatMap((g) => g.fields).filter((f) => f.id.includes(w.field!)).map((f) => f.id)
        : [],
      actionState: "pending",
      dismissed: false,
      createdAt: new Date().toISOString(),
    });
  }

  const errorFields = groups.flatMap((g) => g.fields).filter((f) => f.status === "error");
  for (const f of errorFields) {
    recs.push({
      id: `missing-${f.id}`,
      type: "warning",
      severity: "high",
      title: `Chybí: ${f.label}`,
      description: `Údaj „${f.label}" nebyl nalezen v dokumentu. Doporučujeme ověřit s klientem.`,
      linkedFieldIds: [f.id],
      actionState: "pending",
      dismissed: false,
      createdAt: new Date().toISOString(),
    });
  }

  return recs;
}

function buildDiagnostics(
  detail: ApiReviewDetail,
  groups: ExtractedGroup[]
): ExtractionDiagnostics {
  const allFields = groups.flatMap((g) => g.fields);
  const warningCount = allFields.filter((f) => f.status === "warning").length;
  const errorCount = allFields.filter((f) => f.status === "error").length;
  const extractedCount = allFields.filter((f) => f.status !== "error").length;
  const totalCount = allFields.length;

  const notes: string[] = [];
  const trace = detail.extractionTrace as { failedStep?: string; warnings?: string[] } | undefined;
  if (trace?.warnings) notes.push(...trace.warnings);
  if (detail.extractionMode) notes.push(`Režim extrakce: ${detail.extractionMode}`);
  if (detail.inputMode) notes.push(`Režim vstupu: ${detail.inputMode}`);
  if (errorCount > 0) notes.push(`${errorCount} údajů nenalezeno`);
  if (warningCount > 0) notes.push(`${warningCount} údajů s nižší jistotou`);

  return {
    ocrQuality: errorCount > 3 ? "poor" : warningCount > 2 ? "fair" : "good",
    extractionCoverage: totalCount > 0 ? Math.round((extractedCount / totalCount) * 100) : 0,
    totalFields: totalCount,
    extractedFields: extractedCount,
    unresolvedFieldCount: errorCount,
    warningCount,
    errorCount,
    conflictingValueCount: 0,
    pagesWithoutReadableText: [],
    notes,
  };
}

function buildSummary(
  detail: ApiReviewDetail,
  groups: ExtractedGroup[],
  diagnostics: ExtractionDiagnostics
): string {
  const docType = detail.detectedDocumentType as string | undefined;
  const allFields = groups.flatMap((g) => g.fields);
  const parts: string[] = [];

  if (docType) parts.push(`Dokument typu: ${docType}.`);
  parts.push(
    `AI vytěžila ${diagnostics.extractedFields} z ${diagnostics.totalFields} polí.`
  );
  if (diagnostics.errorCount > 0) {
    parts.push(`${diagnostics.errorCount} polí vyžaduje ruční kontrolu.`);
  }
  if (diagnostics.warningCount > 0) {
    parts.push(`${diagnostics.warningCount} polí s nižší jistotou čtení.`);
  }

  return parts.join(" ");
}

export function mapApiToExtractionDocument(
  detail: ApiReviewDetail,
  pdfUrl: string
): ExtractionDocument {
  const extracted = (detail.extractedPayload ?? {}) as Record<string, unknown>;
  const client = (extracted.client ?? {}) as Record<string, unknown>;
  const confidence = (detail.confidence as number | null) ?? 0;
  const fieldConfidenceMap = detail.fieldConfidenceMap as Record<string, number> | undefined;
  const processingStatus = (detail.processingStatus as string) ?? "uploaded";
  const reviewStatus = (detail.reviewStatus as string) ?? "pending";

  const groups = Object.keys(extracted).length > 0
    ? flattenPayload(extracted, fieldConfidenceMap, confidence)
    : [];

  const diagnostics = buildDiagnostics(detail, groups);
  const recommendations = buildRecommendations(detail, groups);
  const summary = buildSummary(detail, groups, diagnostics);

  const clientName =
    [client.fullName, client.firstName, client.lastName].filter(Boolean).join(" ") || "—";

  return {
    id: detail.id as string,
    fileName: detail.fileName as string,
    documentType: (detail.detectedDocumentType as string) ?? "Neznámý typ",
    clientName,
    uploadTime: detail.createdAt
      ? new Date(detail.createdAt as string).toLocaleString("cs-CZ")
      : "—",
    pageCount: 1,
    globalConfidence: Math.round(confidence * 100),
    reviewStatus: reviewStatus as ReviewStatus,
    processingStatus: processingStatus as ProcessingStatus,
    extractionProvider: "internal",
    uploadSource: "upload",
    lastProcessedAt: detail.updatedAt
      ? new Date(detail.updatedAt as string).toLocaleString("cs-CZ")
      : "—",
    executiveSummary: summary,
    recommendations,
    diagnostics,
    groups,
    extraRecommendations: [],
    pdfUrl,
    errorMessage: detail.errorMessage as string | undefined,
    reasonsForReview: detail.reasonsForReview as string[] | undefined,
    clientMatchCandidates:
      (detail.clientMatchCandidates as ClientMatchCandidate[] | undefined) ?? [],
    draftActions: (detail.draftActions as DraftAction[] | undefined) ?? [],
    matchedClientId: detail.matchedClientId as string | undefined,
    createNewClientConfirmed: detail.createNewClientConfirmed as string | undefined,
    isApplied: reviewStatus === "applied",
    applyResultPayload: detail.applyResultPayload as ExtractionDocument["applyResultPayload"],
    extractionTrace: detail.extractionTrace as ExtractionDocument["extractionTrace"],
    validationWarnings: detail.validationWarnings as ExtractionDocument["validationWarnings"],
    classificationReasons: detail.classificationReasons as string[] | undefined,
    fieldConfidenceMap,
  };
}
