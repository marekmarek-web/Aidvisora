/**
 * České popisky oblastí zápisků (hodnoty sloupce `domain` v DB).
 * Sjednocuje mobilní přehled, nástěnku a vyhledávání.
 */
export const MEETING_NOTE_DOMAIN_LABEL_CS: Record<string, string> = {
  hypo: "Hypotéka",
  investice: "Investice",
  "zivotni-pojisteni": "Životní pojištění",
  "majetkove-pojisteni": "Majetkové pojištění",
  dps: "Penzijní spoření",
  uvery: "Úvěry",
  komplex: "Komplexní plán",
  jine: "Jiné",
  pojisteni: "Pojištění",
};

export function formatMeetingNoteDomainLabel(domain: string | null | undefined): string {
  if (domain == null || domain === "") return "Bez oblasti";
  return MEETING_NOTE_DOMAIN_LABEL_CS[domain] ?? domain;
}
