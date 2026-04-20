/**
 * Sdílené konstanty a pure helpery pro promo kódy.
 *
 * Tento modul je záměrně BEZ `server-only` — používají ho:
 *   - server (checkout route, invite route, webhook audit),
 *   - client (billing UI komponenty, které čtou cookie `aidvisora_promo_code`).
 *
 * Server-side lookup Stripe PromotionCode objektů najdeš v `./promo-codes.ts`.
 */

/**
 * Kód Premium Brokers programu. Fyzický coupon/promo code se zakládá ve Stripe
 * dashboardu (Coupon → konkrétní sleva; Promotion code = `PREMIUM-BROKERS-2026`).
 * Aplikace si tady drží pouze stabilní identifikátor, aby whitelist, audit
 * i UI sedělo na jednom stringu.
 */
export const PREMIUM_BROKERS_PROMO_CODE = "PREMIUM-BROKERS-2026";

/** Whitelisted promo kódy, které aplikace sama vystavuje a loguje. */
const KNOWN_PROMO_CODES: ReadonlySet<string> = new Set([PREMIUM_BROKERS_PROMO_CODE]);

export function isKnownPromoCode(raw: string | null | undefined): boolean {
  if (!raw) return false;
  return KNOWN_PROMO_CODES.has(raw.trim().toUpperCase());
}

/** Název cookie nastavené přes `/invite/[code]` a čtené checkout routou. */
export const PROMO_CODE_COOKIE = "aidvisora_promo_code";

/** 14 dní — dává uživateli dost času projít registrací, trialem a checkoutem. */
export const PROMO_CODE_COOKIE_MAX_AGE_SECONDS = 14 * 24 * 60 * 60;

/**
 * Krátký lidsky čitelný popis slevy pro UI badge. Záměrně drží pouze známé
 * kódy — neznámé kódy UI badge nezobrazuje, aby se nedal podstrčit libovolný
 * string přes cookie.
 */
export function promoCodeDisplayLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  const up = code.trim().toUpperCase();
  if (up === PREMIUM_BROKERS_PROMO_CODE) {
    return "Premium Brokers — sleva je připravena, uplatní se v checkoutu.";
  }
  return null;
}
