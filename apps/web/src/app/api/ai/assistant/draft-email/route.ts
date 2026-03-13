import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMembership, hasPermission, type RoleName } from "@/lib/auth/get-membership";
import { createResponseSafe } from "@/lib/openai";
import { getClientDetails } from "@/lib/ai/assistant-actions";

export const dynamic = "force-dynamic";

const USER_ID_HEADER = "x-user-id";

export async function POST(request: Request) {
  try {
    let userId: string | null = request.headers.get(USER_ID_HEADER);
    if (!userId) {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      userId = user.id;
    }
    const membership = await getMembership(userId);
    if (!membership || !hasPermission(membership.roleName as RoleName, "documents:read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const clientId = typeof body.clientId === "string" ? body.clientId.trim() : "";
    const contextType = (body.context as string) || "follow_up";

    if (!clientId) {
      return NextResponse.json({ error: "Chybí clientId." }, { status: 400 });
    }

    const client = await getClientDetails(clientId, membership.tenantId);
    if (!client.ok) {
      return NextResponse.json({ error: client.error }, { status: 404 });
    }

    const prompt =
      contextType === "reminder"
        ? `Napiš krátký e-mail (2–3 věty) klientovi ${client.name} jako připomenutí. Bez oslovení na konci, jen tělo. Česky.`
        : contextType === "missing_data"
          ? `Napiš krátký e-mail klientovi ${client.name} s žádostí o doplnění údajů. 2–3 věty. Česky.`
          : `Napiš krátký follow-up e-mail klientovi ${client.name}. Přátelský tón, 2–3 věty. Česky.`;

    const result = await createResponseSafe(prompt);
    if (!result.ok) {
      return NextResponse.json({
        subject: `Follow-up – ${client.name}`,
        body: `Dobrý den,\n\nDěkujeme za spolupráci.\n\nS pozdravem`,
      });
    }

    const bodyText = result.text.trim().slice(0, 1500);
    const subject =
      contextType === "reminder"
        ? `Připomenutí – ${client.name}`
        : contextType === "missing_data"
          ? `Doplnění údajů – ${client.name}`
          : `Follow-up – ${client.name}`;

    return NextResponse.json({ subject, body: bodyText });
  } catch {
    return NextResponse.json(
      { error: "Generování návrhu selhalo." },
      { status: 500 }
    );
  }
}
