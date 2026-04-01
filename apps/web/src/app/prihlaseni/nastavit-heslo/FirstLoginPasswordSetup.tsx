"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, ArrowRight, CheckCircle2, Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";
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
  const [showPassword, setShowPassword] = useState(false);
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

  const passwordLongEnough = password.trim().length >= 8;
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");

    if (!token) {
      setMessage("Chybí token pozvánky. Otevřete prosím odkaz z e-mailu znovu.");
      return;
    }
    if (!passwordLongEnough) {
      setMessage("Nové heslo musí mít alespoň 8 znaků.");
      return;
    }
    if (!passwordsMatch) {
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
    <div className="min-h-dvh bg-[#0a0f29] text-white flex flex-col items-center justify-start sm:justify-center px-4 py-10 sm:py-14 relative overflow-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@500;700;800&display=swap');
        .font-inter { font-family: 'Inter', sans-serif; }
        .font-jakarta { font-family: 'Plus Jakarta Sans', sans-serif; }
      `}</style>

      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-600/20 blur-[120px] rounded-full" />
        <div className="absolute top-[20%] right-[-10%] w-[40%] h-[60%] bg-purple-600/15 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 w-full max-w-[460px]">
        <div className="rounded-[32px] border border-white/10 bg-white/5 backdrop-blur-2xl p-6 sm:p-10 shadow-[0_8px_32px_rgba(0,0,0,0.35)] font-inter">
          <div className="mb-8 text-center">
            <img
              src="/logos/Aidvisora%20logo%20new.png"
              alt="Aidvisora"
              className="mx-auto mb-5 h-12 w-auto max-w-[210px] object-contain brightness-0 invert"
            />
            <h1 className="font-jakarta text-2xl sm:text-3xl font-bold tracking-tight mb-2">
              {firstName ? `${firstName}, nastavte si heslo` : "Nastavte si heslo"}
            </h1>
            <p className="text-sm leading-relaxed text-slate-300 max-w-xs mx-auto">
              Poslední krok. Zvolte si vlastní heslo pro přístup do klientského portálu.
            </p>
          </div>

          {email && (
            <div className="mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100 flex items-center gap-3">
              <ShieldCheck size={16} className="shrink-0 text-emerald-300" />
              <span>Krok 2 ze 2 · účet <strong>{email}</strong></span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-400">Nové heslo</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-emerald-400 transition-colors">
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] pl-11 pr-12 py-3.5 text-sm font-bold text-white outline-none transition focus:border-emerald-400 focus:bg-white/[0.08] focus:ring-4 focus:ring-emerald-500/15 placeholder:text-white/30"
                  placeholder="Alespoň 8 znaků"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-slate-300 transition-colors min-h-[48px] min-w-[44px]"
                  aria-label={showPassword ? "Skrýt heslo" : "Zobrazit heslo"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {password.length > 0 && (
                <div className={`mt-2 flex items-center gap-2 text-xs font-medium ${passwordLongEnough ? "text-emerald-400" : "text-slate-500"}`}>
                  <CheckCircle2 size={14} />
                  <span>Alespoň 8 znaků</span>
                </div>
              )}
            </div>

            <div>
              <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-400">Potvrzení hesla</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-emerald-400 transition-colors">
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] pl-11 pr-4 py-3.5 text-sm font-bold text-white outline-none transition focus:border-emerald-400 focus:bg-white/[0.08] focus:ring-4 focus:ring-emerald-500/15 placeholder:text-white/30"
                  placeholder="Zopakujte nové heslo"
                  required
                />
              </div>
              {confirmPassword.length > 0 && (
                <div className={`mt-2 flex items-center gap-2 text-xs font-medium ${passwordsMatch ? "text-emerald-400" : "text-rose-400"}`}>
                  <CheckCircle2 size={14} />
                  <span>{passwordsMatch ? "Hesla se shodují" : "Hesla se neshodují"}</span>
                </div>
              )}
            </div>

            <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-sm text-slate-200 cursor-pointer hover:bg-white/[0.06] transition">
              <input
                type="checkbox"
                checked={gdprConsent}
                onChange={(event) => setGdprConsent(event.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 accent-emerald-500"
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
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 flex items-start gap-3">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <p>{message}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-4 text-sm font-black uppercase tracking-widest text-white transition hover:from-emerald-400 hover:to-teal-500 disabled:opacity-70 shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2 group min-h-[52px]"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Vstoupit do portálu
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-[11px] text-slate-500 font-medium">
          © {new Date().getFullYear()} Aidvisora. Všechna práva vyhrazena.
        </p>
      </div>
    </div>
  );
}
