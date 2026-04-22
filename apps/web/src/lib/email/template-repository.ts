import "server-only";

import { withAuthContext, withTenantContextFromAuth } from "@/lib/auth/with-auth-context";
import { hasPermission } from "@/lib/auth/permissions";
import { emailTemplates, eq, and, or, isNull, desc, asc, sql, inArray } from "db";

export type EmailTemplateKind =
  | "blank"
  | "birthday"
  | "newsletter"
  | "consultation"
  | "year_in_review"
  | "referral_ask"
  | "newsletter_weekly"
  | "custom";

export type EmailTemplateRow = {
  id: string;
  tenantId: string | null;
  name: string;
  kind: EmailTemplateKind;
  category: string | null;
  subject: string;
  preheader: string | null;
  bodyHtml: string;
  thumbnailUrl: string | null;
  mergeFields: string[];
  iconName: string | null;
  accentClass: string | null;
  styleKey: string | null;
  description: string | null;
  complianceNote: string | null;
  isArchived: boolean;
  isSystem: boolean;
  isGlobal: boolean;
  sortOrder: number;
};

/**
 * Vrací všechny dostupné šablony pro aktuální tenant:
 *  - globální (tenant_id IS NULL, is_archived=false)
 *  - + per-tenant (tenant_id = auth.tenantId, is_archived=false)
 *
 * Řadí systémové nahoru, pak per-tenant custom (nejnovější první).
 */
export async function listAvailableTemplates(): Promise<EmailTemplateRow[]> {
  return withAuthContext(async (auth, tx) => {
    if (!hasPermission(auth.roleName, "contacts:read")) {
      throw new Error("Nemáte oprávnění.");
    }
    const rows = await tx
      .select()
      .from(emailTemplates)
      .where(
        and(
          eq(emailTemplates.isArchived, false),
          or(isNull(emailTemplates.tenantId), eq(emailTemplates.tenantId, auth.tenantId)),
        ),
      )
      .orderBy(desc(emailTemplates.isSystem), asc(emailTemplates.sortOrder), desc(emailTemplates.createdAt));

    return rows.map(mapTemplateRow);
  });
}

export async function getTemplateById(id: string): Promise<EmailTemplateRow | null> {
  return withAuthContext(async (auth, tx) => {
    if (!hasPermission(auth.roleName, "contacts:read")) return null;
    const [row] = await tx
      .select()
      .from(emailTemplates)
      .where(
        and(
          eq(emailTemplates.id, id),
          or(isNull(emailTemplates.tenantId), eq(emailTemplates.tenantId, auth.tenantId)),
        ),
      )
      .limit(1);
    return row ? mapTemplateRow(row) : null;
  });
}

export async function getTemplateByKind(
  kind: EmailTemplateKind,
): Promise<EmailTemplateRow | null> {
  return withAuthContext(async (auth, tx) => {
    if (!hasPermission(auth.roleName, "contacts:read")) return null;
    // Per-tenant override vyhrává nad globální systémovou šablonou.
    const rows = await tx
      .select()
      .from(emailTemplates)
      .where(
        and(
          eq(emailTemplates.kind, kind),
          eq(emailTemplates.isArchived, false),
          or(isNull(emailTemplates.tenantId), eq(emailTemplates.tenantId, auth.tenantId)),
        ),
      )
      .orderBy(desc(emailTemplates.tenantId), asc(emailTemplates.sortOrder))
      .limit(1);
    const first = rows[0];
    return first ? mapTemplateRow(first) : null;
  });
}

/**
 * Uloží kampaň jako per-tenant šablonu (user-initiated "Save as template").
 */
export async function saveCampaignAsTemplate(input: {
  name: string;
  subject: string;
  preheader?: string | null;
  bodyHtml: string;
  kind?: EmailTemplateKind;
  description?: string;
}): Promise<{ id: string }> {
  return withAuthContext(async (auth, tx) => {
    if (!hasPermission(auth.roleName, "contacts:write")) {
      throw new Error("Nemáte oprávnění ukládat šablony.");
    }
    const name = input.name.trim();
    const subject = input.subject.trim();
    const bodyHtml = input.bodyHtml.trim();
    if (!name || !bodyHtml) throw new Error("Název a tělo šablony jsou povinné.");

    const [row] = await tx
      .insert(emailTemplates)
      .values({
        tenantId: auth.tenantId,
        name,
        kind: input.kind ?? "custom",
        subject,
        preheader: input.preheader?.trim() || null,
        bodyHtml,
        description: input.description?.trim() || null,
        mergeFields: extractMergeFields(bodyHtml, subject),
        isSystem: false,
        createdByUserId: auth.userId,
      })
      .returning({ id: emailTemplates.id });
    if (!row) throw new Error("Šablonu se nepodařilo uložit.");
    return { id: row.id };
  });
}

