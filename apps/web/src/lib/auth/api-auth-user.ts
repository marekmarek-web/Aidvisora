import { createClient } from "@/lib/supabase/server";

/**
 * Supabase session user id for App Router API routes (reads auth cookies).
 * Use with {@link getMembership} — same pattern as the rest of the app (no Clerk).
 */
export async function getAuthenticatedApiUserId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user?.id) return null;
    return user.id;
  } catch {
    return null;
  }
}

export const AIDV_USER_ID_HEADER = "x-user-id";

export type ResolveApiUserResult =
  | { ok: true; userId: string; source: "session" }
  | { ok: false; status: 401; reason: "no_session" | "header_mismatch" };

/**
 * B1.1 — Always derive the user id from the Supabase session. If a caller
 * supplies `x-user-id` header (e.g. behind the proxy overwrite), it must
 * exactly match `auth.getUser().id` — otherwise reject as potential spoof.
 *
 * Routes where this was previously "header-only fallback":
 *  - `/api/documents/review/[id]`
 *  - `/api/ai/team-summary`
 *  - `/api/ai/client-request-brief`
 *
 * The pattern mirrors {@link apps/web/src/app/api/ai/assistant/chat/route.ts}
 * so that all AI / CRM write routes agree on "session is truth, header is
 * advisory".
 */
export async function resolveAuthenticatedApiUser(
  request: Request | { headers: Headers }
): Promise<ResolveApiUserResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return { ok: false, status: 401, reason: "no_session" };
  }
  const headerUserId = request.headers.get(AIDV_USER_ID_HEADER)?.trim() || null;
  if (headerUserId && headerUserId !== user.id) {
    return { ok: false, status: 401, reason: "header_mismatch" };
  }
  return { ok: true, userId: user.id, source: "session" };
}
