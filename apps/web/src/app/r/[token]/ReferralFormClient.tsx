"use client";

import { useState, useTransition } from "react";
import { submitReferralAction } from "@/app/actions/referral-public";

type Props = { token: string };

export default function ReferralFormClient({ token }: Props) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await submitReferralAction({
          token,
          firstName,
          lastName,
          email: email || null,
          phone: phone || null,
          note: note || null,
          consent,
        });
        setDone(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  };

  if (done) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-600">
          ✓
        </div>
        <h2 className="text-xl font-black">Děkujeme za doporučení!</h2>
        <p className="mt-2 text-sm text-[color:var(--wp-text-secondary)]">
          Poradce se Vám ozve obvykle do 2 pracovních dnů.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Jméno" required>
          <input
            required
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full rounded-xl border border-[color:var(--wp-surface-card-border)] bg-white px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Příjmení" required>
          <input
            required
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full rounded-xl border border-[color:var(--wp-surface-card-border)] bg-white px-3 py-2 text-sm"
          />
        </Field>
        <Field label="E-mail">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-[color:var(--wp-surface-card-border)] bg-white px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Telefon">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-xl border border-[color:var(--wp-surface-card-border)] bg-white px-3 py-2 text-sm"
          />
        </Field>
      </div>

      <Field label="Co Vás zajímá? (volitelné)">
        <textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Např. hypotéka, investice, penze, pojištění…"
          className="w-full rounded-xl border border-[color:var(--wp-surface-card-border)] bg-white px-3 py-2 text-sm"
        />
      </Field>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5"
        />
        <span className="text-xs text-[color:var(--wp-text-secondary)]">
          Souhlasím se zpracováním osobních údajů pro účely kontaktu poradcem.
        </span>
      </label>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending || !firstName || !lastName || !consent || (!email && !phone)}
        className="w-full rounded-xl bg-[color:var(--wp-primary)] px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-[color:var(--wp-primary-hover)] disabled:opacity-50"
      >
        {isPending ? "Odesílám…" : "Odeslat doporučení"}
      </button>
    </form>
  );
}

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">
        {label} {required ? <span className="text-rose-500">*</span> : null}
      </span>
      {children}
    </label>
  );
}
