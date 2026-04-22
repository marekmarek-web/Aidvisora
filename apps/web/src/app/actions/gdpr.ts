"use server";

import { requireAuthInAction } from "@/lib/auth/require-auth";
import { withAuthContext, withTenantContextFromAuth } from "@/lib/auth/with-auth-context";
import { hasPermission } from "@/lib/auth/permissions";
import type { TenantContextDb } from "@/lib/db/with-tenant-context";
import {
  contacts,
  contracts,
  documents,
  messages,
  meetingNotes,
  contractUploadReviews,
  documentExtractions,
  clientPaymentSetups,
  consents,
  auditLog,
  opportunities,
  timelineItems,
  userTermsAcceptance,
  clientContacts,
  advisorProposals,
  portalNotifications,
} from "db";
import { eq, and, or, sql, isNull } from "db";
import { logAuditAction } from "@/lib/audit";
import { logSecurityEvent } from "@/lib/security/security-audit";

/** Uložení souhlasu s GDPR (registrace / kontakt). */
export async function recordGdprConsent(contactId: string): Promise<void> {
  await withAuthContext(async (auth, tx) => {
    if (!hasPermission(auth.roleName, "contacts:write")) throw new Error("Forbidden");
    await tx
      .update(contacts)
      .set({ gdprConsentAt: new Date(), updatedAt: new Date() })
      .where(and(eq(contacts.tenantId, auth.tenantId), eq(contacts.id, contactId)));
  });
}

/** Export dat kontaktu (pro GDPR – na žádost). Vrátí JSON. */
export async function exportContactData(contactId: string): Promise<Record<string, unknown>> {
  const auth = await requireAuthInAction();
  if (auth.roleName === "Client") {
    if (auth.contactId !== contactId) {
      // B3.1 — klient se snaží exportovat cizí kontakt → critical security event.
      await logSecurityEvent({
        tenantId: auth.tenantId,
        userId: auth.userId,
        eventType: "cross_tenant_attempt",
        severity: "critical",
        entityType: "contact",
        entityId: contactId,
        meta: { action: "gdpr_export", clientContactId: auth.contactId },
      }).catch(() => {});
      throw new Error("Forbidden");
    }
  } else if (!hasPermission(auth.roleName, "contacts:read")) {
    await logSecurityEvent({
      tenantId: auth.tenantId,
      userId: auth.userId,
      eventType: "permission_denied",
      severity: "warning",
      entityType: "contact",
      entityId: contactId,
      meta: { action: "gdpr_export", roleName: auth.roleName },
    }).catch(() => {});
    throw new Error("Forbidden");
  }
  const data = await withTenantContextFromAuth(auth, (tx) =>
    doExportContactData(tx, auth.tenantId, contactId),
  );
  logAuditAction({
    tenantId: auth.tenantId,
    userId: auth.userId,
    action: "gdpr.export",
    entityType: "contact",
    entityId: contactId,
    meta: { roleName: auth.roleName, source: "advisor" },
  });
  // B3.1 — úspěšný GDPR export trackovat jako security event (audit + alerting).
  await logSecurityEvent({
    tenantId: auth.tenantId,
    userId: auth.userId,
    eventType: "export_triggered",
    severity: "warning",
    entityType: "contact",
    entityId: contactId,
    meta: { source: "advisor", roleName: auth.roleName },
  }).catch(() => {});
  return data;
}

