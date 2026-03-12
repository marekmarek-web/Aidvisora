"use server";

import { requireAuthInAction } from "@/lib/auth/require-auth";
import { db } from "db";
import { advisorPreferences } from "db";
import { eq, and } from "db";
import { getDefaultQuickActionsConfig } from "@/lib/quick-actions";
import { createAdminClient } from "@/lib/supabase/server";

const AVATAR_MAX_SIZE = 3 * 1024 * 1024; // 3 MB
const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export type QuickActionsConfig = {
  order: string[];
  visible: Record<string, boolean>;
};

export async function getQuickActionsConfig(): Promise<QuickActionsConfig> {
  try {
    const auth = await requireAuthInAction();
    const row = await db
      .select({ quickActions: advisorPreferences.quickActions })
      .from(advisorPreferences)
      .where(
        and(
          eq(advisorPreferences.tenantId, auth.tenantId),
          eq(advisorPreferences.userId, auth.userId)
        )
      )
      .limit(1);

    const raw = row[0]?.quickActions;
    if (!raw || typeof raw !== "object" || !("order" in raw) || !Array.isArray((raw as { order?: string[] }).order)) {
      return getDefaultQuickActionsConfig();
    }
    const data = raw as { order: string[]; visible?: Record<string, boolean> };
    const visible = typeof data.visible === "object" && data.visible !== null ? data.visible : {};
    return {
      order: Array.isArray(data.order) ? data.order : getDefaultQuickActionsConfig().order,
      visible,
    };
  } catch {
    return getDefaultQuickActionsConfig();
  }
}

export async function setQuickActionsConfig(
  order: string[],
  visible: Record<string, boolean>
): Promise<void> {
  const auth = await requireAuthInAction();
  const existing = await db
    .select({ id: advisorPreferences.id })
    .from(advisorPreferences)
    .where(
      and(
        eq(advisorPreferences.tenantId, auth.tenantId),
        eq(advisorPreferences.userId, auth.userId)
      )
    )
    .limit(1);

  const quickActions = { order, visible };
  if (existing.length > 0) {
    await db
      .update(advisorPreferences)
      .set({
        quickActions,
        updatedAt: new Date(),
      })
      .where(eq(advisorPreferences.id, existing[0].id));
  } else {
    await db.insert(advisorPreferences).values({
      userId: auth.userId,
      tenantId: auth.tenantId,
      quickActions,
    });
  }
}

export async function getAdvisorAvatarUrl(): Promise<string | null> {
  try {
    const auth = await requireAuthInAction();
    const row = await db
      .select({ avatarUrl: advisorPreferences.avatarUrl })
      .from(advisorPreferences)
      .where(
        and(
          eq(advisorPreferences.tenantId, auth.tenantId),
          eq(advisorPreferences.userId, auth.userId)
        )
      )
      .limit(1);
    return row[0]?.avatarUrl ?? null;
  } catch {
    return null;
  }
}

/** Nahraje profilovou fotku poradce do Storage a uloží URL do advisor_preferences.avatar_url. */
export async function uploadAdvisorAvatar(formData: FormData): Promise<string | null> {
  const auth = await requireAuthInAction();
  const file = formData.get("file") as File | null;
  if (!file?.size) throw new Error("Vyberte obrázek");
  if (file.size > AVATAR_MAX_SIZE) throw new Error("Soubor je příliš velký (max 3 MB)");
  if (!AVATAR_TYPES.includes(file.type)) throw new Error("Povolené formáty: JPEG, PNG, WebP, GIF");
  const ext = file.name.replace(/^.*\./, "") || "jpg";
  const path = `${auth.tenantId}/advisor-avatars/${auth.userId}/${Date.now()}.${ext.replace(/[^a-zA-Z0-9]/g, "")}`;
  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage.from("documents").upload(path, file, { upsert: true });
  if (uploadError) {
    const msg = uploadError.message?.toLowerCase().includes("bucket") || uploadError.message?.toLowerCase().includes("not found")
      ? "Úložiště není nastavené. V Supabase vytvořte bucket „documents“."
      : uploadError.message;
    throw new Error(msg);
  }
  const { data: signedData } = await admin.storage
    .from("documents")
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  let url: string | null = null;
  if (signedData?.signedUrl) {
    url = signedData.signedUrl;
  } else {
    const { data: urlData } = admin.storage.from("documents").getPublicUrl(path);
    url = urlData?.publicUrl ?? null;
  }
  if (url) {
    const existing = await db
      .select({ id: advisorPreferences.id })
      .from(advisorPreferences)
      .where(
        and(
          eq(advisorPreferences.tenantId, auth.tenantId),
          eq(advisorPreferences.userId, auth.userId)
        )
      )
      .limit(1);
    if (existing.length > 0) {
      await db
        .update(advisorPreferences)
        .set({ avatarUrl: url, updatedAt: new Date() })
        .where(eq(advisorPreferences.id, existing[0].id));
    } else {
      await db.insert(advisorPreferences).values({
        userId: auth.userId,
        tenantId: auth.tenantId,
        avatarUrl: url,
      });
    }
  }
  return url;
}
