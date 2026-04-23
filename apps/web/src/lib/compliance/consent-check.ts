import "server-only";

import { consents, processingPurposes, eq, and, isNull, inArray } from "db";
import type { TenantContextDb } from "@/lib/db/with-tenant-context";

/**
 * Ověří, že daný kontakt má aktivní (granted a ne revoked) souhlas
 * pro daný účel zpracování (např. "marketing_emails").
 *
 * Pokud `processing_purposes` row pro tento tenant + name neexistuje, vrací
 * `false` — politika "fail-closed". Seed migrace tohoto řádku by měla proběhnout
 * jako součást B1.2 (viz migrace email-campaigns-marketing-consent).
 */
export async function hasValidConsent(
  tx: TenantContextDb,
  params: { tenantId: string; contactId: string; purposeName: string },
): Promise<boolean> {
  const [purpose] = await tx
    .select({ id: processingPurposes.id })
    .from(processingPurposes)
    .where(
      and(
        eq(processingPurposes.tenantId, params.tenantId),
        eq(processingPurposes.name, params.purposeName),
      ),
    )
    .limit(1);
  if (!purpose) return false;

  const [row] = await tx
    .select({ id: consents.id })
    .from(consents)
    .where(
      and(
        eq(consents.tenantId, params.tenantId),
        eq(consents.contactId, params.contactId),
        eq(consents.purposeId, purpose.id),
        isNull(consents.revokedAt),
      ),
    )
    .limit(1);

  return Boolean(row);
}

/**
 * Bulk varianta pro filtraci seznamu kontaktů — vrací množinu `contactId`,
 * které mají aktivní souhlas. Používá se v queue-enqueue a automation-worker
 * pro odfiltrování kontaktů bez souhlasu jedním dotazem (N+1 guard).
 */
export async function filterContactsWithConsent(
  tx: TenantContextDb,
  params: { tenantId: string; contactIds: string[]; purposeName: string },
): Promise<Set<string>> {
  if (params.contactIds.length === 0) return new Set();

  const [purpose] = await tx
    .select({ id: processingPurposes.id })
    .from(processingPurposes)
    .where(
      and(
        eq(processingPurposes.tenantId, params.tenantId),
        eq(processingPurposes.name, params.purposeName),
      ),
    )
    .limit(1);
  if (!purpose) return new Set();

  const rows = await tx
    .select({ contactId: consents.contactId })
    .from(consents)
    .where(
      and(
        eq(consents.tenantId, params.tenantId),
        eq(consents.purposeId, purpose.id),
        isNull(consents.revokedAt),
        inArray(consents.contactId, params.contactIds),
      ),
    );
  return new Set(rows.map((r) => r.contactId));
}

/**
 * Název účelu zpracování používaný pro marketingové emaily (kampaně, newslettery,
 * year-in-review, referral asks). Udržovaný na jednom místě aby seed / UI / kód
 * nepřestaly být v synci.
 */
export const PURPOSE_MARKETING_EMAILS = "marketing_emails";

/**
 * Pokud tenant nemá consent check zapnutý (legacy importy, interní tenant),
 * lze použít env flag jako kill-switch pro enforcement (soft-launch fáze).
 * `true` = enforcement on (default), `false` = přeskočit filtr (ale stále logovat).
 */
export function isConsentEnforcementEnabled(): boolean {
  const raw = process.env.EMAIL_CONSENT_ENFORCEMENT ?? "true";
  return raw.toLowerCase() !== "false" && raw !== "0";
}
