import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/auth/get-membership";

const USER_ID_HEADER = "x-user-id";

export type IntegrationApiAuth = { userId: string; tenantId: string };

export async function getIntegrationApiAuth(
  request: Request
): Promise<{ ok: true; auth: IntegrationApiAuth } | { ok: false; response: Response }> {
  let userId: string | null = request.headers.get(USER_ID_HEADER);
  if (!userId) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return {
        ok: false,
        response: new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      };
    }
    userId = user.id;
  }

  const membership = await getMembership(userId);
  if (!membership) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }

  return { ok: true, auth: { userId, tenantId: membership.tenantId } };
}
