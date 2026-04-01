/**
 * Client-zone invite links must not use the generic query name `token` (collides with OAuth, etc.).
 * New links use `client_invite`; legacy emails may still use `token`.
 */

export const CLIENT_INVITE_QUERY_PARAM = "client_invite";
export const LEGACY_CLIENT_INVITE_QUERY_PARAM = "token";

/** Invite tokens are UUIDs without hyphens (32 hex chars). */
const INVITE_TOKEN_PATTERN = /^[a-f0-9]{32}$/i;

export function isClientInviteTokenFormat(raw: string | null | undefined): boolean {
  const t = raw?.trim() ?? "";
  return t.length === 32 && INVITE_TOKEN_PATTERN.test(t);
}

/**
 * Returns the invite token from URL search params, or null if missing/invalid.
 * Prefers `client_invite`, then legacy `token` only when it matches invite format.
 */
export function parseClientInviteTokenFromUrl(searchParams: { get: (key: string) => string | null }): string | null {
  const preferred = searchParams.get(CLIENT_INVITE_QUERY_PARAM)?.trim() ?? "";
  if (isClientInviteTokenFormat(preferred)) return preferred.toLowerCase();

  const legacy = searchParams.get(LEGACY_CLIENT_INVITE_QUERY_PARAM)?.trim() ?? "";
  if (isClientInviteTokenFormat(legacy)) return legacy.toLowerCase();

  return null;
}

export function buildClientInviteLoginSearch(token: string): string {
  return `${CLIENT_INVITE_QUERY_PARAM}=${encodeURIComponent(token)}`;
}

export function buildClientInvitePasswordSetupSearch(token: string): string {
  return `${CLIENT_INVITE_QUERY_PARAM}=${encodeURIComponent(token)}`;
}
