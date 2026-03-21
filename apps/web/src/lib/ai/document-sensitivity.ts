import type {
  DocumentReviewEnvelope,
  SensitivityProfile,
} from "./document-review-types";

const HEALTH_MARKERS = [
  "health",
  "medical",
  "smoking",
  "underwriting",
  "dotaznik",
];

const SPECIAL_PERSONAL_MARKERS = [
  "personalid",
  "rodnecislo",
  "rc",
  "opnumber",
  "iban",
  "accountnumber",
];

export function resolveSensitivityProfile(
  envelope: DocumentReviewEnvelope
): SensitivityProfile {
  const allKeys = Object.keys(envelope.extractedFields).map((k) => k.toLowerCase());
  const allText = [
    ...allKeys,
    ...Object.values(envelope.extractedFields).map((f) => (f.evidenceSnippet ?? "").toLowerCase()),
  ].join(" ");

  if (envelope.documentMeta.scannedVsDigital === "scanned" && (envelope.documentMeta.overallConfidence ?? 1) < 0.65) {
    return "high_sensitivity_scan";
  }
  if (HEALTH_MARKERS.some((m) => allText.includes(m))) return "health_data";
  if (SPECIAL_PERSONAL_MARKERS.some((m) => allText.includes(m))) return "special_category_data";
  if (envelope.documentClassification.primaryType === "bank_statement") return "financial_data";
  return "standard_personal_data";
}

function maskValue(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  const value = raw.trim();
  if (value.length <= 4) return "***";
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

export function maskSensitiveEnvelopeForUi(
  envelope: DocumentReviewEnvelope
): DocumentReviewEnvelope {
  const clone: DocumentReviewEnvelope = JSON.parse(JSON.stringify(envelope));
  if (!clone.extractedFields || typeof clone.extractedFields !== "object") {
    return clone;
  }
  const sensitiveKeys = [
    "personalId",
    "maskedPersonalId",
    "iban",
    "accountNumber",
    "opNumber",
    "health",
    "medical",
  ];
  for (const [key, field] of Object.entries(clone.extractedFields)) {
    const isSensitive = field.sensitive || sensitiveKeys.some((k) => key.toLowerCase().includes(k.toLowerCase()));
    if (isSensitive) {
      field.value = maskValue(field.value);
      if (field.evidenceSnippet) field.evidenceSnippet = String(maskValue(field.evidenceSnippet));
      field.sensitive = true;
    }
  }
  return clone;
}

