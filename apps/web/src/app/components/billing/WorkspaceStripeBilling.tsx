"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CreditCard } from "lucide-react";
import type {
  CheckoutCatalogSnapshot,
  PlanInterval,
  PlanTier,
  StripeBillingContext,
  WorkspaceBillingSnapshot,
} from "@/lib/stripe/billing-types";

type Props = {
  billing: WorkspaceBillingSnapshot | undefined;
  billingContext: StripeBillingContext;
  /** Výchozí true – v Nastavení často false (vlastní nadpis karty). */
  showTitle?: boolean;
  className?: string;
};

const TIER_COPY: Record<
  PlanTier,
  { title: string; blurb: string; monthKc: number; yearKc: number }
> = {
  starter: {
    title: "Starter",
    blurb: "1 uživatel · AI review smluv · kalkulačky",
    monthKc: 1490,
    yearKc: 14304,
  },
  pro: {
    title: "Pro",
    blurb: "Klientská zóna · finanční analýzy · pokročilé AI",
    monthKc: 1990,
    yearKc: 19104,
  },
  team: {
    title: "Team",
    blurb: "Vše z Pro · tým · sdílení · manažerské přehledy",
    monthKc: 2490,
    yearKc: 23904,
  },
};

function firstTierSupporting(
  catalog: CheckoutCatalogSnapshot,
  interval: PlanInterval
): PlanTier | null {
  for (const row of catalog.tiers) {
    if (interval === "month" && row.month) return row.tier;
    if (interval === "year" && row.year) return row.tier;
  }
  return null;
}

function tierSupports(catalog: CheckoutCatalogSnapshot, tier: PlanTier, interval: PlanInterval): boolean {
  const row = catalog.tiers.find((t) => t.tier === tier);
  if (!row) return false;
  return interval === "month" ? row.month : row.year;
}

type StripeRoutePayload = { url?: string; error?: string; detail?: string };

async function parseStripeRouteResponse(res: Response): Promise<StripeRoutePayload & { httpOk: boolean }> {
  const text = await res.text();
  if (!text.trim()) {
    return {
      httpOk: res.ok,
      error: res.ok ? undefined : `Prázdná odpověď serveru (HTTP ${res.status}).`,
    };
  }
  try {
    const data = JSON.parse(text) as StripeRoutePayload;
    return { httpOk: res.ok, url: data.url, error: data.error, detail: data.detail };
  } catch {
    return {
      httpOk: false,
      error:
        res.status >= 500
          ? "Server vrátil neočekávanou odpověď. Zkontrolujte log vývoje nebo nasazení."
          : `Neplatná odpověď serveru (HTTP ${res.status}).`,
    };
  }
}

function formatStripeClientError(data: StripeRoutePayload): string {
  const parts = [data.error, data.detail].filter((s): s is string => Boolean(s?.trim()));
  return parts.join(" — ") || "Požadavek se nepodařilo dokončit.";
}

