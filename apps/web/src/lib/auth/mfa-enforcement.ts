import "server-only";

import { memberships, and, eq } from "db";
import { createClient } from "@/lib/supabase/server";
import { withTenantContext } from "@/lib/db/with-tenant-context";
import type { RoleName } from "@/shared/rolePermissions";

/**
 * Role, které jsou povinně chráněné MFA po grace period.
 *
 * Z definice nezahrnuje `Client` — klientský portál má vlastní autorizační
 * model a MFA tam není povinné (většina klientů nebude TOTP umět a neprochází
 * přes `/portal/*` trasu).
 */
const MFA_ENFORCED_ROLES: ReadonlySet<RoleName> = new Set<RoleName>([
  "Admin",
  "Director",
  "Manager",
  "Advisor",
]);

/** Grace period default je 14 dní — shoduje se s PB invite / promo code cookie. */
const DEFAULT_GRACE_DAYS = 14;

export type MfaEnforcementDecision =
  | {
      kind: "skip";
      reason: "role_not_enforced" | "grace_period_active" | "already_enrolled" | "disabled";
      gracePeriodEndsAt: Date | null;
    }
  | {
      kind: "enforce";
      gracePeriodEndsAt: Date;
    };

function isEnabledByEnv(): boolean {
  const raw = process.env.MFA_ENFORCE_ADVISORS;
  if (!raw) return false;
  return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
}

function resolveGraceDays(): number {
  const raw = process.env.MFA_ADVISOR_GRACE_DAYS;
  if (!raw) return DEFAULT_GRACE_DAYS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_GRACE_DAYS;
  return Math.min(parsed, 60);
}

/**
 * Rozhodne, zda má layout vynutit MFA enrollment pro daného poradce / admina.
 *
 * Logika:
 * 1. Pokud `MFA_ENFORCE_ADVISORS` env není `true`, vrátíme `skip/disabled`.
 *    → umožňuje rollout „dark launch“ bez nucení stávajících členů.
 * 2. Pokud role nespadá do `MFA_ENFORCED_ROLES`, skip.
 * 3. Pokud TOTP je už zapnuté (supabase `mfa.listFactors()` má ověřený faktor),
 *    skip + poznamenáme (zrcadlí se do `memberships.mfa_enabled` při enrollmentu).
 * 4. Vypočteme `gracePeriodEndsAt = memberships.joined_at + MFA_ADVISOR_GRACE_DAYS`.
 *    - Pokud je teď < gracePeriodEndsAt, skip s důvodem `grace_period_active`.
 *    - Jinak vrátíme `enforce`.
 *
 * Bezpečnostní vlastnosti:
 * - Při selhání čtení (DB / Supabase) nikdy neenforceme → raději přenecháme UX
 *   hladký (user může pokračovat) než sestřelit cele portál. Failure mode je
 *   logovaný do Sentry v volající vrstvě.
 */
export async function resolveAdvisorMfaEnforcement(params: {
  userId: string;
  tenantId: string;
  roleName: RoleName;
}): Promise<MfaEnforcementDecision> {
  if (!isEnabledByEnv()) {
    return { kind: "skip", reason: "disabled", gracePeriodEndsAt: null };
  }
  if (!MFA_ENFORCED_ROLES.has(params.roleName)) {
    return { kind: "skip", reason: "role_not_enforced", gracePeriodEndsAt: null };
  }

  const graceDays = resolveGraceDays();

  const [mem] = await withTenantContext(
    { tenantId: params.tenantId, userId: params.userId },
    (tx) =>
      tx
        .select({ joinedAt: memberships.joinedAt, mfaEnabled: memberships.mfaEnabled })
        .from(memberships)
        .where(
          and(
            eq(memberships.tenantId, params.tenantId),
            eq(memberships.userId, params.userId),
          ),
        )
        .limit(1),
  );

  const joinedAt = mem?.joinedAt ?? new Date();
  const gracePeriodEndsAt = new Date(
    joinedAt.getTime() + graceDays * 24 * 60 * 60 * 1000,
  );

  if (mem?.mfaEnabled === true) {
    return { kind: "skip", reason: "already_enrolled", gracePeriodEndsAt };
  }

  const supabase = await createClient();
  const {
    data: factors,
    error,
  } = await supabase.auth.mfa.listFactors();
  if (error) {
    // Fail-open — raději nenutit než sestřelit portál.
    return { kind: "skip", reason: "already_enrolled", gracePeriodEndsAt };
  }
  const hasVerifiedTotp = (factors?.totp ?? []).some((f) => f.status === "verified");
  if (hasVerifiedTotp) {
    return { kind: "skip", reason: "already_enrolled", gracePeriodEndsAt };
  }

  if (Date.now() < gracePeriodEndsAt.getTime()) {
    return { kind: "skip", reason: "grace_period_active", gracePeriodEndsAt };
  }

  return { kind: "enforce", gracePeriodEndsAt };
}
