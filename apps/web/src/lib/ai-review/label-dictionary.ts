/**
 * Centrální český label dictionary pro celou AI Review / extraction pipeline.
 *
 * Pravidla:
 * 1. UI NIKDY nesmí zobrazit interní anglický klíč — vždy projít přes tento slovník.
 * 2. Neznámý klíč → bezpečný český fallback, ne raw string.
 * 3. Žádné vendor/filename/PDF specifické hacky.
 * 4. Žádné technické enumy ve finálním UX.
 */

// ─── Document type labels ────────────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<string, string> = {
  contract: "Smlouva",
  proposal: "Návrh",
  modelation: "Modelace",
  amendment: "Dodatek / změna",
  statement: "Výpis",
  payment_instructions: "Platební pokyny",
  supporting_document: "Podkladový dokument",
  termination_document: "Ukončení / výpověď",
  consent_or_identification_document: "Souhlas / identifikace",
  confirmation_document: "Potvrzení",
  investment_contract: "Investiční smlouva",
  life_insurance_contract: "Životní pojištění — smlouva",
  nonlife_insurance_contract: "Neživotní pojištění — smlouva",
  unknown: "Jiný dokument",
};

// ─── Product family labels ───────────────────────────────────────────────────

const PRODUCT_FAMILY_LABELS: Record<string, string> = {
  life_insurance: "Životní pojištění",
  non_life_insurance: "Neživotní pojištění",
  investment: "Investice",
  pp: "Penzijní připojištění (PP)",
  dps: "Doplňkové penzijní spoření (DPS)",
  dip: "Dlouhodobý investiční produkt (DIP)",
  building_savings: "Stavební spoření",
  loan: "Úvěr",
  mortgage: "Hypotéka",
  banking: "Bankovnictví",
  legacy_financial_product: "Starší finanční produkt",
  unknown: "Rodina produktu nebyla rozpoznána",
};

// ─── Field key → Czech label (canonical mapping) ─────────────────────────────

const FIELD_KEY_LABELS: Record<string, string> = {
  // Identita klienta
  idCardNumber: "Číslo dokladu / OP",
  idCardIssuedBy: "Doklad vydal",
  idCardValidUntil: "Platnost dokladu do",
  idCardIssuedAt: "Datum vydání dokladu",
  generalPractitioner: "Praktický lékař",
  personalId: "Rodné číslo",
  birthDate: "Datum narození",
  fullName: "Jméno a příjmení",
  firstName: "Jméno",
  lastName: "Příjmení",

  // Smlouva
  contractNumber: "Číslo smlouvy",
  contractStartDate: "Počátek smlouvy",
  startDate: "Počátek smlouvy",
  endDate: "Konec smlouvy",
  premiumAmount: "Pojistné",
  annualPremium: "Roční pojistné",

  // Osoby a role
  policyholder: "Pojistník",
  insured: "Pojištěný",
  beneficiary: "Obmyšlená osoba",

  // Investice
  investmentFunds: "Fondy",
  investmentStrategy: "Investiční strategie",
  investmentHorizon: "Investiční horizont",
  fundStrategy: "Investiční strategie",
  resolvedFundId: "Fond (dle knihovny)",
  resolvedFundCategory: "Kategorie fondu",
  fvSourceType: "Zdroj pro výpočet FV",

  // Platby
  payment_instructions: "Platební pokyny",
  variableSymbol: "Variabilní symbol",
  paymentFrequency: "Frekvence plateb",
  bankAccount: "Číslo účtu klienta",
  recipientAccount: "Účet instituce / příjemce",
  iban: "IBAN",

  // Pojištění
  insuredRisks: "Pojištěná rizika",
  coverageLines: "Přehled krytí",
  sumInsured: "Pojistná částka",
  deductible: "Spoluúčast",
  intermediaryEmail: "E-mail zprostředkovatele",
  intermediaryPhone: "Telefon zprostředkovatele",

  // Vozidlo / Majetek
  vehicleRegistration: "Registrační značka",
  propertyAddress: "Adresa pojištěného objektu",

  // DPS/DIP
  participantContribution: "Příspěvek účastníka",
  employerContribution: "Příspěvek zaměstnavatele",
};

// ─── Resolved fund category labels ──────────────────────────────────────────

const FUND_CATEGORY_LABELS: Record<string, string> = {
  equity: "Akcie",
  balanced: "Vyvážený",
  conservative: "Konzervativní",
  bond: "Dluhopisy",
  real_estate: "Nemovitostní fond",
  dps_dynamic: "DPS dynamický",
  dps_balanced: "DPS vyvážený",
  dps_conservative: "DPS konzervativní",
  unknown: "Nezařazeno",
};

// ─── FV source type labels ──────────────────────────────────────────────────

const FV_SOURCE_LABELS: Record<string, string> = {
  "fund-library": "Fond z knihovny",
  "heuristic-fallback": "Odhad dle kategorie",
  manual: "Ruční zadání",
};

// ─── Public API ──────────────────────────────────────────────────────────────

export function labelDocType(code: string): string {
  if (!code?.trim()) return "Neurčeno";
  return DOC_TYPE_LABELS[code.trim().toLowerCase()] ?? code.trim();
}

export function labelProductFamily(code: string): string {
  if (!code?.trim()) return "Neurčeno";
  return PRODUCT_FAMILY_LABELS[code.trim().toLowerCase()] ?? code.trim();
}

/**
 * Vrátí český label pro libovolný interní field key.
 * Nikdy nevrátí raw anglický string — vždy bezpečný fallback.
 */
export function labelFieldKey(key: string): string {
  if (!key?.trim()) return "Neurčeno";
  const direct = FIELD_KEY_LABELS[key];
  if (direct) return direct;

  const lower = key.trim().toLowerCase();
  for (const [k, v] of Object.entries(FIELD_KEY_LABELS)) {
    if (k.toLowerCase() === lower) return v;
  }

  return humanizeFieldKeyFallback(key);
}

export function labelFundCategory(code: string): string {
  if (!code?.trim()) return "Nezařazeno";
  return FUND_CATEGORY_LABELS[code.trim().toLowerCase()] ?? FUND_CATEGORY_LABELS[code.trim()] ?? "Nezařazeno";
}

export function labelFvSourceType(code: string | null | undefined): string {
  if (!code?.trim()) return "Neznámý zdroj";
  return FV_SOURCE_LABELS[code.trim()] ?? "Neznámý zdroj";
}

/**
 * Bezpečný fallback pro neznámé field keys — nikdy raw anglický string.
 * Pokusí se rozdělit camelCase / snake_case na srozumitelný text.
 */
function humanizeFieldKeyFallback(key: string): string {
  const cleaned = key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .trim()
    .toLowerCase();

  if (!cleaned || /^[a-z0-9\s]+$/.test(cleaned)) {
    return "Údaj k ověření";
  }
  return "Údaj k ověření";
}

/**
 * Humanizovaná hláška pro chybějící pole — nikdy technický string.
 */
export function humanizeMissingField(fieldKey: string): string {
  const label = labelFieldKey(fieldKey);
  if (label === "Údaj k ověření") return "Údaj nebyl v dokumentu nalezen";
  return `${label} — nenalezeno v dokumentu`;
}

/**
 * Humanizovaná hláška pro pole, které vyžaduje ruční doplnění.
 */
export function humanizeManualNeeded(fieldKey: string): string {
  const label = labelFieldKey(fieldKey);
  if (label === "Údaj k ověření") return "Údaj vyžaduje ruční doplnění";
  return `${label} — doplňte ručně`;
}
