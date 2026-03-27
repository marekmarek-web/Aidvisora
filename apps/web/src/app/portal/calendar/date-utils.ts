/**
 * Local date formatting for calendar (avoids UTC shift).
 * Use everywhere we compare "today" or build date keys (YYYY-MM-DD).
 */
export function formatDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Hodnota pro `<input type="datetime-local" />` v lokálním čase uživatele (ne UTC z toISOString). */
export function formatDateTimeLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

/**
 * Pouze v prohlížeči: `datetime-local` bez časové zóny → jednoznačné UTC ISO pro server actions.
 * Na serveru Node parsuje `YYYY-MM-DDTHH:mm` jako UTC a posune čas o pásmo uživatele.
 */
export function localDateTimeInputToUtcIso(naiveLocal: string | undefined): string | undefined {
  if (!naiveLocal?.trim()) return undefined;
  const d = new Date(naiveLocal.trim());
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

/**
 * Format an ISO date-time string in a given IANA timezone (e.g. "Europe/Prague").
 * For display; use on client so Intl is available.
 */
export function formatInTimeZone(iso: string, timeZone: string, options: Intl.DateTimeFormatOptions = {}): string {
  const d = new Date(iso);
  return d.toLocaleString("cs-CZ", { timeZone, ...options });
}
