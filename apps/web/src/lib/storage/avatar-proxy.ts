/**
 * WS-2 Batch 5 / W4 — helpery pro avatar/branding storage proxy.
 *
 * Sdílené mezi server actions (upload → DB) a UI consumery (render `<img src>`).
 *
 * Konvence:
 *   - DB sloupce `avatar_url` / `report_logo_url` mohou po Batch 5 obsahovat dva tvary:
 *     a) **storage path** (např. `tenantId/avatars/contactId/123.jpg`) — nový kanonický formát,
 *        UI ho renderuje přes `/api/storage/avatar?path=...` (krátkodobá signed URL).
 *     b) **legacy signed URL** (`https://.../storage/v1/object/sign/...`) — z dřívějších uploadů
 *        s 365denní platností. UI je zobrazuje jak jsou dokud nevypadnou / neprovede se nový upload.
 *   - `buildAvatarProxyUrl(path)` a `toAvatarDisplayUrl(stored)` jsou bezpečné pro SSR i CSR.
 */

const STORAGE_PATH_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\//i;

export function buildAvatarProxyUrl(storagePath: string): string {
  return `/api/storage/avatar?path=${encodeURIComponent(storagePath)}`;
}

/**
 * Převede hodnotu uloženou v `contacts.avatar_url` / `advisor_preferences.avatar_url`
 * / `advisor_preferences.report_logo_url` na URL pro `<img src>`.
 *
 * - `null` / prázdný string → `null`.
 * - `https://...` → vrací vstup (legacy signed URL; necháme běžet dokud nevypadne).
 * - `data:...` → vstup (data URI, pokud někde používáme).
 * - `<uuid>/...` nebo cokoliv bez schématu → `/api/storage/avatar?path=...`.
 */
export function toAvatarDisplayUrl(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const value = stored.trim();
  if (value.length === 0) return null;
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:")) {
    return value;
  }
  if (value.startsWith("/api/")) {
    return value;
  }
  if (STORAGE_PATH_PATTERN.test(value)) {
    return buildAvatarProxyUrl(value);
  }
  return value;
}
