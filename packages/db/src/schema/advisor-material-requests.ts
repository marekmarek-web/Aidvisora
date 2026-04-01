import { pgTable, uuid, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { contacts } from "./contacts";
import { opportunities } from "./pipeline";
import { documents } from "./documents";

export type MaterialRequestPriority = "low" | "normal" | "high";
export type MaterialRequestResponseMode = "text" | "files" | "both" | "yes_no";
export type MaterialRequestStatus =
  | "new"
  | "seen"
  | "answered"
  | "needs_more"
  | "done"
  | "closed";
export type MaterialRequestMessageAuthorRole = "advisor" | "client" | "system";
export type MaterialRequestAttachmentRole = "advisor" | "client";

/** Požadavek poradce na doplnění podkladů od klienta (jednotná vrstva s portály). */
export const advisorMaterialRequests = pgTable("advisor_material_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  contactId: uuid("contact_id")
    .notNull()
    .references(() => contacts.id, { onDelete: "cascade" }),
  createdByUserId: text("created_by_user_id").notNull(),
  category: text("category").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  priority: text("priority").notNull().default("normal"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  responseMode: text("response_mode").notNull().default("both"),
  status: text("status").notNull().default("new"),
  internalNote: text("internal_note"),
  readByClientAt: timestamp("read_by_client_at", { withTimezone: true }),
  advisorLastReadAt: timestamp("advisor_last_read_at", { withTimezone: true }),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id, { onDelete: "set null" }),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const advisorMaterialRequestMessages = pgTable("advisor_material_request_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  requestId: uuid("request_id")
    .notNull()
    .references(() => advisorMaterialRequests.id, { onDelete: "cascade" }),
  authorRole: text("author_role").notNull(),
  authorUserId: text("author_user_id"),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const advisorMaterialRequestDocuments = pgTable(
  "advisor_material_request_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => advisorMaterialRequests.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    attachmentRole: text("attachment_role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("advisor_material_request_documents_req_doc_uid").on(t.requestId, t.documentId)]
);
