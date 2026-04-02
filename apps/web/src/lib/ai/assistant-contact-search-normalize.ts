/** Same Czech capitalized word pair as intent fallback — extract "Jméno Příjmení" from noisy text. */
const CZECH_NAME_PAIR =
  /([A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+)\s+([A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+)/u;

const NOISE_WORDS =
  /\b(hypoték|hypoteka|hypotéku|obchod|pipeline|případ|opportunit|follow|úkol|follow-up|followup|příští|úterý|úter|koupě|rekonstrukce|byt|bytu|čekáme|potvrzení|nabídka|nabídku|email|e-mail|zpráva|vytvoř|založ|zaeviduj|klienta|klient|čs|csob|kb|moneta|unicredit|air\s*bank)\b/giu;

/** Escape % and _ for use inside ILIKE patterns (wildcards). */
export function escapeIlikeLiteral(token: string): string {
  return token.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * Strip CRM/chat noise and prefer an extracted "Jméno Příjmení" pair when present.
 * Falls back to cleaned text or original trim so short queries still work.
 */
export function normalizeNameSearchQuery(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";

  const pair = trimmed.match(CZECH_NAME_PAIR);
  if (pair) {
    return `${pair[1]} ${pair[2]}`.trim();
  }

  let s = trimmed;
  s = s.replace(/\d[\d\s.,]*(?:\s*(?:000|Kč|kč|%))?/gi, " ");
  s = s.replace(NOISE_WORDS, " ");
  s = s.replace(/[^\p{L}\s'-]/gu, " ");
  s = s.replace(/\s+/g, " ").trim();

  return s || trimmed;
}

/** Whitespace tokens, min length 2 (single-letter tokens handled via fallback). */
export function splitNameSearchTokens(normalized: string): string[] {
  return normalized
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}
