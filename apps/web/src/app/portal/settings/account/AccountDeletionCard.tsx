"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestAccountDeletion } from "@/app/actions/account-deletion";

type Props = {
  isSoleAdmin: boolean;
};

export function AccountDeletionCard({ isSoleAdmin }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submittedTicket, setSubmittedTicket] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("confirmation", confirmation);
      fd.set("reason", reason);
      const res = await requestAccountDeletion(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSubmittedTicket(res.ticketId);
      setTimeout(() => {
        router.replace("/prihlaseni?account_deletion=submitted");
        router.refresh();
      }, 4000);
    });
  };

  if (submittedTicket) {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <h2 className="text-sm font-black uppercase tracking-widest text-emerald-800">
          Žádost odeslána
        </h2>
        <p className="mt-2 text-sm text-emerald-900">
          Žádost o smazání účtu jsme přijali. Číslo žádosti:{" "}
          <strong>{submittedTicket}</strong>. Potvrzení jsme Vám poslali na
          e-mail. Za pár vteřin Vás odhlásíme.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-rose-200 bg-rose-50/60 p-5">
      <h2 className="text-sm font-black uppercase tracking-widest text-rose-800">
        Smazání účtu
      </h2>
      <p className="mt-2 text-sm text-rose-900">
        Smazání účtu je nevratné. Odstraníme Vaše osobní údaje, přístup do
        Aidvisory a všechna data, která nejsou vázaná zákonnou retencí (u
        poradce typicky 10 let podle AML / DZ).
      </p>
      <p className="mt-2 text-xs text-rose-900/80">
        Po odeslání žádosti Vás odhlásíme. Smazání provedeme do 30 dnů podle
        čl. 17 GDPR. Potvrzení dostanete e-mailem.
      </p>

      {isSoleAdmin ? (
        <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-bold text-amber-900">
          Jste Admin workspace. Pokud jste jediný Admin, ještě před smazáním se
          Vám ozve podpora kvůli převodu workspace nebo smazání workspace
          dohromady s účtem. Smlouvy a dokumenty klientů nesmíme ztratit.
        </div>
      ) : null}

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 inline-flex min-h-[44px] items-center rounded-xl border border-rose-400 bg-white px-4 text-sm font-black text-rose-700 hover:bg-rose-100"
        >
          Požádat o smazání účtu
        </button>
      ) : (
        <div className="mt-4 space-y-3 rounded-xl border border-rose-300 bg-white p-4">
          <div>
            <label className="mb-1 block text-xs font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">
              Důvod (nepovinný)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={1000}
              className="w-full rounded-xl border border-[color:var(--wp-surface-card-border)] bg-white px-3 py-2 text-sm"
              placeholder="Nechcete-li, nechte prázdné."
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">
              Pro potvrzení napište SMAZAT
            </label>
            <input
              type="text"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value.toUpperCase())}
              className="w-full rounded-xl border border-rose-300 bg-white px-3 py-2 text-sm font-black tracking-widest"
              placeholder="SMAZAT"
              autoComplete="off"
            />
          </div>
          {error ? (
            <p className="rounded-lg bg-rose-100 px-3 py-2 text-xs font-bold text-rose-800">
              {error}
            </p>
          ) : null}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setConfirmation("");
                setReason("");
                setError(null);
              }}
              className="rounded-xl border border-[color:var(--wp-surface-card-border)] bg-white px-4 py-2 text-sm font-bold hover:bg-[color:var(--wp-main-scroll-bg)]"
            >
              Zrušit
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending || confirmation !== "SMAZAT"}
              className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-black text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? "Odesílám…" : "Odeslat žádost"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
