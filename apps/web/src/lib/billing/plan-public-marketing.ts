/**
 * Veřejné popisy balíčků (landing, nápověda v CRM) — konzistentní s capability maticí.
 * Neobsahuje ceny; ty jsou v {@link public-pricing}.
 */

import type { PublicPlanKey } from "@/lib/billing/plan-catalog";

/** Krátký podnadpis pod názvem tarifu na webu. */
export const PUBLIC_PLAN_TAGLINE: Record<PublicPlanKey, string> = {
  start: "CRM, kalendář, dokumenty v klientském portálu a základní AI — u Startu bez klientského chatu a bez AI review PDF.",
  pro: "Méně ruční práce: plný klientský portál (chat, požadavky), AI review PDF, vícekrokový asistent a Google napojení podle nastavení.",
  management: "Navíc týmové přehledy, produkce, KPI a manažerské reporty oproti Pro.",
};

/** Co balíček obsahuje (řádky s ✓). */
export const PUBLIC_PLAN_INCLUDES: Record<PublicPlanKey, readonly string[]> = {
  start: [
    "CRM, rozpracované obchody, kalendář a úkoly",
    "Google Calendar sync podle nastavení",
    "Klientská zóna pro dokumenty",
    "Základní AI asistent a nahrání podkladů",
  ],
  pro: [
    "Vše ze Startu",
    "Klientský chat a nové požadavky z portálu",
    "Gmail a Google Drive podle nastavení",
    "AI review PDF a pokročilý asistent pro práci s PDF",
    "Finanční analýzy a kalkulačky (dle modulů v aplikaci)",
  ],
  management: [
    "Vše z Pro",
    "Týmové přehledy a produkce",
    "KPI, manažerské a pokročilé reporty",
    "Řízení rolí, sdílené pohledy a týmová práce v rámci organizace",
  ],
};

/** Co u nižšího plánu záměrně není — pro transparentní landing (Start). */
export const PUBLIC_PLAN_START_EXCLUDES: readonly string[] = [
  "Bez klientského chatu a požadavků z portálu",
  "Bez AI review PDF",
];

/** Jedna věta pod sekci tarifů v CRM (nastavení). */
export const PUBLIC_PRICING_SUMMARY_CS =
  "Veřejné tarify: Start 990 Kč / měs., Pro 1 990 Kč / měs., Management 3 490 Kč / měs. Při roční fakturaci sleva 20 % oproti součtu 12 měsíců. Trial 14 dní v úrovni Pro.";