export function WorkspaceStripeBilling({
  billing,
  billingContext,
  showTitle = true,
  className = "",
}: Props) {
  const searchParams = useSearchParams();
  const billingQuery = searchParams.get("billing");
  const [billingAction, setBillingAction] = useState<null | "checkout" | "portal">(null);
  const [billingError, setBillingError] = useState<string | null>(null);

  const cat = billing?.checkoutCatalog;
  const usePicker = Boolean(cat?.useTierPicker);

  const [interval, setInterval] = useState<PlanInterval>("month");
  const [tier, setTier] = useState<PlanTier>("pro");

  useEffect(() => {
    if (!cat || !usePicker) return;
    const t = firstTierSupporting(cat, interval);
    if (t) setTier(t);
  }, [cat, usePicker, interval]);

  useEffect(() => {
    if (!cat || !usePicker) return;
    if (!tierSupports(cat, tier, interval)) {
      const t = firstTierSupporting(cat, interval);
      if (t) setTier(t);
    }
  }, [cat, usePicker, tier, interval]);

  const canSubmitCheckout = useMemo(() => {
    if (!billing?.checkoutAvailable) return false;
    if (!cat) return false;
    if (!usePicker) return true;
    return tierSupports(cat, tier, interval);
  }, [billing?.checkoutAvailable, cat, usePicker, tier, interval]);

  if (!billing) return null;

  async function startStripeCheckout() {
    setBillingError(null);
    setBillingAction("checkout");
    try {
      const payload: Record<string, unknown> = { billingContext };
      if (usePicker) {
        payload.tier = tier;
        payload.interval = interval;
      }
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await parseStripeRouteResponse(res);
      if (!data.httpOk || !data.url) {
        setBillingError(formatStripeClientError(data));
        return;
      }
      window.location.href = data.url;
    } catch {
      setBillingError("Síťová chyba.");
    } finally {
      setBillingAction(null);
    }
  }

  async function openStripePortal() {
    setBillingError(null);
    setBillingAction("portal");
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billingContext }),
      });
      const data = await parseStripeRouteResponse(res);
      if (!data.httpOk || !data.url) {
        setBillingError(formatStripeClientError(data));
        return;
      }
      window.location.href = data.url;
    } catch {
      setBillingError("Síťová chyba.");
    } finally {
      setBillingAction(null);
    }
  }

  const trialDays = cat?.trialPeriodDays ?? 14;

  return (
    <div className={`space-y-4 ${className}`.trim()}>
      {showTitle ? (
        <div className="flex items-center gap-3">
          <CreditCard size={24} className="text-slate-400 shrink-0" />
          <h3 className="text-base font-black text-slate-900">Předplatné Aidvisora</h3>
        </div>
      ) : null}
      {billingQuery === "success" ? (
        <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
          Platba proběhla. Stav předplatného se během chvile aktualizuje po potvrzení ze Stripe.
        </p>
      ) : null}
      {billingQuery === "cancel" ? (
        <p className="text-sm text-amber-900 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
          Checkout byl zrušen. Můžete to zkusit znovu kdykoli.
        </p>
      ) : null}
      {billingError ? (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{billingError}</p>
      ) : null}
      {trialDays > 0 && billing.checkoutAvailable ? (
        <p className="text-sm text-slate-600 max-w-xl">
          <span className="font-semibold text-slate-800">{trialDays} dní zdarma</span>, poté pravidelné účtování
          podle zvoleného tarifu ve Stripe.
        </p>
      ) : null}
      <dl className="grid gap-2 text-sm text-slate-600 max-w-xl">
        <div className="flex flex-wrap gap-x-2">
          <dt className="font-semibold text-slate-700">Stav</dt>
          <dd>{billing.subscriptionStatus ?? "—"}</dd>
        </div>
        {billing.plan ? (
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-semibold text-slate-700">Plán</dt>
            <dd>{billing.plan}</dd>
          </div>
        ) : null}
        {billing.currentPeriodEnd ? (
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-semibold text-slate-700">Aktuální období do</dt>
            <dd>
              {new Date(billing.currentPeriodEnd).toLocaleDateString("cs-CZ", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </dd>
          </div>
        ) : null}
      </dl>

      {usePicker && cat ? (
        <div className="space-y-4 max-w-2xl">
          <div className="flex flex-wrap gap-2 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setInterval("month")}
              disabled={!cat.tiers.some((r) => r.month)}
              className={`flex-1 min-h-[44px] px-4 rounded-lg text-sm font-bold transition-colors ${
                interval === "month"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900 disabled:opacity-40"
              }`}
            >
              Měsíčně
            </button>
            <button
              type="button"
              onClick={() => setInterval("year")}
              disabled={!cat.tiers.some((r) => r.year)}
              className={`flex-1 min-h-[44px] px-4 rounded-lg text-sm font-bold transition-colors ${
                interval === "year"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900 disabled:opacity-40"
              }`}
            >
              Ročně <span className="text-emerald-600 font-black">−20 %</span>
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {cat.tiers.map((row) => {
              const ok = interval === "month" ? row.month : row.year;
              const copy = TIER_COPY[row.tier];
              const kc = interval === "month" ? copy.monthKc : copy.yearKc;
              const suffix = interval === "month" ? "Kč / měs." : "Kč / rok";
              const selected = tier === row.tier && ok;
              return (
                <button
                  key={row.tier}
                  type="button"
                  disabled={!ok}
                  onClick={() => ok && setTier(row.tier)}
                  className={`text-left rounded-2xl border p-4 min-h-[44px] transition-colors ${
                    selected
                      ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/20"
                      : ok
                        ? "border-slate-200 bg-white hover:border-slate-300"
                        : "border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed"
                  }`}
                >
                  <div className="font-black text-slate-900">{copy.title}</div>
                  <div className="text-lg font-black text-indigo-700 mt-1">
                    {kc.toLocaleString("cs-CZ")} {suffix}
                  </div>
                  <p className="text-xs text-slate-500 mt-2 leading-snug">{copy.blurb}</p>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {!billing.canManage ? (
        <p className="text-sm text-slate-500 max-w-xl">
          Předplatné může spravovat administrátor nebo ředitel workspace.
        </p>
      ) : (
        <div className="flex flex-col sm:flex-row flex-wrap gap-3">
          {billing.checkoutAvailable ? (
            <button
              type="button"
              onClick={() => void startStripeCheckout()}
              disabled={billingAction !== null || !canSubmitCheckout}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors min-h-[44px] disabled:opacity-60"
            >
              <CreditCard size={18} />
              {billingAction === "checkout" ? "Přesměrování…" : "Zahájit předplatné"}
            </button>
          ) : (
            <p className="text-sm text-slate-500 self-center max-w-md">
              Nové předplatné není nakonfigurováno: nastavte{" "}
              <code className="text-xs bg-slate-100 px-1 rounded">STRIPE_SECRET_KEY</code> a buď šest proměnných{" "}
              <code className="text-xs bg-slate-100 px-1 rounded">STRIPE_PRICE_*_*</code>, nebo legacy{" "}
              <code className="text-xs bg-slate-100 px-1 rounded">STRIPE_PRICE_ID</code>.
            </p>
          )}
          {billing.portalAvailable ? (
            <button
              type="button"
              onClick={() => void openStripePortal()}
              disabled={billingAction !== null}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-800 border border-slate-200 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors min-h-[44px] disabled:opacity-60"
            >
              Spravovat platby a faktury
            </button>
          ) : billing.stripeCustomerId ? null : (
            <p className="text-sm text-slate-500 self-center">
              Customer Portal je dostupný po prvním dokončeném předplatném.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
