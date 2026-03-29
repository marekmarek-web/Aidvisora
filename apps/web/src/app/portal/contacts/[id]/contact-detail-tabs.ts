/** Záložky detailu kontaktu — sdílené mezi server page a klientskou navigací. */

export type ContactTabId =
  | "prehled"
  | "timeline"
  | "smlouvy"
  | "dokumenty"
  | "zapisky"
  | "aktivita"
  | "ukoly"
  | "obchody"
  | "briefing";

export const CONTACT_TAB_IDS: ContactTabId[] = [
  "prehled",
  "timeline",
  "smlouvy",
  "dokumenty",
  "zapisky",
  "aktivita",
  "ukoly",
  "obchody",
  "briefing",
];

export const CONTACT_TAB_LABELS: Record<ContactTabId, string> = {
  prehled: "Přehled",
  timeline: "Timeline",
  smlouvy: "Produkty",
  dokumenty: "Dokumenty",
  zapisky: "Zápisky",
  aktivita: "Aktivita",
  ukoly: "Úkoly a schůzky",
  obchody: "Obchody",
  briefing: "Briefing",
};

function firstString(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined;
  return typeof v === "string" ? v : v[0];
}

/** Aktivní záložka z query `tab` (výchozí přehled). */
export function parseContactTabFromSearchParams(
  sp: Record<string, string | string[] | undefined>,
): ContactTabId {
  const t = firstString(sp.tab);
  if (t && CONTACT_TAB_IDS.includes(t as ContactTabId)) return t as ContactTabId;
  return "prehled";
}

/** Query řetězec bez `tab` (pro odkazy mezi záložkami; zachová eventId / meetingNoteId u Briefingu). */
export function contactDetailQueryWithoutTab(
  sp: Record<string, string | string[] | undefined>,
): string {
  const p = new URLSearchParams();
  for (const [key, raw] of Object.entries(sp)) {
    if (key === "tab") continue;
    const val = firstString(raw);
    if (val != null && val !== "") p.set(key, val);
  }
  return p.toString();
}
