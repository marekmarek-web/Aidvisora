"use client";

import { useState } from "react";
import { AlertTriangle, CreditCard } from "lucide-react";
import type { DunningBanner } from "@/lib/billing/dunning";

type Props = { state: DunningBanner };

/**
 * FL-3.2 — Dunning banner pro portal. Zobrazuje se jen pokud:
 *   - `past_due_in_grace` — soft reminder, kolik dnů do suspend,
 *   - `past_due_expired` / `unpaid` — hard reminder, funkce omezeny.
 *
 * Klik na „Aktualizovat kartu" otevře nový tab s `/api/stripe/portal`, který
 * uživatele přehodí do Stripe Customer Portalu.
 */
export function PortalDunningBanner({ state }: Props) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (state.kind === "none") return null;

  async function openPortal() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        throw new Error(json.error ?? "Nepodařilo se otevřít správu plateb.");
      }
      window.open(json.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Nepodařilo se otevřít správu plateb.");
    } finally {
      setLoading(false);
    }
  }

  const isSoft = state.kind === "past_due_in_grace";
  const headline =
    state.kind === "past_due_in_grace"
      ? "Poslední platba se nezdařila."
      : "Platba selhala — přístup je omezený.";
  const body =
    state.kind === "past_due_in_grace"
      ? `Zkusili jsme platbu znovu, ale opakovaně selhala. Aktualizujte prosím platební kartu do ${state.daysRemaining} ${
          state.daysRemaining === 1 ? "dne" : state.daysRemaining <= 4 ? "dnů" : "dnů"
        } — poté dočasně vypneme pokročilé funkce.`
      : state.kind === "past_due_expired"
        ? "Grace period vypršela. Pokročilé funkce (AI review, Gmail, týmové přehledy) jsou pozastaveny. Po úhradě se přístup okamžitě obnoví."
        : "Subscription byla převedena do stavu „unpaid“. Po úspěšné úhradě faktury přístup automaticky obnovíme.";

  return (
    <div
      role="alert"
      className={`w-full border-b px-4 py-3 text-sm ${
        isSoft
          ? "border-amber-300/60 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-900/30 dark:text-amber-100"
          : "border-rose-300/60 bg-rose-50 text-rose-900 dark:border-rose-500/40 dark:bg-rose-900/30 dark:text-rose-100"
      }`}
    >
      <div className="mx-auto flex max-w-[1400px] flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-3">
          <AlertTriangle
            size={18}
            className={`shrink-0 ${isSoft ? "text-amber-600 dark:text-amber-300" : "text-rose-600 dark:text-rose-300"}`}
          />
          <div>
            <p className="font-black">{headline}</p>
            <p className="mt-0.5 opacity-90">{body}</p>
            {err ? <p className="mt-1 text-xs font-bold text-rose-700 dark:text-rose-200">{err}</p> : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void openPortal()}
            disabled={loading}
            className={`inline-flex min-h-[40px] items-center gap-2 rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest transition-colors disabled:opacity-60 ${
              isSoft
                ? "bg-amber-600 text-white hover:bg-amber-700"
                : "bg-rose-600 text-white hover:bg-rose-700"
            }`}
          >
            <CreditCard size={14} />
            {loading ? "Otevírám…" : "Aktualizovat kartu"}
          </button>
        </div>
      </div>
    </div>
  );
}
