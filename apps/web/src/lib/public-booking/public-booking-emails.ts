import "server-only";

import { sendEmail } from "@/lib/email/send-email";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatBookingWhen(startAt: Date): string {
  return startAt.toLocaleString("cs-CZ", {
    timeZone: "Europe/Prague",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Jednoduchý layout pro transakční e-maily (tabulky = lepší kompatibilita klientů). */
function transactionalEmailShell(bodyInner: string): string {
  return `<!DOCTYPE html>
<html lang="cs">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:16px;line-height:1.5;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:24px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.08);">
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#4f46e5,#6366f1);"></td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px 28px;">
              ${bodyInner}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 28px 28px;border-top:1px solid #e2e8f0;">
              <p style="margin:16px 0 0 0;color:#64748b;font-size:13px;line-height:1.45;">Tato zpráva byla odeslána automaticky po rezervaci přes veřejný odkaz.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Best-effort e-maily po veřejné rezervaci — nehází výjimku při výpadku Resendu.
 */
export async function sendPublicBookingNotifications(opts: {
  clientEmail: string;
  clientName: string;
  advisorEmail: string | null;
  advisorName: string;
  companyName: string;
  startAt: Date;
  endAt: Date;
}): Promise<void> {
  const when = formatBookingWhen(opts.startAt);
  const safeName = escapeHtml(opts.clientName);
  const safeAdvisor = escapeHtml(opts.advisorName);
  const safeCompany = escapeHtml(opts.companyName || "Aidvisora");

  const clientInner = `
              <p style="margin:0 0 8px 0;font-size:13px;font-weight:600;letter-spacing:0.02em;color:#4f46e5;text-transform:uppercase;">Potvrzení rezervace</p>
              <h1 style="margin:0 0 20px 0;font-size:22px;font-weight:700;line-height:1.25;color:#0f172a;">Dobrý den, ${safeName}</h1>
              <p style="margin:0 0 16px 0;color:#334155;">Potvrzujeme váš vybraný termín schůzky.</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;background-color:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0 0 4px 0;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;">Termín</p>
                    <p style="margin:0;font-size:17px;font-weight:600;color:#0f172a;">${escapeHtml(when)}</p>
                    <p style="margin:8px 0 0 0;font-size:13px;color:#64748b;">Časové pásmo: Europe/Prague</p>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px 0;color:#334155;"><strong style="color:#0f172a;">Poradce:</strong> ${safeAdvisor}${opts.companyName ? ` <span style="color:#64748b;">(${safeCompany})</span>` : ""}</p>
              <p style="margin:0;color:#334155;">Pokud potřebujete termín změnit, kontaktujte prosím poradce přímo.</p>
  `;

  const clientHtml = transactionalEmailShell(clientInner);

  try {
    await sendEmail({
      to: opts.clientEmail,
      subject: `Potvrzení schůzky — ${when}`,
      html: clientHtml,
    });
  } catch {
    /* ignore */
  }

  if (!opts.advisorEmail?.trim()) return;

  const advInner = `
              <p style="margin:0 0 8px 0;font-size:13px;font-weight:600;letter-spacing:0.02em;color:#4f46e5;text-transform:uppercase;">Veřejná rezervace</p>
              <h1 style="margin:0 0 20px 0;font-size:22px;font-weight:700;line-height:1.25;color:#0f172a;">Nová rezervace</h1>
              <p style="margin:0 0 16px 0;color:#334155;">Klient si vybral termín přes veřejný odkaz.</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;background-color:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0 0 10px 0;"><strong style="color:#0f172a;">Klient:</strong> <span style="color:#334155;">${safeName}</span></p>
                    <p style="margin:0 0 10px 0;"><strong style="color:#0f172a;">E-mail:</strong> <a href="mailto:${escapeHtml(opts.clientEmail)}" style="color:#4f46e5;text-decoration:none;">${escapeHtml(opts.clientEmail)}</a></p>
                    <p style="margin:0;"><strong style="color:#0f172a;">Termín:</strong> <span style="color:#334155;">${escapeHtml(when)}</span></p>
                  </td>
                </tr>
              </table>
              <p style="margin:0;color:#334155;">Událost je zapsaná ve vašem kalendáři v Aidvisoře.</p>
  `;

  const advHtml = transactionalEmailShell(advInner);

  try {
    await sendEmail({
      to: opts.advisorEmail.trim(),
      subject: `Nová webová rezervace — ${opts.clientName}`,
      html: advHtml,
    });
  } catch {
    /* ignore */
  }
}
