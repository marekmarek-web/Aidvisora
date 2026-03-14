import { pgTable, uuid, text, timestamp, bigint, jsonb } from "drizzle-orm/pg-core";
import { contacts } from "./contacts";

/** Processing status for contract upload pipeline. */
export type ContractProcessingStatus =
  | "uploaded"
  | "processing"
  | "extracted"
  | "review_required"
  | "failed";

/** Review queue status. */
export type ContractReviewStatus = "pending" | "approved" | "rejected" | "applied";

/**
 * Contract uploads and AI extraction review queue.
 * Stores file metadata, extracted JSON, draft actions, and review state.
 */
export const contractUploadReviews = pgTable("contract_upload_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  fileName: text("file_name").notNull(),
  storagePath: text("storage_path").notNull(),
  mimeType: text("mime_type"),
  sizeBytes: bigint("size_bytes", { mode: "number" }),
  processingStatus: text("processing_status").notNull().$type<ContractProcessingStatus>(),
  errorMessage: text("error_message"),
  extractedPayload: jsonb("extracted_payload"),
  clientMatchCandidates: jsonb("client_match_candidates"),
  draftActions: jsonb("draft_actions"),
  confidence: jsonb("confidence").$type<number>(),
  reasonsForReview: jsonb("reasons_for_review").$type<string[]>(),
  reviewStatus: text("review_status").$type<ContractReviewStatus>().default("pending"),
  uploadedBy: text("uploaded_by"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  rejectReason: text("reject_reason"),
  appliedBy: text("applied_by"),
  appliedAt: timestamp("applied_at", { withTimezone: true }),
  /** Resolved client: selected from candidates. Null + createNewClientConfirmed = create new. */
  matchedClientId: uuid("matched_client_id").references(() => contacts.id, { onDelete: "set null" }),
  /** If true and matchedClientId is null, apply will create a new client from draft. */
  createNewClientConfirmed: text("create_new_client_confirmed").$type<"true" | null>(),
  /** After apply: created/linked entity ids for audit. */
  applyResultPayload: jsonb("apply_result_payload"),
  /** Optional reason for approve/reject (e.g. "confirmed match"). */
  reviewDecisionReason: text("review_decision_reason"),
  /** Pipeline: input mode (text_pdf, scanned_pdf, image_document, unsupported). */
  inputMode: text("input_mode"),
  /** Pipeline: extraction mode (text, vision_fallback). */
  extractionMode: text("extraction_mode"),
  /** Pipeline: classified document type. */
  detectedDocumentType: text("detected_document_type"),
  /** Pipeline: trace without document content (inputMode, documentType, classificationConfidence, extractionMode, warnings, failedStep). */
  extractionTrace: jsonb("extraction_trace"),
  /** Pipeline: validation warnings [{ code, message, field? }]. */
  validationWarnings: jsonb("validation_warnings"),
  /** Pipeline: section/field confidence map. */
  fieldConfidenceMap: jsonb("field_confidence_map"),
  /** Pipeline: classification reasons from AI. */
  classificationReasons: jsonb("classification_reasons").$type<string[]>(),
  /** Human correction: snapshot of payload before correction. */
  originalExtractedPayload: jsonb("original_extracted_payload"),
  /** Human correction: user-corrected payload. */
  correctedPayload: jsonb("corrected_payload"),
  /** Human correction: list of field names that were corrected. */
  correctedFields: jsonb("corrected_fields").$type<string[]>(),
  /** Human correction: reason for correction. */
  correctionReason: text("correction_reason"),
  /** Human correction: user id. */
  correctedBy: text("corrected_by"),
  /** Human correction: timestamp. */
  correctedAt: timestamp("corrected_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
