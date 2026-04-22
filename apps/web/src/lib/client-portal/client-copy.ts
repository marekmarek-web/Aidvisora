/**
 * B3.2 — Central client-facing copy/glossary.
 *
 * Cíl: jedno místo, kde se rozhoduje, jak se interní termíny (pojistník /
 * pojištěný / status návrhu / „(model)“ atd.) přeloží pro klienta v portálu.
 *
 * Pravidlo: UI komponenty v `app/client/**` a `app/client/mobile/**` by neměly
 * mít hard-coded „Pojistník“, „Klient zobrazil“, „(model)“ apod. Přes tyto
 * helpery se zajistí, že klient uvidí jednotnou češtinu bez interního žargonu.
 */

/** „Pojistník“ → sjednatel smlouvy. */
export const CLIENT_ROLE_COPY = {
  policyHolder: "Sjednatel smlouvy",
  insured: "Pojištěná osoba",
  payer: "Kdo platí",
} as const;

/** Mapování status labelů návrhů (advisor_proposals) pro klientský pohled. */
export function clientProposalStatusLabel(status: string): string {
  switch (status) {
    case "published":
      return "Nový návrh";
    case "viewed":
      return "Prohlédnuto";
    case "accepted":
      return "Přijato";
    case "declined":
      return "Odmítnuto";
    case "expired":
      return "Vypršelo";
    default:
      return status;
  }
}

/** Čeština pro frekvenci platby. Nikdy neukazujeme `quarterly/semi-annual/annual`. */
export function clientPaymentFrequencyLabel(freq: string | null | undefined): string {
  if (!freq) return "—";
  const key = freq.toLowerCase();
  switch (key) {
    case "monthly":
      return "Měsíčně";
    case "quarterly":
      return "Čtvrtletně";
    case "semi-annual":
    case "semiannual":
    case "semi_annual":
      return "Pololetně";
    case "annual":
    case "yearly":
      return "Ročně";
    case "once":
    case "one_time":
      return "Jednorázově";
    default:
      return freq;
  }
}

/** Disclaimery pro future value / výpočty. */
export const CLIENT_DISCLAIMER_COPY = {
  futureValueModel:
    "Odhad na základě zadaných parametrů — nejedná se o závaznou predikci výnosu.",
  portfolioSummary: "Souhrn čerpá data z evidence u vašeho poradce.",
} as const;
