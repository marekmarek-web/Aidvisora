import "server-only";

import { getSubscriptionState } from "@/lib/billing/subscription-state";

export type DunningBanner =
  | { kind: "none" }
  | {
      kind: "past_due_in_grace";
      /** Kolik dnů zbývá do tvrdého suspend (grace end). */
      daysRemaining: number;
    }
  | {
      kind: "past_due_expired";
      /** Kdy uplynula grace period — pro copy „platnost XX". */
      expiredAt: Date;
    }
  | {
      kind: "unpaid";
    };

/**
 * Dunning minimum pro FL-3 launch:
 *
 * - `past_due_in_grace` → měkké upozornění „karta selhala, aktualizujte do X dní".
 * - `past_due_expired` → tvrdé upozornění „platba selhala, funkce omezeny".
 * - `unpaid` → identický tvrdý banner (Stripe pošle subscription do unpaid).
 *
 * Nic jiného už UI neumí — pro launch MVP to stačí. Další stavy (incomplete,
 * canceled) řeší jiné obrazovky (checkout + cancel feedback flow).
 */
export async function resolveDunningBanner(tenantId: string): Promise<DunningBanner> {
  const sub = await getSubscriptionState(tenantId);
  if (!sub.status) return { kind: "none" };
  if (sub.status === "past_due") {
    // B2.9 — banner čerpá daysRemaining z `graceEndsAt`, který je unifikovaný
    // v `getSubscriptionState` (DB column → admin setting → default 7).
    // Dříve jsme zde počítali `currentPeriodEnd + 7d` hardcoded, což se
    // mohlo lišit od toho, co viděl cron / audit log.
    if (sub.inGracePeriod && sub.graceEndsAt) {
      const days = Math.max(
        0,
        Math.ceil((sub.graceEndsAt.getTime() - Date.now()) / 86_400_000),
      );
      return { kind: "past_due_in_grace", daysRemaining: days };
    }
    return {
      kind: "past_due_expired",
      expiredAt: sub.graceEndsAt ?? sub.currentPeriodEnd ?? new Date(),
    };
  }
  if (sub.status === "unpaid") return { kind: "unpaid" };
  return { kind: "none" };
}
