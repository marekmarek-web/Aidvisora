import { resolveResendReplyTo } from "@/lib/email/resend-reply-to";
import { createClient } from "@/lib/supabase/server";
import { userProfiles, eq } from "db";
import { withAuthContext } from "@/lib/auth/with-auth-context";

/**
 * Doména pro From (ověřená v Resend). Volitelně `RESEND_FROM_DOMAIN`, jinak z `RESEND_FROM_EMAIL`.
 */
export function getResendFromDomain(): string | null {
  const d = process.env.RESEND_FROM_DOMAIN?.trim();
  if (d) return d.replace(/^@/, "").toLowerCase();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!from) return null;
  const angle = from.match(/<([^>]+)>/);
  const email = angle ? angle[1]!.trim() : from;
  const at = email.lastIndexOf("@");
  if (at === -1) return null;
  return email.slice(at + 1).toLowerCase();
}

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

/** Bezpečná lokální část pro e-mail (RFC-ish). */
function slugifyLocalSegment(s: string): string {
  return stripDiacritics(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 40);
}

export type BuildAdvisorFromParams = {
  fullName: string | null | undefined;
  userId: string;
  authEmail?: string | null;
  /** Pokud chybí, použije se `getResendFromDomain()`. */
  domain?: string | null;
};

/**
 * From ve tvaru `Jméno Příjmení <jmeno.prijmeni.xxxx@domain>` – suffix z userId kvůli jednoznačnosti.
 */
export function buildAdvisorFromAddress(params: BuildAdvisorFromParams): string | null {
  const domain = params.domain ?? getResendFromDomain();
  if (!domain) return null;

  const name = params.fullName?.trim();
  const idPart = params.userId.replace(/-/g, "").slice(0, 6);

  let localBase = "";
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const a = slugifyLocalSegment(parts[0]!);
      const b = slugifyLocalSegment(parts[parts.length - 1]!);
      localBase = a && b ? `${a}.${b}` : a || b || "advisor";
    } else {
      localBase = slugifyLocalSegment(parts[0]!) || "advisor";
    }
  }
  if (!localBase && params.authEmail) {
    const local = params.authEmail.split("@")[0];
    localBase = slugifyLocalSegment(local || "") || "advisor";
  }
  if (!localBase) localBase = "advisor";

  const local = `${localBase}.${idPart}`.slice(0, 64);
  const display =
    name ||
    (params.authEmail ? params.authEmail.split("@")[0] : null) ||
    "Aidvisora";

  return `${display} <${local}@${domain}>`;
}

/**
 * Reply-To: nejdřív `user_profiles.email`, pak Supabase `user.email`, pak env `RESEND_REPLY_TO`.
 */
export function resolveAdvisorReplyTo(profileEmail: string | null | undefined, authEmail: string | null | undefined): string | undefined {
  const p = profileEmail?.trim();
  if (p) return p;
  const a = authEmail?.trim();
  if (a) return a;
  return resolveResendReplyTo();
}

export type AdvisorMailHeaders = { from: string; replyTo: string | undefined };

/**
 * Načte jméno z `user_profiles` a sestaví From + Reply-To pro aktuální session.
 * Při chybě domény nebo session vrátí fallback z env.
 */
export async function loadAdvisorMailHeadersForCurrentUser(): Promise<AdvisorMailHeaders> {
  const fallbackFrom =
    process.env.RESEND_FROM_EMAIL?.trim() || "Aidvisora <noreply@aidvisora.cz>";
  const fallbackReply = resolveResendReplyTo();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { from: fallbackFrom, replyTo: fallbackReply };
  }

  return withAuthContext(async (auth, tx) => {
    const [profile] = await tx
      .select({ fullName: userProfiles.fullName, email: userProfiles.email })
      .from(userProfiles)
      .where(eq(userProfiles.userId, auth.userId))
      .limit(1);

    const fullName = profile?.fullName ?? (user.user_metadata?.full_name as string | undefined) ?? null;
    const replyTo = resolveAdvisorReplyTo(profile?.email, user.email);

    const built = buildAdvisorFromAddress({
      fullName,
      userId: auth.userId,
      authEmail: user.email,
      domain: getResendFromDomain(),
    });

    return {
      from: built ?? fallbackFrom,
      replyTo,
    };
  });
}
