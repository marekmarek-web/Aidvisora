import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Re-auth guard pro citlivé akce (permanent delete, GDPR export, odebrání
 * člena, změna role). Bezpečnost:
 *
 * - Supabase `session.user.last_sign_in_at` říká, kdy se uživatel naposledy
 *   ověřil (password / OAuth / MFA).
 * - Pro high-risk operace vyžadujeme freshness ≤ `maxAgeSeconds` (default 900 s).
 * - Pokud freshness nestačí, hodíme `ReauthRequiredError`. Caller (server
 *   action) ji zpropaguje klientovi, který zobrazí re-auth modal nebo
 *   přesměruje na `/login?reauth=1`.
 *
 * Pozn.: tohle **není** plnohodnotný step-up (AAL1 → AAL2). Pro MFA step-up
 * by bylo potřeba `supabase.auth.mfa.challenge()` flow — zde pouze freshness
 * kontrola, která pokrývá 80 % launch threat modelu (krádež laptopu s
 * otevřenou session, sdílené zařízení).
 */

export class ReauthRequiredError extends Error {
  readonly code = "REAUTH_REQUIRED";
  readonly lastSignInAt: Date | null;
  readonly maxAgeSeconds: number;

  constructor(params: { lastSignInAt: Date | null; maxAgeSeconds: number; action?: string }) {
    super(
      params.action
        ? `Akce "${params.action}" vyžaduje nedávné přihlášení. Přihlaste se prosím znovu.`
        : "Tato akce vyžaduje nedávné přihlášení. Přihlaste se prosím znovu.",
    );
    this.name = "ReauthRequiredError";
    this.lastSignInAt = params.lastSignInAt;
    this.maxAgeSeconds = params.maxAgeSeconds;
  }
}

export function isReauthRequiredError(e: unknown): e is ReauthRequiredError {
  return (
    e instanceof ReauthRequiredError ||
    (typeof e === "object" && e !== null && (e as { code?: unknown }).code === "REAUTH_REQUIRED")
  );
}

export type RequireRecentAuthParams = {
  /** Max. stáří posledního přihlášení v sekundách. Default 15 min. */
  maxAgeSeconds?: number;
  /** Krátký machine-readable klíč akce, který se propaguje do chybové hlášky a auditu. */
  action?: string;
};

export async function requireRecentAuth(params: RequireRecentAuthParams = {}): Promise<{
  lastSignInAt: Date;
  ageSeconds: number;
}> {
  const maxAgeSeconds = params.maxAgeSeconds ?? 900;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new ReauthRequiredError({
      lastSignInAt: null,
      maxAgeSeconds,
      action: params.action,
    });
  }

  const lastSignInRaw = data.user.last_sign_in_at;
  const lastSignInAt = lastSignInRaw ? new Date(lastSignInRaw) : null;
  if (!lastSignInAt || Number.isNaN(lastSignInAt.getTime())) {
    throw new ReauthRequiredError({
      lastSignInAt: null,
      maxAgeSeconds,
      action: params.action,
    });
  }

  const ageSeconds = Math.floor((Date.now() - lastSignInAt.getTime()) / 1000);
  if (ageSeconds > maxAgeSeconds) {
    throw new ReauthRequiredError({
      lastSignInAt,
      maxAgeSeconds,
      action: params.action,
    });
  }
  return { lastSignInAt, ageSeconds };
}

/**
 * Lite varianta — nepovažuje chybějící last_sign_in_at za fatální (pro starší
 * Supabase instance nebo anonymous fallback v demo režimu). Použij v místech,
 * kde chceš jen „best effort" signál, ne tvrdý blok.
 */
export async function checkRecentAuth(params: RequireRecentAuthParams = {}): Promise<
  | { ok: true; ageSeconds: number }
  | { ok: false; reason: "no_session" | "no_last_sign_in" | "too_old"; ageSeconds: number | null }
> {
  const maxAgeSeconds = params.maxAgeSeconds ?? 900;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false, reason: "no_session", ageSeconds: null };
  const lastSignInRaw = data.user.last_sign_in_at;
  const lastSignInAt = lastSignInRaw ? new Date(lastSignInRaw) : null;
  if (!lastSignInAt || Number.isNaN(lastSignInAt.getTime())) {
    return { ok: false, reason: "no_last_sign_in", ageSeconds: null };
  }
  const ageSeconds = Math.floor((Date.now() - lastSignInAt.getTime()) / 1000);
  if (ageSeconds > maxAgeSeconds) return { ok: false, reason: "too_old", ageSeconds };
  return { ok: true, ageSeconds };
}
