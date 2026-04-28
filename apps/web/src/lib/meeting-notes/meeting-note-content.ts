/** Parsování JSON `content` u řádků meeting_notes — sdílené mezi portálem a mobilem. */

export function meetingNoteContentTitle(c: Record<string, unknown> | null): string {
  if (!c) return "Zápisek";
  if (typeof c.title === "string" && c.title.trim()) return c.title;
  const obsah = c.obsah;
  if (typeof obsah === "string" && obsah.trim()) return obsah.split("\n")[0].slice(0, 80) || "Zápisek";
  return "Zápisek";
}

export function meetingNoteContentBody(c: Record<string, unknown> | null): string {
  if (!c) return "";
  const o = c.obsah;
  return typeof o === "string" ? o : "";
}

export function meetingNoteContentRecommendation(c: Record<string, unknown> | null): string {
  if (!c) return "";
  const d = c.dalsi_kroky ?? c.doporuceni;
  return typeof d === "string" ? d : "";
}
