import "server-only";

import { tenants, eq } from "db";
import { isInternalAdminUser, isInternalAdminTenant } from "@/lib/billing/internal-admin";
import { getSubscriptionState } from "@/lib/billing/subscription-state";
import { computeEffectiveAccessContext, type EffectiveAccessContext } from "@/lib/billing/access-resolution";
import { withTenantContext } from "@/lib/db/with-tenant-context";

export type { EffectiveAccessContext } from "@/lib/billing/access-resolution";

/**
 * Loads tenant trial + subscription rows and returns {@link EffectiveAccessContext}.
 */
export async function resolveEffectiveAccessContext(params: {
  tenantId: string;
  userId: string;
  email: string | null | undefined;
  now?: Date;
}): Promise<EffectiveAccessContext> {
  const now = params.now ?? new Date();
  const [tenantRow, subscriptionState] = await Promise.all([
    withTenantContext({ tenantId: params.tenantId, userId: params.userId }, (tx) =>
      tx
        .select({
          trialStartedAt: tenants.trialStartedAt,
          trialEndsAt: tenants.trialEndsAt,
          trialPlanKey: tenants.trialPlanKey,
          trialConvertedAt: tenants.trialConvertedAt,
        })
        .from(tenants)
        .where(eq(tenants.id, params.tenantId))
        .limit(1)
        .then((r) => r[0] ?? null),
    ),
    getSubscriptionState(params.tenantId),
  ]);

  const tenantTrial = tenantRow
    ? {
        trialStartedAt: tenantRow.trialStartedAt,
        trialEndsAt: tenantRow.trialEndsAt,
        trialPlanKey: tenantRow.trialPlanKey,
        trialConvertedAt: tenantRow.trialConvertedAt,
      }
    : null;

  const isInternalAdmin =
    isInternalAdminUser({ userId: params.userId, email: params.email }) ||
    isInternalAdminTenant(params.tenantId);

  return computeEffectiveAccessContext({
    now,
    isInternalAdmin,
    subscriptionState,
    tenantTrial,
  });
}
