/**
 * Phase 2 — Document Packet Segmentation types.
 *
 * A single uploaded PDF ("packet") may contain multiple logical subdocuments
 * (final contract, health questionnaire, AML form, payment instruction, etc.).
 * These types model the packet → subdocument hierarchy and feed into extraction routing.
 *
 * Phase 3 canonical extraction types (participants, insured risks, etc.) are also here
 * to keep structured schema co-located with the packet layer.
 */

// ─── Subdocument types ────────────────────────────────────────────────────────

export const PACKET_SUBDOCUMENT_TYPES = [
  "final_contract",
  "contract_proposal",
  "modelation",
  "health_questionnaire",
  "aml_fatca_form",
  "payment_instruction",
  "investment_section",   // DIP / DPS / fond / investiční program / investiční část IŽP
  "service_document",
  "annex",
  "unpublishable_attachment",
  "other",
] as const;

export type PacketSubdocumentType = (typeof PACKET_SUBDOCUMENT_TYPES)[number];

export interface PacketSubdocumentCandidate {
  /** Detected type of this section / subdocument. */
  type: PacketSubdocumentType;
  /** Detection confidence 0–1. */
  confidence: number;
  /** Human-readable label for UI / trace. */
  label: string;
  /** Whether this section is safe to publish as a standalone contract document. */
  publishable: boolean;
  /** Page range hint if detectable from heading/index — "1-8", "9+", etc. */
  pageRangeHint?: string | null;
  /** Section heading or first significant line detected in the text. */
  sectionHeadingHint?: string | null;
  /** Sensitivity hint for this section. */
  sensitivityHint?: string | null;
  /**
   * Character offset range of this section within the full markdown text.
   * Populated during segmentation when a signal match can be located.
   * Used by section-text-slicer for narrowing the extraction input.
   */
  charOffsetHint?: { start: number; end: number } | null;
  /**
   * Physical page numbers (1-indexed) where this section is located.
   * Populated during segmentation when page-break markers are present in the text
   * (e.g. "strana N z M", page separator patterns, or explicit index).
   * Used by section-text-slicer for exact_pages isolation from pageTextMap.
   */
  pageNumbers?: number[] | null;
}

// ─── Evidence fidelity levels ──────────────────────────────────────────────────────────

/**
 * Priority order for extraction evidence, highest to lowest.
 * Used to decide which value wins when merging section-local vs global extraction results.
 */
export const EVIDENCE_FIDELITY_LEVELS = [
  "explicit_section",       // extracted from the dedicated, narrowed section text (highest)
  "explicit_subdocument",   // extracted from a recognized subdocument (not narrowed but typed)
  "inferred_section",       // inferred within the same section (e.g. calculated from other fields)
  "cross_section_inference",// inferred from data in a different section
  "global_context_guess",   // low-confidence guess from full document context (lowest)
] as const;

export type EvidenceFidelityLevel = (typeof EVIDENCE_FIDELITY_LEVELS)[number];

/** Returns true if level A is strictly higher fidelity than level B. */
export function isHigherFidelity(a: EvidenceFidelityLevel, b: EvidenceFidelityLevel): boolean {
  return EVIDENCE_FIDELITY_LEVELS.indexOf(a) < EVIDENCE_FIDELITY_LEVELS.indexOf(b);
}

export interface PacketMeta {
  /** True when the upload contains more than one logical document. */
  isBundle: boolean;
  /** How confident we are that this is a bundle (0–1). */
  bundleConfidence: number;
  /** Which detection method(s) fired. */
  detectionMethods: Array<"keyword_scan" | "section_heading" | "explicit_index" | "page_count_heuristic">;
  /** All detected subdocument sections, ordered by appearance. */
  subdocumentCandidates: PacketSubdocumentCandidate[];
  /** The primary publishable subdocument type (or null if none detected). */
  primarySubdocumentType: PacketSubdocumentType | null;
  /** True if at least one section is health-related (medical questionnaire, health declaration). */
  hasSensitiveAttachment: boolean;
  /** True if at least one section should not be published as a standalone contract. */
  hasUnpublishableSection: boolean;
  /** Internal warnings raised during segmentation. */
  packetWarnings: string[];
}

