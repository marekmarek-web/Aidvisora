import { db, documents, contracts } from "db";
import { eq, and } from "db";

/**
 * FL-1 — DB-only část linkování souboru z AI review do `contacts.documents`.
 *
 * Slouží k tomu, aby se zápis `documents` + update `contracts.sourceDocumentId`
 * provedl v rámci stejné apply transakce jako vytvoření contact/contract/coverage.
 * Side effects (notifikace klienta, activity log) zůstávají **post-commit** v
 * `contract-review.ts` — nejsou idempotentní a nesmí blokovat commit apply.
 *
 * Vlastnosti:
 *   - Idempotentní přes `(tenantId, contactId, storagePath)`:
 *     duplicitní volání jen obnoví `visibleToClient` / `contractId` pokud chybí.
 *   - Vrací `{ documentId, wasInsert }` pro logiku, která se dopočítává post-commit.
 *   - Bez Storage API volání (soubor už existuje v bucketu z upload flow).
 */
export type ApplyDocumentLinkInput = {
  tenantId: string;
  contactId: string;
  contractId: string | null;
  reviewId: string;
  storagePath: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  uploadedByUserId: string;
  visibleToClient: boolean;
  tx?: typeof db;
};

export type ApplyDocumentLinkResult = {
  documentId: string;
  wasInsert: boolean;
  /** Pokud `true`, nově jsme nastavili `visibleToClient=true` (trigger pro notifikaci post-commit). */
  visibilityTurnedOn: boolean;
};

export async function applyDocumentLinkInTx(
  input: ApplyDocumentLinkInput
): Promise<ApplyDocumentLinkResult> {
  const runner = input.tx ?? db;

  const [dup] = await runner
    .select({ id: documents.id, vis: documents.visibleToClient, contractId: documents.contractId })
    .from(documents)
    .where(
      and(
        eq(documents.tenantId, input.tenantId),
        eq(documents.contactId, input.contactId),
        eq(documents.storagePath, input.storagePath),
      ),
    )
    .limit(1);

  if (dup) {
    const updates: Record<string, unknown> = {};
    const visibilityTurnedOn = input.visibleToClient && !dup.vis;
    if (visibilityTurnedOn) updates.visibleToClient = true;
    if (input.contractId && !dup.contractId) updates.contractId = input.contractId;
    if (Object.keys(updates).length > 0) {
      await runner.update(documents).set(updates).where(eq(documents.id, dup.id));
    }
    return { documentId: dup.id, wasInsert: false, visibilityTurnedOn };
  }

  const [inserted] = await runner
    .insert(documents)
    .values({
      tenantId: input.tenantId,
      contactId: input.contactId,
      contractId: input.contractId ?? null,
      name: input.fileName,
      storagePath: input.storagePath,
      mimeType: input.mimeType ?? "application/pdf",
      sizeBytes: input.sizeBytes ?? null,
      visibleToClient: input.visibleToClient,
      uploadSource: "api",
      uploadedBy: input.uploadedByUserId,
      sourceChannel: "api",
      tags: ["ai-smlouva", `review:${input.reviewId}`],
    })
    .returning({ id: documents.id });

  const newId = inserted?.id ?? "";
  if (!newId) {
    throw new Error("apply_document_link_insert_failed");
  }

  if (input.contractId) {
    const [existingContract] = await runner
      .select({ sourceDocumentId: contracts.sourceDocumentId })
      .from(contracts)
      .where(and(eq(contracts.tenantId, input.tenantId), eq(contracts.id, input.contractId)))
      .limit(1);
    if (existingContract && !existingContract.sourceDocumentId) {
      await runner
        .update(contracts)
        .set({ sourceDocumentId: newId, updatedAt: new Date() })
        .where(and(eq(contracts.tenantId, input.tenantId), eq(contracts.id, input.contractId)));
    }
  }

  return {
    documentId: newId,
    wasInsert: true,
    visibilityTurnedOn: input.visibleToClient,
  };
}
