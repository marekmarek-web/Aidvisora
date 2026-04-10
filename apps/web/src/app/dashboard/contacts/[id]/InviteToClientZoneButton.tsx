"use client";

import { useState } from "react";
import { sendClientZoneInvitation } from "@/app/actions/auth";

export function InviteToClientZoneButton({ contactId }: { contactId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    link?: string;
    loginEmail?: string;
    temporaryPassword?: string;
    emailSent?: boolean;
    emailError?: string;
    reminderOnly?: boolean;
    error?: string;
    devHint?: string;
  } | null>(null);

  async function handleClick() {
    setLoading(true);
    setResult(null);
    try {
      const res = await sendClientZoneInvitation(contactId);
      if (res.ok) {
        setResult({
          link: res.inviteLink,
          loginEmail: res.loginEmail,
          temporaryPassword: res.temporaryPassword,
          emailSent: res.emailSent,
          emailError: res.emailError,
          reminderOnly: res.reminderOnly,
        });
      } else {
        setResult({
          error: res.error,
          ...(res.devHint ? { devHint: res.devHint } : {}),
        });
      }
    } catch {
      setResult({
        error: "Nepodařilo se odeslat pozvánku. Zkuste to znovu.",
        ...(process.env.NODE_ENV === "development"
          ? {
              devHint:
                "Server action se nepodařila dokončit (síť nebo pád na serveru). Podívejte se do terminálu, kde běží pnpm dev.",
            }
          : {}),
      });
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!result?.link) return;
    try {
      await navigator.clipboard.writeText(result.link);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="min-h-[44px] rounded-xl px-4 py-2.5 text-sm font-semibold border border-monday-border text-monday-text hover:bg-monday-row-hover disabled:opacity-50"
      >
        {loading ? "Odesílám…" : "Pozvat do klientské zóny (e-mail + odkaz)"}
      </button>
      {result?.link && (
        <div className="rounded-lg bg-monday-row-hover border border-monday-border p-3 text-sm space-y-2">
          <p className="font-medium text-monday-text">
            {result.reminderOnly
              ? result.emailSent
                ? "Připomínka k přihlášení byla odeslána na e-mail klienta (heslo se neměnilo)."
                : "Připomínkový e-mail se nepodařilo odeslat automaticky."
              : result.emailSent
                ? "Pozvánka s přístupovými údaji byla odeslána na e-mail klienta."
                : "E-mail s přístupovými údaji se nepodařilo odeslat automaticky."}
          </p>
          {!result.emailSent && (
            <p className="text-monday-text-muted text-xs">
              {result.reminderOnly
                ? result.emailError === "RESEND_API_KEY not set"
                  ? "Nastavte RESEND_API_KEY (a ověřenou doménu odesílatele), nebo klientovi pošlete odkaz na přihlášení ručně."
                  : result.emailError
                    ? `Důvod: ${result.emailError}. Pošlete klientovi ručně odkaz níže.`
                    : "Pošlete klientovi ručně odkaz na přihlášení níže."
                : result.emailError === "RESEND_API_KEY not set"
                  ? "Nastavte RESEND_API_KEY (a ověřenou doménu odesílatele), nebo klientovi pošlete odkaz i dočasné heslo ručně."
                  : result.emailError
                    ? `Důvod: ${result.emailError}. Pošlete klientovi ručně odkaz i dočasné heslo níže.`
                    : "Pošlete klientovi ručně odkaz i dočasné heslo níže."}
            </p>
          )}
          {result.loginEmail && (
            <p className="text-monday-text-muted text-xs">
              Přihlašovací e-mail: <span className="font-medium text-monday-text">{result.loginEmail}</span>
            </p>
          )}
          {result.temporaryPassword && (
            <p className="text-monday-text-muted text-xs">
              Dočasné heslo: <span className="font-medium text-monday-text">{result.temporaryPassword}</span>
            </p>
          )}
          <p className="text-monday-text-muted break-all text-xs">{result.link}</p>
          <button
            type="button"
            onClick={copyLink}
            className="min-h-[44px] w-full sm:w-auto rounded-lg border border-monday-border px-4 py-2 text-sm font-medium text-monday-text hover:bg-monday-row-hover"
          >
            Zkopírovat odkaz
          </button>
        </div>
      )}
      {result?.error && (
        <div className="space-y-1">
          <p className="text-sm text-red-600">{result.error}</p>
          {result.devHint && (
            <p className="text-xs text-monday-text-muted font-mono break-words">{result.devHint}</p>
          )}
        </div>
      )}
    </div>
  );
}
