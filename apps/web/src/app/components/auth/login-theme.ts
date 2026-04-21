/**
 * Sdílená „role theme" pro přihlašovací obrazovky (web i mobile).
 * Sjednocuje barvu fokus-ringu, hlavního CTA a linků podle role
 * (poradce = indigo, klient = emerald — viz UX polish plán SF8 a SF14).
 *
 * Nikde jinde v appce by se tyhle konkrétní barevné varianty _neměly_
 * opakovat ručně — jakmile na ně narazíš, přetoč je na tyto konstanty.
 */

export type LoginRoleTheme = {
  /** Výchozí ringy/bordery pro focus + pozadí inputu (Tailwind classNames). */
  inputFocusRing: string;
  /** Hlavní CTA třídy (gradient / solid podle role). */
  primaryCta: string;
  /** Třída pro roleTab (aktivní pill). */
  activeRoleTab: string;
  /** Barva zvýraznění linků v textu (např. „Přihlásit se"). */
  inlineLink: string;
  /** Whether this variant represents the client zone. */
  isClient: boolean;
};

const ADVISOR_THEME: LoginRoleTheme = {
  inputFocusRing:
    "focus:border-indigo-400 focus:ring-indigo-500/20 focus:ring-4",
  primaryCta:
    "bg-gradient-to-r from-indigo-500 via-indigo-500 to-sky-500 hover:from-indigo-400 hover:via-indigo-400 hover:to-sky-400 text-white shadow-lg shadow-indigo-500/30",
  activeRoleTab:
    "bg-indigo-500/15 text-indigo-300 border border-indigo-400/40",
  inlineLink: "text-indigo-300 hover:text-indigo-200",
  isClient: false,
};

const CLIENT_THEME: LoginRoleTheme = {
  inputFocusRing:
    "focus:border-emerald-400 focus:ring-emerald-500/20 focus:ring-4",
  primaryCta:
    "bg-gradient-to-r from-emerald-500 via-emerald-500 to-teal-500 hover:from-emerald-400 hover:via-emerald-400 hover:to-teal-400 text-white shadow-lg shadow-emerald-500/30",
  activeRoleTab:
    "bg-emerald-500/15 text-emerald-300 border border-emerald-400/40",
  inlineLink: "text-emerald-300 hover:text-emerald-200",
  isClient: true,
};

export function getLoginRoleTheme(isClient: boolean): LoginRoleTheme {
  return isClient ? CLIENT_THEME : ADVISOR_THEME;
}
