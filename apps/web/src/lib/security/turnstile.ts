import "server-only";

/**
 * B3.7 — Cloudflare Turnstile CAPTCHA validator pro public booking.
 *
 * Chceme to jako „soft-gate": pokud `TURNSTILE_SECRET` není nastaven (local,
 * staging before rollout), validace se NESPOUŠTÍ a request projde. Jakmile se
 * secret přidá do Vercel env, validace se aktivuje a hádky „prošel fake request
 * bez CAPTCHA" se zavřou.
 *
 * Turnstile detaily: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileVerification =
  | { enforced: false; ok: true; reason: "missing_secret" }
  | { enforced: true; ok: true }
  | { enforced: true; ok: false; reason: "missing_token" | "verification_failed" };

export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp: string | null,
): Promise<TurnstileVerification> {
  const secret = process.env.TURNSTILE_SECRET?.trim();
  if (!secret) {
    return { enforced: false, ok: true, reason: "missing_secret" };
  }

  if (!token || token.trim().length === 0) {
    return { enforced: true, ok: false, reason: "missing_token" };
  }

  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", token.trim());
  if (remoteIp) form.set("remoteip", remoteIp);

  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      // Cloudflare Turnstile stability should be sub-second; 5s je bezpečná horní hranice.
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return { enforced: true, ok: false, reason: "verification_failed" };
    }
    const data = (await res.json()) as { success?: boolean };
    if (data.success === true) {
      return { enforced: true, ok: true };
    }
    return { enforced: true, ok: false, reason: "verification_failed" };
  } catch {
    return { enforced: true, ok: false, reason: "verification_failed" };
  }
}
