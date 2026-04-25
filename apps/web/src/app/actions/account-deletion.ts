"use server";

/**
 * Account deletion request flow.
 *
 * Apple App Store Guideline 5.1.1(v) a Google Play Data Safety požadují, aby
 * uživatel mohl smazání účtu **inicializovat přímo v aplikaci**. Skutečné
 * tvrdé smazání (DELETE FROM users + cascading cleanup) probíhá mimo runtime
 * požadavku: support na základě žádosti rozhodne o retenci dat (smluvně
 * vázané dokumenty poradce vůči klientům) a provede smazání v rámci 30denní
 * lhůty dle GDPR čl. 17.
 *
 * Tenhle flow tedy:
 *   1. zapíše audit log entry (`account_deletion_requested`),
 *   2. pošle mail na `podpora@aidvisora.cz` (interní ticket),
 *   3. pošle potvrzující mail uživateli (právní stopa, že žádost dorazila),
 *   4. odhlásí uživatele z aktuální session.
 *
 * Tvrdé smazání nedělá tato akce. Pokud v budoucnu přidáme "instant delete"
 * variantu pro uživatele, kteří nemají pending záznamy, rozšíříme metadata
 * a přidáme hard-delete větev.
 */

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/auth/get-membership";
import { logAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email/send-email";
import { LEGAL_PODPORA_EMAIL, LEGAL_COMPANY_NAME } from "@/app/legal/legal-meta";

export type AccountDeletionResult =
  | { ok: true; ticketId: string }
  | { ok: false; error: string };

const CONFIRMATION_PHRASE = "SMAZAT";

function ticketId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `DEL-${ts}-${rnd}`;
}

export async function requestAccountDeletion(formData: FormData): Promise<AccountDeletionResult> {
  const confirmation = String(formData.get("confirmation") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 1000);

  if (confirmation !== CONFIRMATION_PHRASE) {
    return {
      ok: false,
      error: `Pro potvrzení napište do pole přesně text „${CONFIRMATION_PHRASE}".`,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return { ok: false, error: "Nejste přihlášen(a)." };
  }

  const membership = await getMembership(user.id);
  if (!membership) {
    return { ok: false, error: "Nenalezen workspace pro tento účet." };
  }

  const id = ticketId();

  try {
    await logAudit({
      tenantId: membership.tenantId,
      userId: user.id,
      action: "account_deletion_requested",
      entityType: "user",
      entityId: user.id,
      meta: {
        ticketId: id,
        email: user.email,
        roleName: membership.roleName,
        reason: reason || null,
      },
    });
  } catch (err) {
    console.error("[account-deletion] audit log failed", err);
  }

  const supportSubject = `[Aidvisora] Žádost o smazání účtu · ${id}`;
  const supportHtml = `
    <p><strong>Ticket:</strong> ${id}</p>
    <p><strong>Uživatel:</strong> ${escapeHtml(user.email)}</p>
    <p><strong>User ID:</strong> ${escapeHtml(user.id)}</p>
    <p><strong>Tenant ID:</strong> ${escapeHtml(membership.tenantId)}</p>
    <p><strong>Role:</strong> ${escapeHtml(membership.roleName)}</p>
    <p><strong>Důvod (nepovinný):</strong><br/>${reason ? escapeHtml(reason).replace(/\n/g, "<br/>") : "<em>neuveden</em>"}</p>
    <hr/>
    <p>Zpracovat do 30 dnů dle GDPR čl. 17. Při mazání zkontrolovat, jestli uživatel není jediným Adminem tenantu — pokud ano, nejdřív vyřešit převod nebo smazání workspace.</p>
  `;

  const userSubject = "Potvrzení žádosti o smazání účtu Aidvisora";
  const userHtml = `
    <p>Dobrý den,</p>
    <p>přijali jsme Vaši žádost o smazání účtu <strong>${escapeHtml(user.email)}</strong> (číslo žádosti <strong>${id}</strong>).</p>
    <p>Vaše data odstraníme v rámci zákonné lhůty 30 dnů od dnešního dne. Pokud jste jediným administrátorem svého workspace, ozveme se Vám e-mailem kvůli dořešení smluv a dokumentů vůči klientům, ještě před samotným smazáním.</p>
    <p>Pokud jste žádost nepodali Vy, nebo si to rozmyslíte, odpovězte prosím na tento e-mail do 72 hodin.</p>
    <p>Děkujeme,<br/>${escapeHtml(LEGAL_COMPANY_NAME)}</p>
  `;

  const sendResults = await Promise.allSettled([
    sendEmail({
      to: LEGAL_PODPORA_EMAIL,
      subject: supportSubject,
      html: supportHtml,
      tags: [{ name: "type", value: "account_deletion_request" }],
      audit: {
        tenantId: membership.tenantId,
        template: "account_deletion_support_notice",
        meta: { ticketId: id, userId: user.id },
      },
    }),
    sendEmail({
      to: user.email,
      subject: userSubject,
      html: userHtml,
      tags: [{ name: "type", value: "account_deletion_confirmation" }],
      audit: {
        tenantId: membership.tenantId,
        template: "account_deletion_user_confirmation",
        meta: { ticketId: id, userId: user.id },
      },
    }),
  ]);

  for (const r of sendResults) {
    if (r.status === "rejected") {
      console.error("[account-deletion] email send rejected", r.reason);
    }
  }

  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.error("[account-deletion] signOut failed", err);
  }

  try {
    const jar = await cookies();
    jar.set("account_deletion_pending", id, {
      path: "/",
      maxAge: 60 * 60 * 24,
      httpOnly: false,
      sameSite: "lax",
    });
  } catch {
    // cookies() mimo request scope — nevadí
  }

  return { ok: true, ticketId: id };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
