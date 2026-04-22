"use server";

import { requireAuthInAction } from "@/lib/auth/require-auth";
import { withTenantContextFromAuth } from "@/lib/auth/with-auth-context";
import { boardLabels, eq, and, asc } from "db";

export type BoardLabelDto = {
  id: string;
  label: string;
  color: string;
  isClosedDeal: boolean;
  sortIndex: number;
};

/** Načte všechny štítky Boardu pro aktuální tenant, seřazené podle `sort_index` a času vytvoření. */
export async function listBoardLabels(): Promise<BoardLabelDto[]> {
  const auth = await requireAuthInAction();
  const rows = await withTenantContextFromAuth(auth, (tx) =>
    tx
      .select({
        id: boardLabels.id,
        name: boardLabels.name,
        color: boardLabels.color,
        isClosedDeal: boardLabels.isClosedDeal,
        sortIndex: boardLabels.sortIndex,
      })
      .from(boardLabels)
      .where(eq(boardLabels.tenantId, auth.tenantId))
      .orderBy(asc(boardLabels.sortIndex), asc(boardLabels.createdAt)),
  );
  return rows.map((r) => ({
    id: r.id,
    label: r.name ?? "",
    color: r.color,
    isClosedDeal: Boolean(r.isClosedDeal),
    sortIndex: r.sortIndex ?? 0,
  }));
}

export type UpsertBoardLabelInput = {
  id: string;
  label?: string | null;
  color: string;
  isClosedDeal?: boolean;
  sortIndex?: number;
};

/** Idempotentní upsert — `id` zachováváme z klienta (label_<timestamp>). */
export async function upsertBoardLabel(input: UpsertBoardLabelInput): Promise<BoardLabelDto> {
  if (!input.id || !input.color) {
    throw new Error("Chybí ID nebo barva štítku.");
  }
  const auth = await requireAuthInAction();
  const row = await withTenantContextFromAuth(auth, async (tx) => {
    const [existing] = await tx
      .select()
      .from(boardLabels)
      .where(and(eq(boardLabels.id, input.id), eq(boardLabels.tenantId, auth.tenantId)))
      .limit(1);

    const name = (input.label ?? "").toString();
    const color = input.color.toString();
    const sortIndex = typeof input.sortIndex === "number" ? input.sortIndex : existing?.sortIndex ?? 0;
    const isClosedDeal = typeof input.isClosedDeal === "boolean" ? input.isClosedDeal : Boolean(existing?.isClosedDeal);

    if (existing) {
      const [updated] = await tx
        .update(boardLabels)
        .set({ name, color, isClosedDeal, sortIndex, updatedAt: new Date() })
        .where(and(eq(boardLabels.id, input.id), eq(boardLabels.tenantId, auth.tenantId)))
        .returning();
      return updated;
    }

    const [inserted] = await tx
      .insert(boardLabels)
      .values({
        id: input.id,
        tenantId: auth.tenantId,
        name,
        color,
        isClosedDeal,
        sortIndex,
      })
      .returning();
    return inserted;
  });
  return {
    id: row.id,
    label: row.name ?? "",
    color: row.color,
    isClosedDeal: Boolean(row.isClosedDeal),
    sortIndex: row.sortIndex ?? 0,
  };
}

/** Bulk upload — používá se pro one-time seed z `localStorage` při prvním načtení, když DB vrátí prázdno. */
export async function bulkUpsertBoardLabels(inputs: UpsertBoardLabelInput[]): Promise<void> {
  if (!inputs.length) return;
  const auth = await requireAuthInAction();
  await withTenantContextFromAuth(auth, async (tx) => {
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      if (!input?.id || !input.color) continue;
      const name = (input.label ?? "").toString();
      const color = input.color.toString();
      const sortIndex = typeof input.sortIndex === "number" ? input.sortIndex : i;
      const isClosedDeal = Boolean(input.isClosedDeal);
      await tx
        .insert(boardLabels)
        .values({
          id: input.id,
          tenantId: auth.tenantId,
          name,
          color,
          isClosedDeal,
          sortIndex,
        })
        .onConflictDoUpdate({
          target: boardLabels.id,
          set: { name, color, isClosedDeal, sortIndex, updatedAt: new Date() },
        });
    }
  });
}

export async function deleteBoardLabel(id: string): Promise<void> {
  if (!id) return;
  const auth = await requireAuthInAction();
  await withTenantContextFromAuth(auth, (tx) =>
    tx
      .delete(boardLabels)
      .where(and(eq(boardLabels.id, id), eq(boardLabels.tenantId, auth.tenantId))),
  );
}
