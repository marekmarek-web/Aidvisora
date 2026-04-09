/**
 * Team (staff) invite links use query param `staff_invite` with the same token format as client invites (32 hex chars).
 */

export const STAFF_INVITE_QUERY_PARAM = "staff_invite";

const INVITE_TOKEN_PATTERN = /^[a-f0-9]{32}$/i;

export function isStaffInviteTokenFormat(raw: string | null | undefined): boolean {
  const t = raw?.trim() ?? "";
  return t.length === 32 && INVITE_TOKEN_PATTERN.test(t);
}

export function parseStaffInviteTokenFromUrl(searchParams: { get: (key: string) => string | null }): string | null {
  const raw = searchParams.get(STAFF_INVITE_QUERY_PARAM)?.trim() ?? "";
  if (!isStaffInviteTokenFormat(raw)) return null;
  return raw.toLowerCase();
}

export function buildStaffInviteRegisterCompletePath(token: string, nextPath: string): string {
  const n = nextPath.startsWith("/") ? nextPath : `/${nextPath}`;
  return `/register/complete?${STAFF_INVITE_QUERY_PARAM}=${encodeURIComponent(token)}&next=${encodeURIComponent(n)}`;
}
