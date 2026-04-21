import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedApiUserId } from "@/lib/auth/api-auth-user";
import { recordTermsAcceptance } from "@/lib/legal/terms-acceptance";
import { LEGAL_ACCEPTANCE_CONTEXTS } from "@/app/legal/legal-meta";

/**
 * Delta A10 — API endpoint pro klientský/register/staff-invite acceptance flow.
 *
 * Body:
 *   {
 *     "context": "register" | "client-invite" | "staff-invite" | "beta-terms",
 *     "documents": ["terms","privacy"],
 *     "contactId"?: uuid,   // client-invite kontext (pro klienty bez user_id)
 *     "tenantId"?:  uuid    // tenant-aware kontext
 *   }
 *
 * Auth:
 *   - Register / staff-invite / checkout navazující flows → vyžaduje Supabase session.
 *   - Client-invite (klient bez účtu) → lze volat bez session, ale MUSÍ dorazit `contactId`
 *     a invite token (verifikace — TODO: přidat `inviteToken` check).
 *
 * Rate limiting: minimální (append-only log, ale stále má opodstatnění — floodem můžeme
 * naplnit tabulku). Přes existující global middleware rate limit (pokud je nastaven).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AcceptBody = {
  context?: string;
  documents?: string[];
  contactId?: string;
  tenantId?: string;
};

const ALLOWED_DOCUMENTS = [
  "terms",
  "privacy",
  "dpa",
  "ai-disclaimer",
  "cookies",
  "beta-terms",
] as const;

function validateDocuments(raw: unknown): Array<(typeof ALLOWED_DOCUMENTS)[number]> | null {
  if (!Array.isArray(raw)) return null;
  const out: Array<(typeof ALLOWED_DOCUMENTS)[number]> = [];
  for (const v of raw) {
    if (typeof v !== "string") return null;
    if (!ALLOWED_DOCUMENTS.includes(v as (typeof ALLOWED_DOCUMENTS)[number])) return null;
    out.push(v as (typeof ALLOWED_DOCUMENTS)[number]);
  }
  if (out.length === 0) return null;
  return Array.from(new Set(out));
}

export async function POST(request: NextRequest) {
  let body: AcceptBody = {};
  try {
    body = (await request.json()) as AcceptBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Bad JSON" }, { status: 400 });
  }

  const context = body.context?.trim();
  if (
    !context ||
    !LEGAL_ACCEPTANCE_CONTEXTS.includes(
      context as (typeof LEGAL_ACCEPTANCE_CONTEXTS)[number],
    )
  ) {
    return NextResponse.json({ ok: false, error: "Invalid context" }, { status: 400 });
  }

  const documents = validateDocuments(body.documents);
  if (!documents) {
    return NextResponse.json({ ok: false, error: "Invalid documents" }, { status: 400 });
  }

  const userId = await getAuthenticatedApiUserId();
  const requiresAuth = context !== "client-invite";

  if (requiresAuth && !userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!userId && !body.contactId) {
    return NextResponse.json(
      { ok: false, error: "contactId required when no session" },
      { status: 400 },
    );
  }

  await recordTermsAcceptance({
    userId: userId ?? null,
    contactId: body.contactId ?? null,
    tenantId: body.tenantId ?? null,
    context: context as (typeof LEGAL_ACCEPTANCE_CONTEXTS)[number],
    documents,
    request,
  });

  return NextResponse.json({ ok: true });
}
