/**
 * Resend vyžaduje ověřenou doménu v poli `from`. Firemní adresu (např. poradce@beplan.cz)
 * bez ověření v Resend použij jako **Reply-To**: odpovědi pak jdou na poradce, odesílatel zůstane např. noreply@aidvisora.cz.
 *
 * Priorita: explicitní e-mail z volání > env `RESEND_REPLY_TO`.
 */
export function resolveResendReplyTo(explicit?: string | null): string | undefined {
  const v = explicit?.trim() || process.env.RESEND_REPLY_TO?.trim();
  return v || undefined;
}
