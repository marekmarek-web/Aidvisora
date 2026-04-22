"use server";

import { withAuthContext } from "@/lib/auth/with-auth-context";
import { hasPermission } from "@/lib/auth/permissions";
import { emailContentSources, eq, and, desc } from "db";
import {
  fetchArticleMetadata,
  type ArticleMetadata,
} from "@/lib/email/article-fetcher";

export type ContentSourceRow = {
  id: string;
  url: string;
  canonicalUrl: string | null;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  sourceName: string | null;
  tags: string[];
  isEvergreen: boolean;
  capturedAt: Date;
  lastUsedAt: Date | null;
};

export async function listContentSources(): Promise<ContentSourceRow[]> {
  return withAuthContext(async (auth, tx) => {
    if (!hasPermission(auth.roleName, "contacts:read")) return [];
    const rows = await tx
      .select({
        id: emailContentSources.id,
        url: emailContentSources.url,
        canonicalUrl: emailContentSources.canonicalUrl,
        title: emailContentSources.title,
        description: emailContentSources.description,
        imageUrl: emailContentSources.imageUrl,
        sourceName: emailContentSources.sourceName,
        tags: emailContentSources.tags,
        isEvergreen: emailContentSources.isEvergreen,
        capturedAt: emailContentSources.capturedAt,
        lastUsedAt: emailContentSources.lastUsedAt,
      })
      .from(emailContentSources)
      .where(eq(emailContentSources.tenantId, auth.tenantId))
      .orderBy(desc(emailContentSources.capturedAt))
      .limit(200);
    return rows.map((r) => ({ ...r, tags: r.tags ?? [] }));
  });
}

/** Preview article metadata z URL (fetch + parse). Nic neukládá. */
export async function previewArticleMetadata(url: string): Promise<ArticleMetadata> {
  return withAuthContext(async (auth) => {
    if (!hasPermission(auth.roleName, "contacts:write")) {
      throw new Error("Nemáte oprávnění.");
    }
    return fetchArticleMetadata(url);
  });
}

export async function saveContentSource(input: {
  url: string;
  isEvergreen?: boolean;
  tags?: string[];
  titleOverride?: string | null;
  descriptionOverride?: string | null;
}): Promise<{ id: string }> {
  return withAuthContext(async (auth, tx) => {
    if (!hasPermission(auth.roleName, "contacts:write")) {
      throw new Error("Nemáte oprávnění.");
    }
    const meta = await fetchArticleMetadata(input.url);

    const [inserted] = await tx
      .insert(emailContentSources)
      .values({
        tenantId: auth.tenantId,
        capturedBy: auth.userId,
        url: input.url,
        canonicalUrl: meta.canonicalUrl,
        title: input.titleOverride?.trim() || meta.title,
        description: input.descriptionOverride?.trim() || meta.description,
        imageUrl: meta.imageUrl,
        sourceName: meta.sourceName,
        isEvergreen: !!input.isEvergreen,
        tags: input.tags ?? [],
      })
      .returning({ id: emailContentSources.id });
    return { id: inserted!.id };
  });
}

export async function deleteContentSource(id: string): Promise<{ ok: true }> {
  return withAuthContext(async (auth, tx) => {
    if (!hasPermission(auth.roleName, "contacts:write")) {
      throw new Error("Nemáte oprávnění.");
    }
    await tx
      .delete(emailContentSources)
      .where(
        and(eq(emailContentSources.id, id), eq(emailContentSources.tenantId, auth.tenantId)),
      );
    return { ok: true };
  });
}

export async function markContentSourceUsed(id: string): Promise<{ ok: true }> {
  return withAuthContext(async (auth, tx) => {
    if (!hasPermission(auth.roleName, "contacts:write")) {
      return { ok: true as const };
    }
    await tx
      .update(emailContentSources)
      .set({ lastUsedAt: new Date() })
      .where(
        and(eq(emailContentSources.id, id), eq(emailContentSources.tenantId, auth.tenantId)),
      );
    return { ok: true };
  });
}