// ─── Participant roles ────────────────────────────────────────────────────────

export const PARTICIPANT_ROLES = [
  "policyholder",        // pojistník
  "insured",             // pojištěný
  "second_insured",      // 2. pojištěný / spolupojištěný
  "legal_representative",// zákonný zástupce
  "beneficiary",         // oprávněná osoba
  "child_insured",       // pojištěné dítě
  "co_applicant",        // spoludlužník / spoluúčastník
  "borrower",            // dlužník
  "guarantor",           // ručitel
  "investor",            // investor / účastník (DPS/DIP/investice)
  "employer",            // zaměstnavatel (DPS příspěvky)
  "intermediary",        // zprostředkovatel / poradce / makléř
  "spouse",              // manžel/ka
  "other",
] as const;

export type ParticipantRole = (typeof PARTICIPANT_ROLES)[number];

// ─── Phase 3 canonical structured types ──────────────────────────────────────

/** One person involved in the contract with their role. */
export interface ParticipantRecord {
  role: ParticipantRole;
  fullName?: string | null;
  birthDate?: string | null;
  /** Masked or partial personal ID (rodné číslo); never full value in CRM. */
  maskedPersonalId?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  occupation?: string | null;
  /** Free-text relation description within household ("manžel/ka", "dítě 1", …). */
  relationToHousehold?: string | null;
  sourcePage?: number | null;
  confidence?: number;
}

/** One insured risk linked to a specific participant. */
export interface InsuredRiskRecord {
  /** Name of the participant this risk belongs to. */
  linkedParticipantName?: string | null;
  linkedParticipantRole?: ParticipantRole | null;
  /** Technical risk code or short identifier. */
  riskType: string;
  /** Human-readable Czech label from the document. */
  riskLabel: string;
  insuredAmount?: string | number | null;
  /** End date of this specific risk rider. */
  termEnd?: string | null;
  premium?: string | number | null;
  notes?: string | null;
  sourcePage?: number | null;
}

/** Health questionnaire section detected inside the packet. */
export interface HealthQuestionnaireRecord {
  linkedParticipantName?: string | null;
  questionnairePresent: boolean;
  sectionSummary?: string | null;
  /** Flags that may affect underwriting — general pattern only, no raw medical details. */
  medicallyRelevantFlags?: string[];
  /**
   * Always false — health questionnaire sections are never publishable
   * as direct standalone client-visible contract documents.
   */
  publishableAsSeparateDocument: false;
}

/** Investment-related data extracted from the document. */
export interface InvestmentDataRecord {
  strategy?: string | null;
  funds?: Array<{ name: string; allocation?: string | number | null }>;
  investmentAmount?: string | number | null;
  /** True when values come from an illustration / modelation (not binding). */
  isModeledData: boolean;
  /** True when values are binding contractual data. */
  isContractualData: boolean;
  notes?: string | null;
}

/** Payment-specific structured data. */
export interface PaymentDataRecord {
  accountNumber?: string | null;
  iban?: string | null;
  bankCode?: string | null;
  variableSymbol?: string | null;
  paymentMethod?: string | null;
  paymentFrequency?: string | null;
  /** Due pattern description, e.g. "1. dne každého měsíce". */
  duePattern?: string | null;
  notes?: string | null;
}

/** Publishing guidance derived from document type, lifecycle and content flags. */
export interface PublishHints {
  /** The primary contract section is safe to publish (after approval). */
  contractPublishable: boolean;
  /** Should remain in review-only state — do not auto-publish. */
  reviewOnly: boolean;
  /**
   * The packet needs to be split before apply:
   * e.g. contract part is publishable but health questionnaire must stay in vault only.
   */
  needsSplit: boolean;
  /** Requires manual validation before any downstream CRM action. */
  needsManualValidation: boolean;
  /** Only suitable for secure document vault — not for portal or contract CRM record. */
  sensitiveAttachmentOnly: boolean;
  /** Reasons behind these hints. */
  reasons?: string[];
}
