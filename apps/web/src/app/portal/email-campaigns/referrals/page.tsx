import Link from "next/link";
import {
  listReferralRequests,
  getReferralStats,
} from "@/app/actions/email-referrals";

export const dynamic = "force-dynamic";

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("cs-CZ", { dateStyle: "short", timeStyle: "short" });
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    sent: "Odesláno",
    opened: "Otevřeno",
    submitted: "Vyplněno",
    expired: "Vypršelo",
  };
  return map[s] ?? s;
}

function statusTone(s: string): string {
  switch (s) {
    case "submitted":
      return "bg-emerald-100 text-emerald-700";
    case "opened":
      return "bg-sky-100 text-sky-700";
    case "expired":
      return "bg-slate-100 text-slate-700";
    default:
      return "bg-amber-100 text-amber-700";
  }
}

export default async function ReferralsPage() {
  let rows: Awaited<ReturnType<typeof listReferralRequests>> = [];
  let stats: Awaited<ReturnType<typeof getReferralStats>> = {
    total: 0,
    opened: 0,
    submitted: 0,
    conversionRate: 0,
  };
  let forbidden = false;
  try {
    [rows, stats] = await Promise.all([listReferralRequests(), getReferralStats()]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("oprávnění") || msg.includes("Nemáte")) forbidden = true;
  }

  if (forbidden) {
    return (
      <div className="p-4 md:p-6">
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Doporučení jsou dostupná uživatelům s oprávněním ke kontaktům.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 md:px-8 md:py-10">
      <div className="mb-6">
        <Link
          href="/portal/email-campaigns"
          className="text-xs font-bold text-[color:var(--wp-text-tertiary)] hover:text-[color:var(--wp-text)]"
        >
          ← Zpět na kampaně
        </Link>
        <h1 className="mt-2 text-2xl font-black text-[color:var(--wp-text)]">
          Doporučení a referrals
        </h1>
        <p className="mt-1 text-sm text-[color:var(--wp-text-secondary)]">
          Přehled všech žádostí o doporučení. Žádost vygenerujete v detailu kontaktu.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Odesláno" value={stats.total.toString()} />
        <KpiCard label="Otevřeno" value={stats.opened.toString()} />
        <KpiCard label="Vyplněno" value={stats.submitted.toString()} tone="emerald" />
        <KpiCard
          label="Konverze"
          value={`${(stats.conversionRate * 100).toFixed(1)} %`}
          tone="emerald"
        />
      </div>

      <div className="rounded-[var(--wp-radius-card)] border border-[color:var(--wp-surface-card-border)] bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-[color:var(--wp-main-scroll-bg)] text-xs uppercase tracking-wider text-[color:var(--wp-text-tertiary)]">
            <tr>
              <th className="px-5 py-3 text-left">Kontakt</th>
              <th className="px-5 py-3 text-left">Stav</th>
              <th className="px-5 py-3 text-left">Vytvořeno</th>
              <th className="px-5 py-3 text-left">Otevřeno</th>
              <th className="px-5 py-3 text-left">Vyplněno</th>
              <th className="px-5 py-3 text-left">Vyprší</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--wp-surface-card-border)]">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-8 text-center text-sm text-[color:var(--wp-text-tertiary)]"
                >
                  Zatím nebyly vygenerovány žádné referral odkazy.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-5 py-3">
                    <Link
                      href={`/portal/contacts/${r.contactId}`}
                      className="font-bold text-[color:var(--wp-text)] hover:text-indigo-600"
                    >
                      {r.contactFirstName} {r.contactLastName}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${statusTone(r.status)}`}
                    >
                      {statusLabel(r.status)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[color:var(--wp-text-secondary)]">
                    {formatDate(r.createdAt)}
                  </td>
                  <td className="px-5 py-3 text-[color:var(--wp-text-secondary)]">
                    {formatDate(r.openedAt)}
                  </td>
                  <td className="px-5 py-3 text-[color:var(--wp-text-secondary)]">
                    {formatDate(r.submittedAt)}
                  </td>
                  <td className="px-5 py-3 text-[color:var(--wp-text-secondary)]">
                    {formatDate(r.expiresAt)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <CopyLinkButton token={r.token} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "emerald";
}) {
  const cls = tone === "emerald" ? "text-emerald-600" : "text-[color:var(--wp-text)]";
  return (
    <div className="rounded-[var(--wp-radius-card)] border border-[color:var(--wp-surface-card-border)] bg-white p-4 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-black ${cls}`}>{value}</p>
    </div>
  );
}

function CopyLinkButton({ token }: { token: string }) {
  return (
    <a
      href={`/r/${token}`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 rounded-lg border border-[color:var(--wp-surface-card-border)] bg-white px-3 py-1 text-xs font-bold text-[color:var(--wp-text)] hover:bg-[color:var(--wp-main-scroll-bg)]"
    >
      Otevřít odkaz
    </a>
  );
}
