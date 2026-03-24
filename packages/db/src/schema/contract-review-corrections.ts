import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { contractUploadReviews } from "./contract-upload-reviews";

/**
 * Correction hook log for document review learning loops.
 * Stores user overrides in structured shape (without raw file text).
 */
export const contractReviewCorrections = pgTable("contract_review_corrections", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  contractReviewId: uuid("contract_review_id")
    .notNull()
    .references(() => contractUploadReviews.id, { onDelete: "cascade" }),
  correctedDocumentType: text("corrected_document_type"),
  correctedLifecycleStatus: text("corrected_lifecycle_status"),
  correctedFieldValues: jsonb("corrected_field_values"),
  fieldMarkedNotApplicable: jsonb("field_marked_not_applicable"),
  linkedClientOverride: uuid("linked_client_override"),
  linkedDealOverride: uuid("linked_deal_override"),
  confidenceOverride: jsonb("confidence_override"),
  ignoredWarnings: jsonb("ignored_warnings"),
  correctedBy: text("corrected_by"),
  /** Structured diff from compareExtractedToCorrected (Plan 4 correction learning). */
  comparisonDelta: jsonb("comparison_delta"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

