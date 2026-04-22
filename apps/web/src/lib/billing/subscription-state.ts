import "server-only";

import { subscriptions, eq, desc } from "db";
import { getEffectiveSettingValue } from "@/lib/admin/effective-settings-resolver";
import { withTenantContext } from "@/lib/db/with-tenant-context";
import type { SubscriptionState } from "@/lib/stripe/billing-types";

export type { SubscriptionState } from "@/lib/stripe/billing-types";

const ACTIVE_STATUSES = new Set(["active", "trialing"]);
const PAST_DUE_STATUSES = new Set(["past_due"]);

export async function getSubscriptionState(tenantId: string): Promise<SubscriptionState> {
  const [latestSub] = await withTenantContext({ tenantId }, (tx) =>
    tx
      .select({
        status: subscriptions.status,
        plan: subscriptions.plan,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        gracePeriodEndsAt: subscriptions.gracePeriodEndsAt,
      })
      .from(subscriptions)
      .where(eq(subscriptions.tenantId, tenantId))
      .orderBy(desc(subscriptions.updatedAt))
      .limit(1),
  );

  if (!latestSub) {
    return {
      status: null,
      plan: null,
      currentPeriodEnd: null,
      isActive: false,
      inGracePeriod: false,
      graceEndsAt: null,
    };
  }

  const isActive = ACTIVE_STATUSES.has(latestSub.status);
  const isPastDue = PAST_DUE_STATUSES.has(latestSub.status);

  // B2.9 — jeden zdroj pravdy pro grace datum. Preferujeme DB column
  // (nastavený webhookem při `invoice.payment_failed`); pokud webhook
  // ještě nepřišel nebo běží starší data, fallbackujeme na výpočet
  // `currentPeriodEnd + admin_setting(grace_period_days)` s defaultem 7.
  let graceEndsAt: Date | null = latestSub.gracePeriodEndsAt ?? null;
  if (!graceEndsAt && isPastDue && latestSub.currentPeriodEnd) {
    const graceDays = await getEffectiveSettingValue<number>(tenantId, "billing.grace_period_days");
    graceEndsAt = new Date(
      latestSub.currentPeriodEnd.getTime() + (graceDays ?? 7) * 86_400_000,
    );
  }

  const inGracePeriod =
    isPastDue && graceEndsAt ? new Date() < graceEndsAt : false;

  return {
    status: latestSub.status,
    plan: latestSub.plan,
    currentPeriodEnd: latestSub.currentPeriodEnd,
    isActive,
    inGracePeriod,
    graceEndsAt,
  };
}
