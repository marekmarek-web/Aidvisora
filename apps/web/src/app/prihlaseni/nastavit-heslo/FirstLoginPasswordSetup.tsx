"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { completeClientInvitationFirstLogin } from "@/app/actions/auth";

type InviteMeta = {
  ok?: boolean;
  email?: string;
  firstName?: string | null;
};

export function FirstLoginPasswordSetup() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [gdprConsent, setGdprConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    void fetch(`/api/invite/metadata?token=${encodeURIComponent(token)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: InviteMeta | null) => {
        if (cancelled || !data?.ok) return;
        setEmail(typeof data.email === "string" ? data.email : "");
        setFirstName(typeof data.firstName === "string" ? data.firstName : null);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");

    if (!token) {
      setMessage("Chybí token pozvánky. Otevřete prosím odkaz z e-mailu znovu.");
      return;
    }
    if (password.trim().length < 8) {
      setMessage("Nové heslo musí mít alespoň 8 znaků.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("Hesla se neshodují.");
      return;
    }

    setLoading(true);
    const result = await completeClientInvitationFirstLogin(token, password, gdprConsent);
    setLoading(false);

    if (!result.ok) {
      setMessage(result.error);
      return;
    }

    window.location.href = "/client";
  }

  return (
    <div className="min-h-dvh bg-[#0a0f29] text-white px-4 py-10 sm:py-14">
      <div className="mx-auto max-w-lg">
        <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 sm:p-10 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
          <div className="mb-8 text-center">
            <img
              src="/logos/Aidvisora%20logo%20new.png"
              alt="Aidvisora"
              className="mx-auto mb-5 h-12 w-auto max-w-[210px] object-contain brightness-0 invert"
            />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Nastavení vašeho hesla</h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              {firstName ? `Dobrý den, ${firstName}. ` : ""}
              Dokončete první vstup do klientského portálu změnou dočasného hesla.
            </p>
            {email && (
              <p className="mt-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                Přihlašujete účet <strong>{email}</strong>.
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-400">Nové heslo</label>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm font-semibold text-white outline-none transition focus:border-emerald-400 focus:bg-white/10"
                placeholder="Zadejte nové heslo"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-400">Potvrzení hesla</label>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm font-semibold text-white outline-none transition focus:border-emerald-400 focus:bg-white/10"
                placeholder="Zopakujte nové heslo"
                required
              />
            </div>

            <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={gdprConsent}
                onChange={(event) => setGdprConsent(event.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 rounded border-white/20 accent-emerald-500"
              />
              <span className="leading-relaxed">
                Souhlasím se{" "}
                <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-300 hover:underline">
                  zásadami zpracování osobních údajů
                </Link>{" "}
                a chci dokončit aktivaci klientského portálu.
              </span>
            </label>

            {message && (
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-4 text-sm font-black uppercase tracking-widest text-white transition hover:from-emerald-400 hover:to-teal-500 disabled:opacity-70"
            >
              {loading ? "Dokončuji přístup…" : "Uložit nové heslo a vstoupit"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
