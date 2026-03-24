"use server";

import { sendResendEmail } from "@/lib/email/resend-client";
import { loadAdvisorMailHeadersForCurrentUser } from "@/lib/email/advisor-mail-headers";

/**
 * Send a test "Hello World" email via Resend.
 * Useful to verify RESEND_API_KEY is set and Resend is working.
 *
 * Set RESEND_API_KEY in .env.local (e.g. from Resend dashboard).
 */
export async function sendTestEmail(to: string = "mrcreaw@gmail.com") {
  const headers = await loadAdvisorMailHeadersForCurrentUser();
  const result = await sendResendEmail({
    from: headers.from,
    replyTo: headers.replyTo,
    to,
    subject: "Hello World",
    html: "<p>Test Resend – zkontroluj <strong>From</strong> (personalizace) a <strong>Reply-To</strong> (profil / RESEND_REPLY_TO).</p>",
  });

  if (result.ok) {
    return { ok: true as const, message: "Email sent successfully", id: result.id };
  }
  return { ok: false as const, error: result.error };
}
