/**
 * Phase 3: verified write adapters — delegate to server actions + DB with auth checks.
 * Registered with assistant-execution-engine on load.
 */

import { requireAuthInAction } from "@/lib/auth/require-auth";
import { hasPermission, type RoleName } from "@/shared/rolePermissions";
import type { SQL } from "drizzle-orm";
import { contacts, documents, opportunities, opportunityStages, eq, and, asc, contractSegments, or } from "db";
import { withTenantContext } from "@/lib/db/with-tenant-context";
import type { ExecutionStepResult } from "./assistant-domain-model";
import type { ExecutionContext } from "./assistant-execution-engine";
import { registerWriteAdapter } from "./assistant-execution-engine";
import { caseTypeForProductDomain, opportunityTitleFromSlots } from "./assistant-case-type-map";
import { mapErrorForAdvisor } from "./assistant-error-mapping";
import {
  canonicalTaskTitle,
  canonicalClientRequestSubject,
  canonicalMaterialRequestTitle,
  canonicalDealDetailLine,
  canonicalMeetingTitle,
  canonicalPortalMessageTemplate,
} from "./assistant-canonical-names";
import { createOpportunity as createOpportunityAction, updateOpportunity as updateOpportunityAction } from "@/app/actions/pipeline";
import { createTask as createTaskAction, updateTask as updateTaskAction } from "@/app/actions/tasks";
import { createEvent as createEventAction } from "@/app/actions/events";
import { createMeetingNote as createMeetingNoteAction, updateMeetingNote as updateMeetingNoteAction } from "@/app/actions/meeting-notes";
import {
  createAdvisorMaterialRequest,
  linkMaterialRequestDocumentToClientVault,
} from "@/app/actions/advisor-material-requests";
import { updateDocumentVisibleToClient } from "@/app/actions/documents";
import { createPortalNotification } from "@/app/actions/portal-notifications";
import {
  approveContractReview,
  applyContractReviewDrafts,
  linkContractReviewFileToContactDocuments,
} from "@/app/actions/contract-review";
import { createDraft } from "@/app/actions/communication-drafts";
import { createContact as createContactAction, updateContact as updateContactAction } from "@/app/actions/contacts";
import { approveContractForClientPortal, updateContract, createContract as createContractAction } from "@/app/actions/contracts";
import { upsertCoverageItem } from "@/app/actions/coverage";
import { createManualPaymentSetup } from "@/app/actions/manual-payment-setup";
import { sendMessage } from "@/app/actions/messages";
import { createAdvisorClientRequest } from "../assistant/create-advisor-client-request";
import { validatePartnerInCatalog, validateProductInCatalog } from "./ratings/toplists";
import { defaultTaskDueDateYmd } from "@/lib/date/date-only";
import { normalizeCoverageStatus } from "./assistant-coverage-item-resolve";
import { resolveContractSegmentFromUserText, PRODUCT_DOMAIN_DEFAULT_SEGMENT, type ProductDomain } from "./assistant-domain-model";
import { enrichBirthDateFromPersonalIdInParams } from "./czech-personal-id-birth-date";

async function assertCtx(ctx: ExecutionContext): Promise<{
  tenantId: string;
  userId: string;
  roleName: RoleName;
}> {
  const auth = await requireAuthInAction();
  if (auth.tenantId !== ctx.tenantId) {
    throw new Error("Nesoulad workspace.");
  }
  if (auth.userId !== ctx.userId) {
    throw new Error("Nesoulad uživatele.");
  }
  return { tenantId: auth.tenantId, userId: auth.userId, roleName: auth.roleName as RoleName };
}

function okResult(entityId: string, entityType: string, warnings: string[] = []): ExecutionStepResult {
  return { ok: true, outcome: "executed", entityId, entityType, warnings, error: null };
}

function errResult(error: string, retryable = false): ExecutionStepResult {
  return { ok: false, outcome: "failed", entityId: null, entityType: null, warnings: [], error, retryable };
}

function requiresInputResult(error: string): ExecutionStepResult {
  return { ok: false, outcome: "requires_input", entityId: null, entityType: null, warnings: [], error, retryable: true };
}

async function firstPipelineStageId(tenantId: string, userId?: string): Promise<string | null> {
  const rows = await withTenantContext({ tenantId, userId: userId ?? null }, async (tx) => {
    return await tx
      .select({ id: opportunityStages.id })
      .from(opportunityStages)
      .where(eq(opportunityStages.tenantId, tenantId))
      .orderBy(asc(opportunityStages.sortOrder))
      .limit(1);
  });
  return rows[0]?.id ?? null;
}

function safeErr(e: unknown, action: string): ExecutionStepResult {
  return errResult(mapErrorForAdvisor(e instanceof Error ? e.message : "", action, action));
}

