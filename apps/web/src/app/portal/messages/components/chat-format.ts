/** Čas v řádku konverzace (dnes = hodina, včera, jinak datum). */
export function formatConversationListTime(d: Date): string {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfThat = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayDiff = Math.round((startOfToday.getTime() - startOfThat.getTime()) / 86400000);
  if (dayDiff === 0) {
    return d.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" });
  }
  if (dayDiff === 1) return "Včera";
  if (dayDiff < 7) {
    return d.toLocaleDateString("cs-CZ", { weekday: "short" });
  }
  return d.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric" });
}

export function formatThreadDayLabel(d: Date): string {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfThat = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayDiff = Math.round((startOfToday.getTime() - startOfThat.getTime()) / 86400000);
  const datePart = d.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric" });
  if (dayDiff === 0) return `Dnes · ${datePart}`;
  if (dayDiff === 1) return `Včera · ${datePart}`;
  return d.toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "numeric" });
}

export function formatLastActiveLabel(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Naposledy aktivní právě teď";
  if (mins < 60) return `Naposledy aktivní před ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Naposledy aktivní před ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Naposledy aktivní včera";
  if (days < 7) return `Naposledy aktivní před ${days} dny`;
  return `Naposledy aktivní ${d.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric" })}`;
}

export type PresenceTier = "online" | "away" | "offline";

/** Bez reálného presence API: odhad z času poslední zprávy v konverzaci. */
export function presenceFromLastMessageAt(d: Date): PresenceTier {
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 20) return "online";
  if (mins < 180) return "away";
  return "offline";
}

export function contactInitials(firstName: string | null | undefined, lastName: string | null | undefined, fallback = "?"): string {
  const a = firstName?.trim()?.[0];
  const b = lastName?.trim()?.[0];
  const s = [a, b].filter(Boolean).join("").toUpperCase();
  return s || fallback;
}

export function initialsFromFullName(full: string, fallback = "?"): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function nameFromContactParts(firstName: string | null | undefined, lastName: string | null | undefined, email: string | null | undefined): string {
  const n = [firstName, lastName].filter(Boolean).join(" ").trim();
  if (n) return n;
  if (email) return email;
  return "Kontakt";
}
