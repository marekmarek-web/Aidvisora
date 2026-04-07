/**
 * AI Photo / Image Intake — household / multi-client scope v1 (Phase 8).
 *
 * Extends the existing single-client binding in binding-v2.ts with household
 * awareness. When a resolved clientId belongs to a household, this adapter
 * looks up the other household members and returns structured binding guidance.
 *
 * Design decisions:
 * - Active context (lockedClientId / activeClientId) always wins over household logic
 * - No silent auto-pick of a household member when context is ambiguous
 * - If the primary client is clearly identified (single_client), household info
 *   is informational only — NO extra model call triggered
 * - household_ambiguous is a VALID outcome; caller should surface it to advisor
 * - No new write engine — output is a binding hint, not an action
 *
 * Cost: max 1 DB query per request (household_members join). No model calls.
 *
 * Lane separation: this module is a read-only lookup adapter.
 * It does NOT trigger AI Review, does NOT create actions.
 */

import "server-only";
import { db, households, householdMembers, contacts, eq, and, isNull } from "db";
import type { HouseholdBindingResult, HouseholdMember } from "./types";

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

/**
 * Looks up household context for a resolved client.
 *
 * Returns:
 * - `single_client`       — no household or only one member (common case, fast path)
 * - `household_detected`  — household exists; primary client identified via active context
 * - `household_ambiguous` — multiple members, no clear priority from context
 * - `no_household`        — client not in any household
 *
 * @param tenantId          Tenant scope
 * @param primaryClientId   The already-resolved client (from binding-v2)
 * @param activeClientId    Optional: client from session/UI context (determines priority)
 */
export async function resolveHouseholdBinding(
  tenantId: string,
  primaryClientId: string | null,
  activeClientId?: string | null,
): Promise<HouseholdBindingResult> {
  if (!primaryClientId) {
    return noHousehold(null, null);
  }

  try {
    const rows = await db
      .select({
        householdId: householdMembers.householdId,
        householdName: households.name,
        contactId: householdMembers.contactId,
        role: householdMembers.role,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
      })
      .from(householdMembers)
      .innerJoin(households, eq(householdMembers.householdId, households.id))
      .innerJoin(contacts, eq(householdMembers.contactId, contacts.id))
      .where(
        and(
          eq(contacts.tenantId, tenantId),
          isNull(households.archivedAt),
          isNull(contacts.archivedAt),
          // Filter to households where primaryClientId is a member
          eq(
            householdMembers.householdId,
            // Subquery: find the household(s) the primary client belongs to
            db
              .select({ householdId: householdMembers.householdId })
              .from(householdMembers)
              .where(eq(householdMembers.contactId, primaryClientId))
              .limit(1)
              .as("subq"),
          ),
        ),
      )
      .limit(20);

    if (rows.length === 0) {
      return noHousehold(primaryClientId, null);
    }

    // All rows belong to the same household (we limited to the first household)
    const householdId = rows[0]?.householdId ?? null;
    const householdName = rows[0]?.householdName ?? null;

    const members: HouseholdMember[] = rows.map((r) => ({
      clientId: r.contactId,
      clientLabel: `${r.firstName} ${r.lastName}`.trim(),
      role: r.role ?? null,
      householdId: r.householdId,
      householdName: r.householdName,
    }));

    const otherMembers = members.filter((m) => m.clientId !== primaryClientId);

    // Single member household → single_client
    if (otherMembers.length === 0) {
      return {
        state: "single_client",
        primaryClientId,
        primaryClientLabel: members.find((m) => m.clientId === primaryClientId)?.clientLabel ?? null,
        householdMembers: members,
        confidence: 1.0,
        ambiguityNote: null,
      };
    }

    // Active context explicitly identifies the client → household_detected, not ambiguous
    const contextMatch = activeClientId === primaryClientId;
    if (contextMatch || activeClientId) {
      return {
        state: "household_detected",
        primaryClientId,
        primaryClientLabel: members.find((m) => m.clientId === primaryClientId)?.clientLabel ?? null,
        householdMembers: members,
        confidence: 0.85,
        ambiguityNote:
          otherMembers.length > 0
            ? `Domácnost „${householdName ?? householdId}" má ${otherMembers.length} dalšího člena — aktivní kontext určil prioritu.`
            : null,
      };
    }

    // No active context and multiple members → ambiguous
    return {
      state: "household_ambiguous",
      primaryClientId,
      primaryClientLabel: members.find((m) => m.clientId === primaryClientId)?.clientLabel ?? null,
      householdMembers: members,
      confidence: 0.4,
      ambiguityNote: `Domácnost „${householdName ?? householdId}" má ${members.length} členy — není jasné, ke kterému se vztahuje obrázek. Poradce by měl upřesnit.`,
    };
  } catch {
    // DB error → safe degradation, treat as no household
    return noHousehold(primaryClientId, null);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function noHousehold(
  primaryClientId: string | null,
  primaryClientLabel: string | null,
): HouseholdBindingResult {
  return {
    state: "no_household",
    primaryClientId,
    primaryClientLabel,
    householdMembers: [],
    confidence: 1.0,
    ambiguityNote: null,
  };
}

/**
 * Returns a human-readable preview note for household binding state.
 * Used in response-mapper for preview enrichment.
 */
export function buildHouseholdBindingNote(result: HouseholdBindingResult): string | null {
  switch (result.state) {
    case "single_client":
      return null;
    case "no_household":
      return null;
    case "household_detected":
      return result.ambiguityNote ?? null;
    case "household_ambiguous":
      return result.ambiguityNote ?? "Domácnost s více klienty — upřesněte, ke komu se obrázek vztahuje.";
    default:
      return null;
  }
}