function strParam(params: Record<string, unknown>, key: string): string | undefined {
  const v = params[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function hasOwnParam(params: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(params, key);
}

function productDomainFromParams(params: Record<string, unknown>): string | null {
  const d = params.productDomain;
  return typeof d === "string" && d ? d : null;
}

async function assertDocumentWrite(ctx: ExecutionContext) {
  const auth = await assertCtx(ctx);
  if (!hasPermission(auth.roleName, "documents:write")) {
    throw new Error("Chybí oprávnění documents:write.");
  }
  return auth;
}

export function registerAssistantWriteAdapters(): void {
  registerWriteAdapter("createOpportunity", async (params, ctx) => {
    try {
      const auth = await assertCtx(ctx);
      if (!hasPermission(auth.roleName, "opportunities:write")) return errResult("Chybí oprávnění opportunities:write.");
      const contactId = strParam(params, "contactId");
      if (!contactId) return errResult("Chybí contactId.");
      const stageId = strParam(params, "stageId") ?? (await firstPipelineStageId(ctx.tenantId, ctx.userId));
      if (!stageId) return errResult("V workspace není žádný stupeň pipeline.");
      const domain = productDomainFromParams(params);
      const caseType = domain ? caseTypeForProductDomain(domain as never) : strParam(params, "caseType") ?? "jiné";
      const purpose = strParam(params, "purpose");
      const title =
        strParam(params, "title") ??
        opportunityTitleFromSlots({
          productDomain: (domain as never) ?? null,
          purpose,
          taskTitle: strParam(params, "taskTitle"),
          amount: params.amount,
          periodicity: strParam(params, "periodicity"),
        });
      // Canonical detail line stored as aiSubtitle in customFields for board card display
      const aiSubtitle = canonicalDealDetailLine(params as Record<string, unknown>);
      const id = await createOpportunityAction({
        title,
        caseType,
        contactId,
        stageId,
        expectedValue: strParam(params, "expectedValue") ?? (typeof params.amount === "number" ? String(params.amount) : undefined),
        expectedCloseDate: strParam(params, "expectedCloseDate"),
        customFields: aiSubtitle ? { aiSubtitle } : undefined,
      });
      if (!id) return errResult("Obchod se nepodařilo vytvořit.");
      const warnings: string[] = [];
      const ltv = typeof params.ltv === "number" ? params.ltv : null;
      if (ltv !== null && ltv > 90 && domain === "hypo") {
        warnings.push(`LTV ${ltv} % přesahuje 90 % — ověřte bonitu a regulatorní limity.`);
      }
      return okResult(id, "opportunity", warnings);
    } catch (e) {
      return safeErr(e, "createOpportunity");
    }
  });

  registerWriteAdapter("createContact", async (params, ctx) => {
    try {
      enrichBirthDateFromPersonalIdInParams(params);
      const auth = await assertCtx(ctx);
      if (!hasPermission(auth.roleName, "contacts:write")) {
        return errResult("Nemáte oprávnění vytvářet kontakty.");
      }
      const firstName = strParam(params, "firstName");
      const lastName = strParam(params, "lastName");
      if (!firstName || !lastName) {
        return errResult("Chybí jméno nebo příjmení — doplňte je v náhledu kroků.");
      }

      // H3: duplicate detection on (email | phone | personalId) within the tenant.
      // If any matches, return the existing row as an idempotent hit so the planner
      // and multi_action chain attach children to the pre-existing contact instead
      // of creating a second copy.
      const emailRaw = strParam(params, "email")?.toLowerCase() ?? null;
      const phoneRaw = strParam(params, "phone");
      const phoneNormalized = phoneRaw ? phoneRaw.replace(/\s|\.|-/g, "") : null;
      const personalIdRaw = strParam(params, "personalId");
      const personalIdNormalized = personalIdRaw ? personalIdRaw.replace(/\D/g, "") : null;
      const dedupConditions: SQL[] = [];
      if (emailRaw) dedupConditions.push(eq(contacts.email, emailRaw));
      if (phoneNormalized) dedupConditions.push(eq(contacts.phone, phoneNormalized));
      if (personalIdNormalized) dedupConditions.push(eq(contacts.personalId, personalIdNormalized));
      if (dedupConditions.length > 0) {
        const existing = await withTenantContext(
          { tenantId: ctx.tenantId, userId: ctx.userId },
          async (tx) => {
            return await tx
              .select({ id: contacts.id })
              .from(contacts)
              .where(
                and(
                  eq(contacts.tenantId, ctx.tenantId),
                  dedupConditions.length === 1 ? dedupConditions[0]! : or(...dedupConditions),
                ),
              )
              .limit(1);
          },
        );
        if (existing[0]) {
          return {
            ok: true,
            outcome: "idempotent_hit",
            entityId: existing[0].id,
            entityType: "contact",
            warnings: [
              "Kontakt se shodnou e-mailovou adresou / telefonem / rodným číslem už v pracovním prostoru existuje — použila jsem stávající záznam.",
            ],
            error: null,
          };
        }
      }

      const tagsRaw = params.tags;
      const tags =
        Array.isArray(tagsRaw) && tagsRaw.length > 0 && tagsRaw.every((t) => typeof t === "string")
          ? (tagsRaw as string[])
          : undefined;
      const res = await createContactAction({
        firstName,
        lastName,
        email: strParam(params, "email"),
        phone: strParam(params, "phone"),
        title: strParam(params, "title"),
        referralSource: strParam(params, "referralSource"),
        referralContactId: strParam(params, "referralContactId"),
        birthDate: strParam(params, "birthDate"),
        personalId: strParam(params, "personalId"),
        street: strParam(params, "street"),
        city: strParam(params, "city"),
        zip: strParam(params, "zip"),
        tags,
        lifecycleStage: strParam(params, "lifecycleStage"),
        leadSource: strParam(params, "leadSource"),
        leadSourceUrl: strParam(params, "leadSourceUrl"),
        priority: strParam(params, "priority"),
        notes: strParam(params, "notes"),
      });
      if (!res.ok) return errResult(res.message);
      return okResult(res.id, "contact");
    } catch (e) {
      return safeErr(e, "createContact");
    }
  });

  registerWriteAdapter("updateContact", async (params, ctx) => {
    try {
      enrichBirthDateFromPersonalIdInParams(params);
      const auth = await assertCtx(ctx);
      if (!hasPermission(auth.roleName, "contacts:write")) {
        return errResult("Nemáte oprávnění upravovat kontakty.");
      }
      const contactId = strParam(params, "contactId");
      if (!contactId) return errResult("Chybí contactId — nelze aktualizovat kontakt.");
      const patch: Parameters<typeof updateContactAction>[1] = {};
      const patchableFields = [
        "firstName",
        "lastName",
        "email",
        "phone",
        "title",
        "birthDate",
        "personalId",
        "street",
        "city",
        "zip",
      ] as const;
      for (const field of patchableFields) {
        if (!hasOwnParam(params, field)) continue;
        patch[field] = strParam(params, field);
      }
      if (Object.keys(patch).length === 0) {
        return requiresInputResult("Chybí alespoň jeden údaj k aktualizaci kontaktu.");
      }
      await updateContactAction(contactId, patch);
      return okResult(contactId, "contact");
    } catch (e) {
      return safeErr(e, "updateContact");
    }
  });

  /**
   * Service case: creates an opportunity record with service-specific customFields
   * (service_case: true). Requires contactId + subject/description/noteContent.
   * Distinct from createClientRequest (portal-facing) and createOpportunity (new deals).
   */
  registerWriteAdapter("createServiceCase", async (params, ctx) => {
    try {
      const auth = await assertCtx(ctx);
      if (!hasPermission(auth.roleName, "opportunities:write")) return errResult("Chybí oprávnění opportunities:write.");
      const contactId = strParam(params, "contactId");
      if (!contactId) return errResult("Chybí contactId.");
      const subject =
        strParam(params, "subject") ??
        strParam(params, "description") ??
        strParam(params, "noteContent") ??
        strParam(params, "taskTitle");
      if (!subject) return errResult("Chybí popis servisního požadavku (subject, description nebo noteContent).");
      const stageId = strParam(params, "stageId") ?? (await firstPipelineStageId(ctx.tenantId, ctx.userId));
      if (!stageId) return errResult("V workspace není žádný stupeň pipeline.");
      const domain = productDomainFromParams(params);
      const caseType = domain ? caseTypeForProductDomain(domain as never) : strParam(params, "caseType") ?? "servis";
      const title = strParam(params, "title") ?? `Servisní případ: ${subject}`;
      const id = await createOpportunityAction({
        title,
        caseType,
        contactId,
        stageId,
        expectedCloseDate: strParam(params, "expectedCloseDate"),
      });
      if (!id) return errResult("Servisní případ se nepodařilo vytvořit.");
      try {
        await updateOpportunityAction(id, {
          customFields: {
            service_case: true,
            service_case_subject: subject,
            service_case_description: strParam(params, "description") ?? null,
            advisor_created_service_case: true,
          },
        });
      } catch (patchErr) {
        // H6: compensate — a service-case without the marker is just a stray deal.
        // Mark it as service_case=false? Safer: delete the freshly created record so
        // the advisor can retry cleanly.
        try {
          await withTenantContext(
            { tenantId: ctx.tenantId, userId: ctx.userId },
            async (tx) => {
              await tx.delete(opportunities).where(
                and(eq(opportunities.id, id), eq(opportunities.tenantId, ctx.tenantId)),
              );
            },
          );
        } catch {
          /* best-effort compensation */
        }
        return errResult(
          `Servisní případ selhal při zápisu servisního označení. Doporučuji zkusit znovu. (${patchErr instanceof Error ? patchErr.message : "patch_failed"})`,
        );
      }
      return okResult(id, "opportunity", ["Vytvořen servisní případ (obchod v pipeline se servisním označením)."]);
    } catch (e) {
      return safeErr(e, "createServiceCase");
    }
  });

  registerWriteAdapter("updateOpportunity", async (params, ctx) => {
    try {
      const auth = await assertCtx(ctx);
      if (!hasPermission(auth.roleName, "opportunities:write")) return errResult("Chybí oprávnění opportunities:write.");
      const opportunityId = strParam(params, "opportunityId");
      if (!opportunityId) return errResult("Chybí opportunityId.");
      const patch: Parameters<typeof updateOpportunityAction>[1] = {};
      const warnings: string[] = [];

      if (strParam(params, "title")) patch.title = strParam(params, "title");

      const rawCaseType = strParam(params, "caseType");
      const newDomain = productDomainFromParams(params);

      if (rawCaseType && newDomain) {
        // productDomain wins; warn about the conflict so it's auditable.
        warnings.push(
          `Parametry obsahují caseType („${rawCaseType}") i productDomain („${newDomain}"). `
          + "Použit productDomain — caseType byl ignorován.",
        );
      }

      if (newDomain) {
        patch.caseType = caseTypeForProductDomain(newDomain as never);
      } else if (rawCaseType) {
        patch.caseType = rawCaseType;
      }

      // Detect product domain change: if we're updating to a different product type,
      // surface a warning so the advisor is aware of the reclassification.
      if (newDomain && params.previousProductDomain && newDomain !== params.previousProductDomain) {
        warnings.push(
          `Reklasifikace obchodu: ${String(params.previousProductDomain)} → ${newDomain}. `
          + "Ověřte, zda je změna záměrná.",
        );
      }

      if (params.customFields && typeof params.customFields === "object") {
        patch.customFields = params.customFields as Record<string, unknown>;
      }
      if (strParam(params, "stageId")) patch.stageId = strParam(params, "stageId");
      await updateOpportunityAction(opportunityId, patch);
      return okResult(opportunityId, "opportunity", warnings);
    } catch (e) {
      return safeErr(e, "updateOpportunity");
    }
  });

  registerWriteAdapter("createTask", async (params, ctx) => {
    try {
      const auth = await assertCtx(ctx);
      if (!hasPermission(auth.roleName, "tasks:write")) return errResult("Chybí oprávnění tasks:write.");
      const contactId = strParam(params, "contactId");
      if (!contactId) return errResult("Chybí contactId.");
      const title = canonicalTaskTitle({
        action: "createTask",
        productDomain: strParam(params, "productDomain"),
        existingTitle: strParam(params, "taskTitle") ?? strParam(params, "title"),
        purpose: strParam(params, "purpose"),
      });
      const due =
        strParam(params, "resolvedDate") ??
        (typeof params.dueDate === "string" ? params.dueDate : undefined) ??
        strParam(params, "dueDate");
      const id = await createTaskAction({
        title,
        description: strParam(params, "description"),
        contactId,
        dueDate: due && /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : undefined,
        opportunityId: strParam(params, "opportunityId"),
      });
      if (!id) return errResult("Úkol se nepodařilo vytvořit.");
      return okResult(id, "task");
    } catch (e) {
      return safeErr(e, "createTask");
    }
  });

  registerWriteAdapter("updateTask", async (params, ctx) => {
    try {
      const auth = await assertCtx(ctx);
      if (!hasPermission(auth.roleName, "tasks:write")) return errResult("Chybí oprávnění tasks:write.");
      const taskId = strParam(params, "taskId");
      if (!taskId) return errResult("Chybí taskId.");
      // M9: only patch contactId when explicitly provided AND valid. Passing
      // `undefined` would (legitimately) be ignored by the action, but passing
      // a stale/null value from the model would silently reassign the task
      // to a different client or strip its contact binding.
      const patch: Parameters<typeof updateTaskAction>[1] = {
        title: strParam(params, "title"),
        description: strParam(params, "description"),
        dueDate: strParam(params, "dueDate") ?? strParam(params, "resolvedDate"),
        opportunityId: strParam(params, "opportunityId"),
      };
      if (params.contactId !== undefined) {
        const newContactId = strParam(params, "contactId");
        if (newContactId) {
          patch.contactId = newContactId;
        }
        // If contactId was provided but falsy, intentionally DROP it from the
        // patch so the existing value on the task row is preserved.
      }
      await updateTaskAction(taskId, patch);
      return okResult(taskId, "task");
    } catch (e) {
      return safeErr(e, "updateTask");
    }
  });

  registerWriteAdapter("createFollowUp", async (params, ctx) => {
    try {
      const auth = await assertCtx(ctx);
      if (!hasPermission(auth.roleName, "tasks:write")) return errResult("Chybí oprávnění tasks:write.");
      const contactId = strParam(params, "contactId");
      if (!contactId) return errResult("Chybí contactId.");
      const title = canonicalTaskTitle({
        action: "createFollowUp",
        productDomain: strParam(params, "productDomain"),
        existingTitle: strParam(params, "taskTitle") ?? strParam(params, "title"),
        purpose: strParam(params, "purpose"),
      });
      const due =
        strParam(params, "resolvedDate") ??
        (typeof params.dueDate === "string" ? params.dueDate : undefined);
      const id = await createTaskAction({
        title,
        description: strParam(params, "description"),
        contactId,
        dueDate: due && /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : undefined,
        opportunityId: strParam(params, "opportunityId"),
      });
      if (!id) return errResult("Follow-up úkol se nepodařilo vytvořit.");
      return okResult(id, "task");
    } catch (e) {
      return safeErr(e, "createFollowUp");
    }
  });

  registerWriteAdapter("scheduleCalendarEvent", async (params, ctx) => {
    try {
      const auth = await assertCtx(ctx);
      if (!hasPermission(auth.roleName, "events:write")) return errResult("Chybí oprávnění events:write.");
      const contactId = strParam(params, "contactId");
      if (!contactId) return errResult("Chybí contactId.");
      const startAt = strParam(params, "startAt") ?? strParam(params, "resolvedDate");
      if (!startAt) {
        return errResult("Chybí začátek události (ISO 8601 s časovou zónou, např. …+01:00 nebo Z).");
      }
      const title = canonicalMeetingTitle({
        productDomain: productDomainFromParams(params),
        existingTitle: strParam(params, "title") ?? strParam(params, "taskTitle"),
        purpose: strParam(params, "purpose"),
      });
      const id = await createEventAction({
        title,
        startAt,
        endAt: strParam(params, "endAt"),
        contactId,
        opportunityId: strParam(params, "opportunityId"),
        eventType: strParam(params, "eventType") ?? "schuzka",
        notes: strParam(params, "noteContent"),
        location: strParam(params, "location"),
      });
      if (!id) return errResult("Událost se nepodařila vytvořit.");
      return okResult(id, "event");
    } catch (e) {
      return safeErr(e, "scheduleCalendarEvent");
    }
  });

  registerWriteAdapter("createMeetingNote", async (params, ctx) => {
    try {
      const auth = await assertCtx(ctx);
      if (!hasPermission(auth.roleName, "meeting_notes:write")) return errResult("Chybí oprávnění meeting_notes:write.");
      const contactId = strParam(params, "contactId");
      // M8: a meeting note without a contact becomes an orphan that advisors
      // cannot find later and cannot be published to the client. Reject early.
      if (!contactId) {
        return errResult("Zápis musí být přiřazen ke kontaktu. Otevřete kartu klienta nebo upřesněte jméno ve zprávě.");
      }
      const bodyText = strParam(params, "noteContent") ?? "";
      const domain = strParam(params, "noteDomain") ?? "obecne";
      const meetingAt = strParam(params, "meetingAt") ?? new Date().toISOString();
      const id = await createMeetingNoteAction({
        contactId,
        meetingAt,
        domain,
        content: bodyText ? { obsah: bodyText } : { obsah: "" },
        opportunityId: strParam(params, "opportunityId"),
      });
      if (!id) return errResult("Zápis se nepodařil vytvořit.");
      return okResult(id, "meeting_note");
    } catch (e) {
      return safeErr(e, "createMeetingNote");
    }
  });

  registerWriteAdapter("appendMeetingNote", async (params, ctx) => {
    try {
      const auth = await assertCtx(ctx);
      if (!hasPermission(auth.roleName, "meeting_notes:write")) return errResult("Chybí oprávnění meeting_notes:write.");
      const noteId = strParam(params, "meetingNoteId");
      if (!noteId) return errResult("Chybí meetingNoteId.");
      const add = strParam(params, "noteContent") ?? "";
      const { getMeetingNote } = await import("@/app/actions/meeting-notes");
      const existing = await getMeetingNote(noteId);
      if (!existing) return errResult("Zápis nenalezen.");
      const content = (existing.content && typeof existing.content === "object" ? existing.content : {}) as Record<
        string,
        unknown
      >;
      const prev = typeof content.obsah === "string" ? content.obsah : "";
      await updateMeetingNoteAction(noteId, { content: { ...content, obsah: `${prev}\n\n${add}`.trim() } });
      return okResult(noteId, "meeting_note");
    } catch (e) {
      return safeErr(e, "appendMeetingNote");
    }
  });

  registerWriteAdapter("createInternalNote", async (params, ctx) => {
    try {
      const auth = await assertCtx(ctx);
      if (!hasPermission(auth.roleName, "meeting_notes:write")) return errResult("Chybí oprávnění meeting_notes:write.");
      const contactId = strParam(params, "contactId");
      // M8: internal note without a contact cannot be retrieved from a contact
      // timeline — the advisor would silently lose it. Require contactId.
      if (!contactId) {
        return errResult("Interní poznámka musí být přiřazena ke kontaktu. Otevřete kartu klienta nebo upřesněte jméno.");
      }
      const id = await createMeetingNoteAction({
        contactId,
        meetingAt: strParam(params, "meetingAt") ?? new Date().toISOString(),
        domain: "interni",
        content: { obsah: strParam(params, "noteContent") ?? "" },
        opportunityId: strParam(params, "opportunityId"),
      });
      if (!id) return errResult("Interní poznámka se nepodařila.");
      return okResult(id, "meeting_note");
    } catch (e) {
      return safeErr(e, "createInternalNote");
    }
  });

  registerWriteAdapter("attachDocumentToClient", async (params, ctx) => {
    try {
      await assertDocumentWrite(ctx);
      const documentId = strParam(params, "documentId");
      const contactId = strParam(params, "contactId");
      if (!documentId || !contactId) return errResult("Chybí documentId nebo contactId.");
      const rows = await withTenantContext(
        { tenantId: ctx.tenantId, userId: ctx.userId },
        async (tx) => {
          return await tx
            .update(documents)
            .set({ contactId, updatedAt: new Date() })
            .where(and(eq(documents.tenantId, ctx.tenantId), eq(documents.id, documentId)))
            .returning({ id: documents.id });
        },
      );
      if (rows.length === 0) return errResult("Dokument nenalezen nebo nepatří do tohoto workspace.");
      return okResult(documentId, "document");
    } catch (e) {
      return safeErr(e, "attachDocumentToClient");
    }
  });

  registerWriteAdapter("attachDocumentToOpportunity", async (params, ctx) => {
    try {
      await assertDocumentWrite(ctx);
      const documentId = strParam(params, "documentId");
      const opportunityId = strParam(params, "opportunityId");
      if (!documentId || !opportunityId) return errResult("Chybí documentId nebo opportunityId.");
      const contactId = strParam(params, "contactId");
      const rows = await withTenantContext(
        { tenantId: ctx.tenantId, userId: ctx.userId },
        async (tx) => {
          const updatePayload: Record<string, unknown> = { opportunityId, updatedAt: new Date() };
          if (contactId) {
            updatePayload.contactId = contactId;
          } else {
            const oppRows = await tx
              .select({ contactId: opportunities.contactId })
              .from(opportunities)
              .where(and(eq(opportunities.id, opportunityId), eq(opportunities.tenantId, ctx.tenantId)))
              .limit(1);
            if (oppRows[0]?.contactId) {
              updatePayload.contactId = oppRows[0].contactId;
            }
          }
          return await tx
            .update(documents)
            .set(updatePayload)
            .where(and(eq(documents.tenantId, ctx.tenantId), eq(documents.id, documentId)))
            .returning({ id: documents.id });
        },
      );
      if (rows.length === 0) return errResult("Dokument nenalezen nebo nepatří do tohoto workspace.");
      return okResult(documentId, "document");
    } catch (e) {
      return safeErr(e, "attachDocumentToOpportunity");
    }
  });

  registerWriteAdapter("classifyDocument", async (params, ctx) => {
    try {
      await assertDocumentWrite(ctx);
      const documentId = strParam(params, "documentId");
      const documentType = strParam(params, "documentType") ?? strParam(params, "classification");
      if (!documentId || !documentType) return errResult("Chybí documentId nebo documentType.");
      const rows = await withTenantContext(
        { tenantId: ctx.tenantId, userId: ctx.userId },
        async (tx) => {
          return await tx
            .update(documents)
            .set({ documentType, updatedAt: new Date() })
            .where(and(eq(documents.tenantId, ctx.tenantId), eq(documents.id, documentId)))
            .returning({ id: documents.id });
        },
      );
      if (rows.length === 0) return errResult("Dokument nenalezen nebo nepatří do tohoto workspace.");
      return okResult(documentId, "document");
    } catch (e) {
      return safeErr(e, "classifyDocument");
    }
  });

  registerWriteAdapter("triggerDocumentReview", async (params, ctx) => {
    try {
      await assertDocumentWrite(ctx);
      const documentId = strParam(params, "documentId");
      if (!documentId) return errResult("Chybí documentId.");
      const rows = await withTenantContext(
        { tenantId: ctx.tenantId, userId: ctx.userId },
        async (tx) => {
          return await tx
            .update(documents)
            .set({
              businessStatus: "pending_review",
              processingStatus: "review_required",
              updatedAt: new Date(),
            })
            .where(and(eq(documents.tenantId, ctx.tenantId), eq(documents.id, documentId)))
            .returning({ id: documents.id });
        },
      );
      if (rows.length === 0) return errResult("Dokument nenalezen nebo nepatří do tohoto workspace.");
      return okResult(documentId, "document", ["Stav nastaven na kontrolu — dokončete review v UI dokumentů."]);
    } catch (e) {
      return safeErr(e, "triggerDocumentReview");
    }
  });

  registerWriteAdapter("createClientRequest", async (params, ctx) => {
    try {
      const auth = await assertCtx(ctx);
      if (!hasPermission(auth.roleName, "opportunities:write")) return errResult("Chybí oprávnění opportunities:write.");
      const contactId = strParam(params, "contactId");
      if (!contactId) return errResult("Chybí contactId.");
      const domain = productDomainFromParams(params);
      const caseType = domain ? caseTypeForProductDomain(domain as never) : strParam(params, "caseType") ?? "jiné";
      const subject = canonicalClientRequestSubject({
        productDomain: typeof domain === "string" ? domain : null,
        existingSubject: strParam(params, "subject"),
        taskTitle: strParam(params, "taskTitle"),
      });
      const description = strParam(params, "description") ?? strParam(params, "noteContent");
      const res = await createAdvisorClientRequest({
        tenantId: ctx.tenantId,
        userId: auth.userId,
        contactId,
        caseType,
        subject,
        description: description ?? null,
        advisorCreated: true,
      });
      if (!res.ok) return errResult(res.error);
      return okResult(res.id, "opportunity", ["Vytvořen záznam typu klientský požadavek (obchod v pipeline)."]);
    } catch (e) {
      return safeErr(e, "createClientRequest");
    }
  });

  registerWriteAdapter("updateClientRequest", async (params, ctx) => {
    try {
      const auth = await assertCtx(ctx);
      if (!hasPermission(auth.roleName, "opportunities:write")) return errResult("Chybí oprávnění opportunities:write.");
      const opportunityId = strParam(params, "opportunityId");
      if (!opportunityId) return errResult("Chybí opportunityId (klientský požadavek = obchod).");
      const existing = await withTenantContext(
        { tenantId: ctx.tenantId, userId: ctx.userId },
        async (tx) => {
          const [row] = await tx
            .select({ customFields: opportunities.customFields, caseType: opportunities.caseType })
            .from(opportunities)
            .where(and(eq(opportunities.tenantId, ctx.tenantId), eq(opportunities.id, opportunityId)))
            .limit(1);
          return row ?? null;
        },
      );
      if (!existing) return errResult("Obchod nebyl nalezen.");
      const prev = (existing.customFields as Record<string, unknown> | null) ?? {};
      const isPortalRequest =
        prev.client_portal_request === true || prev.client_portal_request === "true";
      if (!isPortalRequest) {
        return errResult(
          "Tato operace je povolena pouze pro klientské požadavky (client_portal_request). Cílový záznam není klientský požadavek — je to obchod nebo servisní případ.",
        );
      }
      const merged: Record<string, unknown> = { ...prev };
      if (strParam(params, "subject")) merged.client_request_subject = strParam(params, "subject");
      if (strParam(params, "description")) merged.client_description = strParam(params, "description");
      await updateOpportunityAction(opportunityId, {
        customFields: merged,
        title: strParam(params, "title"),
      });
      return okResult(opportunityId, "opportunity");
    } catch (e) {
      return safeErr(e, "updateClientRequest");
    }
  });

  registerWriteAdapter("createMaterialRequest", async (params, ctx) => {
    try {
      const auth = await assertCtx(ctx);
      if (!hasPermission(auth.roleName, "documents:write")) return errResult("Chybí oprávnění documents:write.");
      const contactId = strParam(params, "contactId");
      if (!contactId) return errResult("Chybí contactId.");
      const domain = productDomainFromParams(params);
      const title = canonicalMaterialRequestTitle({
        productDomain: typeof domain === "string" ? domain : null,
        existingTitle: strParam(params, "title"),
        taskTitle: strParam(params, "taskTitle"),
      });
      const category = strParam(params, "materialCategory") ?? "ostatni";
      const res = await createAdvisorMaterialRequest({
        contactId,
        category,
        title,
        description: strParam(params, "description") ?? strParam(params, "noteContent"),
        opportunityId: strParam(params, "opportunityId") ?? null,
      });
      if (!res.ok) return errResult(res.error);
      return okResult(res.id, "advisor_material_request");
    } catch (e) {
      return safeErr(e, "createMaterialRequest");
    }
  });

  registerWriteAdapter("publishPortfolioItem", async (params, ctx) => {
    try {
      await assertCtx(ctx);
      const contractId = strParam(params, "contractId");
      if (!contractId) return errResult("Chybí contractId.");
      await approveContractForClientPortal(contractId);
      return okResult(contractId, "contract");
    } catch (e) {
      return safeErr(e, "publishPortfolioItem");
    }
  });

  registerWriteAdapter("updatePortfolioItem", async (params, ctx) => {
    try {
      await assertCtx(ctx);
      const contractId = strParam(params, "contractId");
      if (!contractId) return errResult("Chybí contractId.");
      await updateContract(contractId, {
        visibleToClient: params.visibleToClient === true ? true : params.visibleToClient === false ? false : undefined,
        portfolioStatus: strParam(params, "portfolioStatus"),
        note: strParam(params, "note"),
      });
      return okResult(contractId, "contract");
    } catch (e) {
      return safeErr(e, "updatePortfolioItem");
    }
  });

  registerWriteAdapter("createReminder", async (params, ctx) => {
    try {
      const auth = await assertCtx(ctx);
      if (!hasPermission(auth.roleName, "tasks:write")) return errResult("Chybí oprávnění tasks:write.");
      const contactId = strParam(params, "contactId");
      if (!contactId) return errResult("Chybí contactId.");
      const title = canonicalTaskTitle({
        action: "createReminder",
        productDomain: strParam(params, "productDomain"),
        existingTitle: strParam(params, "taskTitle") ?? strParam(params, "title"),
      });
      const due =
        strParam(params, "resolvedDate") ??
        (typeof params.dueDate === "string" ? params.dueDate : undefined) ??
        defaultTaskDueDateYmd();
      const id = await createTaskAction({
        title,
        contactId,
        dueDate: /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : defaultTaskDueDateYmd(),
      });
      if (!id) return errResult("Připomínka (úkol) se nepodařila.");
      return okResult(id, "task", ["Připomínka uložena jako úkol s termínem."]);
    } catch (e) {
      return safeErr(e, "createReminder");
    }
  });

  registerWriteAdapter("draftEmail", async (params, ctx) => {
    try {
      await assertCtx(ctx);
      const contactId = strParam(params, "contactId");
      if (!contactId) return errResult("Chybí contactId.");
      const row = await createDraft({
        contactId,
        draftType: "email",
        subject: strParam(params, "subject") ?? "Koncept zprávy",
        body: strParam(params, "noteContent") ?? strParam(params, "body") ?? "",
        metadata: { source: "assistant" },
      });
      return okResult(String(row.id), "communication_draft");
    } catch (e) {
      return safeErr(e, "draftEmail");
    }
  });

  registerWriteAdapter("draftClientPortalMessage", async (params, ctx) => {
    try {
      await assertCtx(ctx);
      const contactId = strParam(params, "contactId");
      if (!contactId) return errResult("Chybí contactId.");
      const body = canonicalPortalMessageTemplate({
        productDomain: productDomainFromParams(params),
        existingBody: strParam(params, "noteContent") ?? strParam(params, "body"),
      });
      const row = await createDraft({
        contactId,
        draftType: "client_portal",
        subject: strParam(params, "subject") ?? "Zpráva klientovi",
        body,
        metadata: { source: "assistant" },
      });
      return okResult(String(row.id), "communication_draft");
    } catch (e) {
      return safeErr(e, "draftClientPortalMessage");
    }
  });

  registerWriteAdapter("sendPortalMessage", async (params, ctx) => {
    try {
      const contactId = strParam(params, "contactId");
      const rawBody = strParam(params, "portalMessageBody") ?? strParam(params, "noteContent");
      const body = canonicalPortalMessageTemplate({
        productDomain: productDomainFromParams(params),
        existingBody: rawBody,
      }) || rawBody;
      if (!contactId) return requiresInputResult("Chybí ID klienta (contactId). Vyberte klienta nebo zadejte kontext.");
      if (!body) return requiresInputResult("Chybí text portálové zprávy. Doplňte obsah zprávy.");
      await assertCtx(ctx);
      const id = await sendMessage(contactId, body);
      if (!id) return errResult("Zprávu se nepodařilo odeslat — databáze nevrátila ID.", true);
      return okResult(id, "message");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "Forbidden") return errResult("Nedostatečná oprávnění pro odeslání zprávy.", false);
      if (msg === "Prázdná zpráva") return requiresInputResult("Text zprávy je prázdný. Doplňte obsah.");
      if (msg.includes("Nesoulad")) return errResult("Bezpečnostní nesoulad — ověřte přihlášení.", false);
      return errResult(mapErrorForAdvisor(msg, "sendPortalMessage", "sendPortalMessage"), true);
    }
  });

  registerWriteAdapter("approveAiContractReview", async (params, ctx) => {
    try {
      const auth = await assertCtx(ctx);
      if (!hasPermission(auth.roleName, "ai_review:use")) return errResult("Chybí oprávnění ai_review:use.");
      const reviewId = strParam(params, "reviewId");
      if (!reviewId) return errResult("Chybí reviewId (AI kontrola smlouvy).");
      const res = await approveContractReview(reviewId);
      if (!res.ok) return errResult(res.error);
      return okResult(reviewId, "contract_review");
    } catch (e) {
      return safeErr(e, "approveAiContractReview");
    }
  });

  registerWriteAdapter("applyAiContractReviewToCrm", async (params, ctx) => {
    try {
      const auth = await assertCtx(ctx);
      if (!hasPermission(auth.roleName, "ai_review:use")) return errResult("Chybí oprávnění ai_review:use.");
      const reviewId = strParam(params, "reviewId");
      if (!reviewId) return errResult("Chybí reviewId.");
      const res = await applyContractReviewDrafts(reviewId);
      if (!res.ok) return errResult(res.error);
      return okResult(reviewId, "contract_review", ["Schválená kontrola zapsána do CRM."]);
    } catch (e) {
      return safeErr(e, "applyAiContractReviewToCrm");
    }
  });

  registerWriteAdapter("linkAiContractReviewToDocuments", async (params, ctx) => {
    try {
      const auth = await assertCtx(ctx);
      if (!hasPermission(auth.roleName, "ai_review:use")) return errResult("Chybí oprávnění ai_review:use.");
      const reviewId = strParam(params, "reviewId");
      if (!reviewId) return errResult("Chybí reviewId.");
      const visible = params.visibleToClient === true;
      const res = await linkContractReviewFileToContactDocuments(reviewId, { visibleToClient: visible });
      if (!res.ok) return errResult(res.error);
      const docId = res.documentId ?? reviewId;
      return okResult(docId, "document", visible ? ["Dokument je u klienta viditelný v portálu."] : []);
    } catch (e) {
      return safeErr(e, "linkAiContractReviewToDocuments");
    }
  });

  registerWriteAdapter("setDocumentVisibleToClient", async (params, ctx) => {
    try {
      const auth = await assertCtx(ctx);
      if (!hasPermission(auth.roleName, "documents:write")) return errResult("Chybí oprávnění documents:write.");
      const documentId = strParam(params, "documentId");
      if (!documentId) return errResult("Chybí documentId.");
      const hide = params.visibleToClient === false || strParam(params, "visibleToClient") === "false";
      await updateDocumentVisibleToClient(documentId, !hide);
      return okResult(documentId, "document");
    } catch (e) {
      return safeErr(e, "setDocumentVisibleToClient");
    }
  });

  registerWriteAdapter("linkDocumentToMaterialRequest", async (params, ctx) => {
    try {
      const auth = await assertCtx(ctx);
      if (!hasPermission(auth.roleName, "documents:write")) return errResult("Chybí oprávnění documents:write.");
      const requestId = strParam(params, "materialRequestId");
      const documentId = strParam(params, "documentId");
      if (!requestId || !documentId) return errResult("Chybí materialRequestId nebo documentId.");
      const hide = params.visibleToClient === false || strParam(params, "visibleToClient") === "false";
      const res = await linkMaterialRequestDocumentToClientVault(requestId, documentId, {
        visibleToClient: !hide,
      });
      if (!res.ok) return errResult(res.error);
      return okResult(documentId, "document");
    } catch (e) {
      return safeErr(e, "linkDocumentToMaterialRequest");
    }
  });

  registerWriteAdapter("createClientPortalNotification", async (params, ctx) => {
    try {
      const auth = await assertCtx(ctx);
      // B2.8 — defense-in-depth: notifikaci do klientského portálu může
      // vytvořit jen role s communications:write (Advisor+). Bez tohoto
      // gate mohl Viewer přes AI Drawer tool-call vygenerovat notifikaci
      // bez auditovaného entry-pointu z UI.
      if (!hasPermission(auth.roleName, "communications:write")) {
        return errResult("Chybí oprávnění pro vytvoření notifikace klientovi.");
      }
      const tenantId = auth.tenantId;
      const contactId = strParam(params, "contactId");
      const title = strParam(params, "portalNotificationTitle");
      const body = strParam(params, "portalNotificationBody") ?? null;
      if (!contactId || !title) return errResult("Chybí contactId nebo nadpis notifikace.");
      const allowed = new Set([
        "new_message",
        "request_status_change",
        "new_document",
        "important_date",
        "advisor_material_request",
      ]);
      const typeRaw = strParam(params, "portalNotificationType") ?? "new_message";
      const type = allowed.has(typeRaw)
        ? (typeRaw as
            | "new_message"
            | "request_status_change"
            | "new_document"
            | "important_date"
            | "advisor_material_request")
        : "new_message";
      const inserted = await createPortalNotification({
        tenantId,
        contactId,
        type,
        title,
        body,
        relatedEntityType: strParam(params, "relatedEntityType") ?? null,
        relatedEntityId: strParam(params, "relatedEntityId") ?? null,
      });
      // M6: return the real portal_notification row id so the UI can deep-link
      // into it. Fall back to contactId only if the DB did not return an id
      // (older callers / deduped rows).
      const notificationId = inserted?.id ?? null;
      if (notificationId) {
        return okResult(notificationId, "portal_notification");
      }
      return okResult(contactId, "portal_notification", [
        inserted?.deduped
          ? "Upozornění už existovalo, nové nebylo vytvořeno."
          : "ID notifikace není dostupné — odkaz na detail může chybět.",
      ]);
    } catch (e) {
      return safeErr(e, "createClientPortalNotification");
    }
  });

  registerWriteAdapter("createContract", async (params, ctx) => {
    try {
      await assertCtx(ctx);
      const contactId = strParam(params, "contactId");
      if (!contactId) return errResult("Chybí contactId.");

      let segment = strParam(params, "segment");
      if (!segment) {
        const domain = productDomainFromParams(params) as ProductDomain | null;
        if (domain) segment = PRODUCT_DOMAIN_DEFAULT_SEGMENT[domain] ?? undefined;
      }
      if (!segment) {
        const hint = strParam(params, "purpose") ?? strParam(params, "productDomain");
        if (hint) segment = resolveContractSegmentFromUserText(hint) ?? undefined;
      }
      if (!segment || !contractSegments.includes(segment as (typeof contractSegments)[number])) {
        return requiresInputResult(
          `Neplatný nebo chybějící segment smlouvy${segment ? ` („${segment}")` : ""}. ` +
          `Platné segmenty: ${contractSegments.join(", ")}.`,
        );
      }

      const warnings: string[] = [];
      const partnerName = strParam(params, "partnerName");
      const productName = strParam(params, "productName");

      if (partnerName) {
        const partnerErr = validatePartnerInCatalog(partnerName, segment);
        if (partnerErr) warnings.push(partnerErr);
      }
      if (partnerName && productName) {
        const productErr = validateProductInCatalog(partnerName, productName, segment);
        if (productErr) warnings.push(productErr);
      }

      const premium = strParam(params, "premiumAmount")
        ?? (typeof params.premium === "number" ? String(params.premium) : undefined);

      const res = await createContractAction(contactId, {
        segment,
        partnerName: partnerName ?? undefined,
        productName: productName ?? undefined,
        premiumAmount: premium,
        contractNumber: strParam(params, "contractNumber"),
        startDate: strParam(params, "startDate") ?? strParam(params, "resolvedDate"),
        note: strParam(params, "noteContent") ?? strParam(params, "note"),
      });
      if (!res.ok) return errResult(res.message);
      return okResult(res.id!, "contract", warnings);
    } catch (e) {
      return safeErr(e, "createContract");
    }
  });

  registerWriteAdapter("upsertContactCoverage", async (params, ctx) => {
    try {
      await assertCtx(ctx);
      const contactId = strParam(params, "contactId");
      const itemKey = strParam(params, "itemKey") ?? strParam(params, "coverageItemKey");
      if (!contactId) return errResult("Chybí contactId.");
      if (!itemKey) return errResult("Chybí položka pokrytí (itemKey). Upřesněte produkt (např. ODP, POV, životní pojištění).");

      const rawStatus =
        strParam(params, "status") ?? strParam(params, "coverageStatus") ?? "done";
      const status = normalizeCoverageStatus(rawStatus);

      const res = await upsertCoverageItem(contactId, itemKey, {
        status,
        notes: strParam(params, "noteContent") ?? strParam(params, "notes") ?? null,
        linkedContractId: strParam(params, "linkedContractId") ?? null,
        linkedOpportunityId: strParam(params, "linkedOpportunityId") ?? null,
      });
      if (!res.ok) return errResult(res.message);
      // M7: return the real contact_coverage row id when available so the UI
      // can link to the coverage row, not just the item key slug.
      const coverageRowId = res.id;
      if (coverageRowId) {
        return okResult(coverageRowId, "coverage_item", []);
      }
      return okResult(itemKey, "coverage_item", [
        "ID řádku pokrytí není dostupné — odkaz na detail může chybět.",
      ]);
    } catch (e) {
      return safeErr(e, "upsertContactCoverage");
    }
  });

  registerWriteAdapter("savePaymentSetup", async (params, ctx) => {
    try {
      const auth = await assertCtx(ctx);
      if (!hasPermission(auth.roleName, "contacts:write")) return errResult("Chybí oprávnění contacts:write.");

      const contactId = strParam(params, "contactId");
      if (!contactId) return requiresInputResult("Chybí klient — otevřete detail klienta a zkuste znovu.");

      const providerName = strParam(params, "providerName");
      if (!providerName) return requiresInputResult("Chybí název instituce (providerName). Doplňte ho v poli Instituce.");

      const accountNumber = strParam(params, "accountNumber") ?? strParam(params, "account_number") ?? "";
      const iban = strParam(params, "iban") ?? "";
      const variableSymbol = strParam(params, "variableSymbol") ?? strParam(params, "variable_symbol") ?? "";

      if (!accountNumber && !iban) {
        return requiresInputResult("Chybí číslo účtu nebo IBAN.");
      }
      if (!variableSymbol) {
        return requiresInputResult("Chybí variabilní symbol.");
      }

      const segment = strParam(params, "segment") ?? "other";
      const amount = strParam(params, "amount");
      const frequency = strParam(params, "frequency");
      const firstPaymentDate = strParam(params, "firstPaymentDate") ?? strParam(params, "due_date");
      const constantSymbol = strParam(params, "constantSymbol") ?? strParam(params, "constant_symbol");
      const specificSymbol = strParam(params, "specificSymbol") ?? strParam(params, "specific_symbol");

      const res = await createManualPaymentSetup({
        contactId,
        providerName,
        segment,
        accountNumber,
        iban: iban || undefined,
        variableSymbol,
        constantSymbol: constantSymbol || undefined,
        specificSymbol: specificSymbol || undefined,
        amount: amount || undefined,
        frequency: frequency || undefined,
        firstPaymentDate: firstPaymentDate || undefined,
        visibleToClient: false,
      });

      if (!res.ok) return errResult(res.error);
      return okResult(res.id, "payment_setup", ["Platební instrukce uložena. Viditelnost pro klienta nastavíte ručně v sekci Platby."]);
    } catch (e) {
      return safeErr(e, "savePaymentSetup");
    }
  });
}