/** Pro Client Zone – export dat přihlášeného klienta (auth.contactId). */
export async function exportContactDataForClient(): Promise<Record<string, unknown>> {
  const auth = await requireAuthInAction();
  if (auth.roleName !== "Client" || !auth.contactId) throw new Error("Forbidden");
  const data = await withTenantContextFromAuth(auth, (tx) =>
    doExportContactData(tx, auth.tenantId, auth.contactId!, {
      includeAdvisorAuditMetadata: false,
      clientScope: true,
    }),
  );
  logAuditAction({
    tenantId: auth.tenantId,
    userId: auth.userId,
    action: "gdpr.export",
    entityType: "contact",
    entityId: auth.contactId,
    meta: { roleName: auth.roleName, source: "client_portal" },
  });
  // B3.1 — klientský self-service export: trackovat jako security event.
  await logSecurityEvent({
    tenantId: auth.tenantId,
    userId: auth.userId,
    eventType: "export_triggered",
    severity: "info",
    entityType: "contact",
    entityId: auth.contactId,
    meta: { source: "client_portal", roleName: auth.roleName },
  }).catch(() => {});
  return data;
}

type ExportOptions = {
  /**
   * Pro advisor-triggered export obsahuje i interní audit metadata (kdo co kdy nahrál).
   * Pro client-triggered export tyto položky vynecháváme (nepatří do osobního GDPR exportu).
   */
  includeAdvisorAuditMetadata?: boolean;
  /**
   * B1.3 — client-scoped export (aligned s portal visibility).
   * Když `true`:
   *   - contracts: jen `visibleToClient=true` a nezarchivované; pole `note`
   *     (interní poznámka poradce) se nulují, `advisorConfirmedAt` /
   *     `confirmedByUserId` / `sourceContractReviewId` rovněž.
   *   - documents: jen `visibleToClient=true`.
   *   - clientPaymentSetups: jen `visibleToClient=true`.
   *   - contact.notes: interní poznámka poradce, neposílá se.
   *   - meetingNotes / auditLog interní pole: nezahrnuty (auditLog už je
   *     gated přes `includeAdvisorAuditMetadata`).
   *
   * Když `false` (advisor DSAR na žádost klienta, plná archivace) — export
   * zahrnuje i interní materiál a caller je zodpovědný za legal review.
   */
  clientScope?: boolean;
};

/**
 * Delta A8 — kompletní GDPR export kontaktu.
 *
 * Rozsah dle GDPR článku 15 (Právo na přístup) + článku 20 (Portabilita):
 *   - Identifikační údaje (jméno, e-mail, telefon, adresa, datum narození, OP, rodné číslo).
 *   - Smlouvy, portfolio, platební pokyny klienta (client_payment_setups).
 *   - Komunikace (messages, meeting notes obsahující tento kontakt).
 *   - AI review dokumentů klienta + extrahovaná pole.
 *   - Doklady o souhlasech (consents, user_terms_acceptance, GDPR consent timestamp).
 *   - Raw soubory — pouze **metadata** (ID, name, createdAt), samotné bytes je třeba
 *     stáhnout přes klientský portál (signed URL), jinak by export překročil limit 4 MB.
 *   - Audit log — výběr akcí týkajících se tohoto contact_id (bez admin-only polí).
 *   - Opportunities (pipeline), timeline, notifications.
 *
 * Data NE-exportovaná (musí zůstat u advisora):
 *   - Interní poznámky jiných kontaktů.
 *   - AI feedback, business plán, vision goals.
 *   - Obsah messages odeslaných **mezi advisory** bez účasti klienta.
 */
