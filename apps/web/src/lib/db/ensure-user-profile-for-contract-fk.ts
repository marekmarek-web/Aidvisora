import { db } from "db";
import { userProfiles } from "db";

/**
 * FK `contracts.advisor_id` / `contracts.confirmed_by_user_id` → `user_profiles.user_id`.
 * Session user id must exist in `user_profiles` before contract writes — same as manual `createContract`.
 * Idempotent UPSERT; safe for any authenticated advisor id.
 */
export async function ensureUserProfileRowForAdvisor(userId: string): Promise<void> {
  const uid = userId.trim();
  if (!uid) return;
  await db
    .insert(userProfiles)
    .values({
      userId: uid,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userProfiles.userId,
      set: { updatedAt: new Date() },
    });
}

/** User-facing message when Postgres reports advisor-related FK violation on contracts. */
export function formatContractAdvisorFkApplyError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  const isFk =
    lower.includes("foreign key") ||
    lower.includes("violates foreign key") ||
    lower.includes("23503");
  if (!isFk) return raw;
  if (
    lower.includes("advisor_id") ||
    lower.includes("confirmed_by_user_id") ||
    lower.includes("contracts_advisor_id_fkey") ||
    lower.includes("contracts_confirmed_by_user_id_fkey")
  ) {
    return "Účet poradce neodpovídá databázi. Obnovte stránku nebo kontaktujte správce.";
  }
  return raw;
}