export async function archiveTemplate(id: string): Promise<{ ok: true }> {
  return withAuthContext(async (auth, tx) => {
    if (!hasPermission(auth.roleName, "contacts:write")) {
      throw new Error("Nemáte oprávnění archivovat šablony.");
    }
    await tx
      .update(emailTemplates)
      .set({ isArchived: true, updatedAt: new Date() })
      .where(and(eq(emailTemplates.id, id), eq(emailTemplates.tenantId, auth.tenantId)));
    return { ok: true as const };
  });
}

/** Service-level (cron/worker) variant: vrátí šablonu podle kind bez auth. */
export async function getSystemTemplate(
  tenantId: string,
  kind: EmailTemplateKind,
): Promise<EmailTemplateRow | null> {
  return withTenantContextFromAuth({ tenantId }, async (tx) => {
    const rows = await tx
      .select()
      .from(emailTemplates)
      .where(
        and(
          eq(emailTemplates.kind, kind),
          eq(emailTemplates.isArchived, false),
          or(isNull(emailTemplates.tenantId), eq(emailTemplates.tenantId, tenantId)),
        ),
      )
      .orderBy(desc(emailTemplates.tenantId), asc(emailTemplates.sortOrder))
      .limit(1);
    return rows[0] ? mapTemplateRow(rows[0]) : null;
  });
}

/** Vytvoří per-tenant copy globální šablony (pro editaci). */
export async function cloneGlobalTemplateToTenant(
  globalTemplateId: string,
  overrideName?: string,
): Promise<{ id: string }> {
  return withAuthContext(async (auth, tx) => {
    if (!hasPermission(auth.roleName, "contacts:write")) {
      throw new Error("Nemáte oprávnění klonovat šablony.");
    }
    const [src] = await tx
      .select()
      .from(emailTemplates)
      .where(and(eq(emailTemplates.id, globalTemplateId), isNull(emailTemplates.tenantId)))
      .limit(1);
    if (!src) throw new Error("Globální šablona nebyla nalezena.");

    const [row] = await tx
      .insert(emailTemplates)
      .values({
        tenantId: auth.tenantId,
        name: overrideName?.trim() || `${src.name} (kopie)`,
        kind: src.kind,
        category: src.category,
        subject: src.subject,
        preheader: src.preheader,
        bodyHtml: src.bodyHtml,
        mergeFields: src.mergeFields,
        iconName: src.iconName,
        accentClass: src.accentClass,
        styleKey: src.styleKey,
        description: src.description,
        complianceNote: src.complianceNote,
        isSystem: false,
        createdByUserId: auth.userId,
      })
      .returning({ id: emailTemplates.id });
    if (!row) throw new Error("Klonování selhalo.");
    return { id: row.id };
  });
}

// ── helpers ─────────────────────────────────────────────────────────────────

function mapTemplateRow(row: typeof emailTemplates.$inferSelect): EmailTemplateRow {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    kind: row.kind as EmailTemplateKind,
    category: row.category,
    subject: row.subject,
    preheader: row.preheader,
    bodyHtml: row.bodyHtml,
    thumbnailUrl: row.thumbnailUrl,
    mergeFields: row.mergeFields ?? [],
    iconName: row.iconName,
    accentClass: row.accentClass,
    styleKey: row.styleKey,
    description: row.description,
    complianceNote: row.complianceNote,
    isArchived: row.isArchived,
    isSystem: row.isSystem,
    isGlobal: row.tenantId === null,
    sortOrder: row.sortOrder,
  };
}

/** Vytáhne {{merge_field}} placeholdery pro UI preview merge fields. */
function extractMergeFields(...sources: string[]): string[] {
  const found = new Set<string>();
  const re = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;
  for (const s of sources) {
    for (const m of s.matchAll(re)) {
      found.add(m[1]!.toLowerCase());
    }
  }
  return Array.from(found).sort();
}