async function doExportContactData(
  tx: TenantContextDb,
  tenantId: string,
  contactId: string,
  options: ExportOptions = {},
): Promise<Record<string, unknown>> {
  const [contact] = await tx
    .select()
    .from(contacts)
    .where(and(eq(contacts.tenantId, tenantId), eq(contacts.id, contactId)))
    .limit(1);
  if (!contact) throw new Error("Kontakt nenalezen");

  const [
    contractRows,
    docRows,
    messageRows,
    meetingNoteRows,
    uploadReviewRows,
    extractionRows,
    clientPaymentSetupRows,
    consentRows,
    opportunityRows,
    timelineRows,
    termsAcceptanceRows,
    portalFeedbackRows,
    clientLinkRows,
    advisorProposalRows,
    portalNotificationRows,
    auditLogRows,
  ] = await Promise.all([
    tx
      .select()
      .from(contracts)
      .where(
        and(
          eq(contracts.tenantId, tenantId),
          eq(contracts.contactId, contactId),
          ...(options.clientScope
            ? [eq(contracts.visibleToClient, true), isNull(contracts.archivedAt)]
            : []),
        ),
      ),
    tx
      .select({
        id: documents.id,
        name: documents.name,
        mimeType: documents.mimeType,
        sizeBytes: documents.sizeBytes,
        createdAt: documents.createdAt,
        sourceChannel: documents.sourceChannel,
      })
      .from(documents)
      .where(
        and(
          eq(documents.tenantId, tenantId),
          eq(documents.contactId, contactId),
          ...(options.clientScope ? [eq(documents.visibleToClient, true)] : []),
        ),
      ),
    tx.select().from(messages).where(and(eq(messages.tenantId, tenantId), eq(messages.contactId, contactId))),
    tx
      .select()
      .from(meetingNotes)
      .where(and(eq(meetingNotes.tenantId, tenantId), eq(meetingNotes.contactId, contactId))),
    tx
      .select({
        id: contractUploadReviews.id,
        fileName: contractUploadReviews.fileName,
        processingStatus: contractUploadReviews.processingStatus,
        reviewStatus: contractUploadReviews.reviewStatus,
        createdAt: contractUploadReviews.createdAt,
      })
      .from(contractUploadReviews)
      .where(
        and(
          eq(contractUploadReviews.tenantId, tenantId),
          or(
            eq(contractUploadReviews.matchedClientId, contactId),
            eq(contractUploadReviews.linkedClientOverride, contactId),
            sql`${contractUploadReviews.applyResultPayload}->>'createdClientId' = ${contactId}`,
            sql`${contractUploadReviews.applyResultPayload}->>'linkedClientId' = ${contactId}`,
          ),
        ),
      ),
    tx
      .select({
        id: documentExtractions.id,
        documentId: documentExtractions.documentId,
        status: documentExtractions.status,
        extractedAt: documentExtractions.extractedAt,
        createdAt: documentExtractions.createdAt,
      })
      .from(documentExtractions)
      .where(
        and(
          eq(documentExtractions.tenantId, tenantId),
          eq(documentExtractions.contactId, contactId),
        ),
      ),
    tx
      .select()
      .from(clientPaymentSetups)
      .where(
        and(
          eq(clientPaymentSetups.tenantId, tenantId),
          eq(clientPaymentSetups.contactId, contactId),
          ...(options.clientScope ? [eq(clientPaymentSetups.visibleToClient, true)] : []),
        ),
      ),
    tx
      .select()
      .from(consents)
      .where(and(eq(consents.tenantId, tenantId), eq(consents.contactId, contactId))),
    tx
      .select()
      .from(opportunities)
      .where(and(eq(opportunities.tenantId, tenantId), eq(opportunities.contactId, contactId))),
    tx
      .select()
      .from(timelineItems)
      .where(and(eq(timelineItems.tenantId, tenantId), eq(timelineItems.contactId, contactId))),
    tx
      .select()
      .from(userTermsAcceptance)
      .where(
        and(
          eq(userTermsAcceptance.tenantId, tenantId),
          eq(userTermsAcceptance.contactId, contactId),
        ),
      ),
    // portal_feedback je vázané na user_id (advisor), ne na kontakt — do exportu osobních dat nepatří.
    Promise.resolve([] as unknown[]),
    tx
      .select({ userId: clientContacts.userId })
      .from(clientContacts)
      .where(and(eq(clientContacts.tenantId, tenantId), eq(clientContacts.contactId, contactId))),
    tx
      .select()
      .from(advisorProposals)
      .where(and(eq(advisorProposals.tenantId, tenantId), eq(advisorProposals.contactId, contactId))),
    tx
      .select()
      .from(portalNotifications)
      .where(
        and(
          eq(portalNotifications.tenantId, tenantId),
          eq(portalNotifications.contactId, contactId),
        ),
      ),
    options.includeAdvisorAuditMetadata
      ? tx
          .select({
            action: auditLog.action,
            entityType: auditLog.entityType,
            createdAt: auditLog.createdAt,
            userId: auditLog.userId,
          })
          .from(auditLog)
          .where(
            and(
              eq(auditLog.tenantId, tenantId),
              or(
                and(eq(auditLog.entityType, "contact"), eq(auditLog.entityId, contactId)),
                sql`${auditLog.meta}->>'contactId' = ${contactId}`,
              ),
            ),
          )
      : Promise.resolve([] as unknown[]),
  ]);

  const sanitizedContracts = options.clientScope
    ? contractRows.map((c) => ({
        ...c,
        note: null,
        advisorConfirmedAt: null,
        confirmedByUserId: null,
        sourceContractReviewId: null,
        extractionConfidence: null,
      }))
    : contractRows;

  return {
    exportDate: new Date().toISOString(),
    exportScope: options.clientScope
      ? "gdpr_article_15_and_20_client_portal_visibility"
      : "gdpr_article_15_and_20",
    contact: {
      id: contact.id,
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      phone: contact.phone,
      title: contact.title,
      street: contact.street,
      city: contact.city,
      zip: contact.zip,
      birthDate: contact.birthDate,
      // Personal ID / OP: ze šifrovaného úložiště nerozšifrováváme pro export (právní
      // riziko leaky export). Klient má právo znát, že jsme ho uložili, ale obsah zná sám.
      hasPersonalId: contact.personalId !== null || contact.personalIdEnc !== null,
      hasIdCardNumber: contact.idCardNumber !== null || contact.idCardNumberEnc !== null,
      idCardIssuedAt: contact.idCardIssuedAt,
      idCardValidUntil: contact.idCardValidUntil,
      idCardIssuedBy: contact.idCardIssuedBy,
      // B1.3 — `contact.notes` je interní poznámka poradce; v client-scoped
      // exportu (Client Zone self-service) ji vynecháváme. Advisor DSAR si ji
      // může zpřístupnit přes plný export (clientScope=false).
      notes: options.clientScope ? null : contact.notes,
      tags: contact.tags,
      lifecycleStage: contact.lifecycleStage,
      referralSource: contact.referralSource,
      preferredChannel: contact.preferredChannel,
      preferredSalutation: contact.preferredSalutation,
      gdprConsentAt: contact.gdprConsentAt?.toISOString() ?? null,
      notificationUnsubscribedAt: contact.notificationUnsubscribedAt?.toISOString() ?? null,
      doNotEmail: contact.doNotEmail,
      doNotPush: contact.doNotPush,
      createdAt: contact.createdAt?.toISOString() ?? null,
      updatedAt: contact.updatedAt?.toISOString() ?? null,
    },
    contracts: sanitizedContracts,
    documents: docRows.map((d) => ({
      ...d,
      createdAt: d.createdAt?.toISOString() ?? null,
      note: "Samotný obsah souborů lze stáhnout přes Client Zone (signed URL).",
    })),
    messages: messageRows.map((m) => ({
      senderType: m.senderType,
      body: m.body,
      readAt: m.readAt?.toISOString() ?? null,
      createdAt: m.createdAt?.toISOString() ?? null,
    })),
    meetingNotes: meetingNoteRows,
    aiReviews: {
      uploadReviews: uploadReviewRows,
      extractions: extractionRows,
    },
    clientPaymentSetups: clientPaymentSetupRows,
    consents: consentRows,
    termsAcceptance: termsAcceptanceRows,
    opportunities: opportunityRows,
    timeline: timelineRows,
    advisorProposals: advisorProposalRows,
    portalNotifications: portalNotificationRows,
    portalFeedback: portalFeedbackRows,
    portalAccount: clientLinkRows,
    ...(options.includeAdvisorAuditMetadata ? { auditLog: auditLogRows } : {}),
  };
}
