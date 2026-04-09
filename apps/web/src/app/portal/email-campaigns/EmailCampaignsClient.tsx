"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Send } from "lucide-react";
import {
  createEmailCampaignDraft,
  sendEmailCampaign,
  type EmailCampaignRow,
} from "@/app/actions/email-campaigns";
import { useToast } from "@/app/components/Toast";
import { useConfirm } from "@/app/components/ConfirmDialog";
import { formatInTimeZone } from "date-fns-tz";

const PRAGUE = "Europe/Prague";

function formatPragueDateTime(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return formatInTimeZone(d, PRAGUE, "dd.MM.yyyy HH:mm");
}

const SAMPLE_HTML = `<p>Dobrý den, {{jmeno}},</p>
<p>… text zprávy …</p>
<p>S pozdravem</p>`;

function statusLabel(status: string): string {
  switch (status) {
    case "draft":
      return "Koncept";
    case "sending":
      return "Odesílání";
    case "sent":
      return "Odesláno";
    case "failed":
      return "Selhalo";
    default:
      return status;
  }
}

export function EmailCampaignsClient({ initialRows }: { initialRows: EmailCampaignRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState(SAMPLE_HTML);

  const onCreate = () => {
    startTransition(async () => {
      try {
        await createEmailCampaignDraft({ name, subject, bodyHtml });
        toast.showToast("Koncept kampaně byl vytvořen.", "success");
        setName("");
        setSubject("");
        setBodyHtml(SAMPLE_HTML);
        router.refresh();
      } catch (e) {
        toast.showToast(e instanceof Error ? e.message : "Nepodařilo se vytvořit kampaň.", "error");
      }
    });
  };

  const onSend = (campaign: EmailCampaignRow) => {
    void confirm({
      title: "Odeslat kampaň?",
      message:
        "Zpráva se odešle všem klientům s vyplněným e-mailem, bez zákazu e-mailu a bez odhlášení z notifikací (max. 80 příjemců na jedno odeslání). Odeslat nelze zrušit.",
      confirmLabel: "Odeslat",
      cancelLabel: "Zrušit",
      variant: "destructive",
    }).then((ok) => {
      if (!ok) return;
      startTransition(async () => {
        try {
          const r = await sendEmailCampaign(campaign.id);
          const parts = [`Odesláno: ${r.sent}`];
          if (r.failed) parts.push(`chyby: ${r.failed}`);
          if (r.skipped) parts.push(`přeskočeno: ${r.skipped}`);
          if (r.capped) parts.push(`(omezeno na ${r.cap} příjemců — zbytek další kampaní)`);
          toast.showToast(parts.join(", "), r.failed && !r.sent ? "error" : "success");
          router.refresh();
        } catch (e) {
          toast.showToast(e instanceof Error ? e.message : "Odeslání se nepovedlo.", "error");
        }
      });
    });
  };

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] p-4 md:p-6">
        <h2 className="text-base font-semibold text-[color:var(--wp-text)]">Nový koncept</h2>
        <p className="mt-1 text-sm text-[color:var(--wp-text-secondary)]">
          V HTML můžete použít zástupné znaky <code className="rounded bg-[color:var(--wp-surface-muted)] px-1">{"{{jmeno}}"}</code> a{" "}
          <code className="rounded bg-[color:var(--wp-surface-muted)] px-1">{"{{cele_jmeno}}"}</code>.
        </p>
        <div className="mt-4 grid gap-4">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[color:var(--wp-text-tertiary)]">
              Název (interní)
            </label>
            <input
              className="w-full rounded-xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-muted)] px-3 py-2 text-sm text-[color:var(--wp-text)] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Např. Jarní newsletter 2026"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[color:var(--wp-text-tertiary)]">
              Předmět e-mailu
            </label>
            <input
              className="w-full rounded-xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-muted)] px-3 py-2 text-sm text-[color:var(--wp-text)] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Předmět, který uvidí klient"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[color:var(--wp-text-tertiary)]">
              Tělo (HTML)
            </label>
            <textarea
              className="min-h-[180px] w-full rounded-xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-muted)] px-3 py-2 font-mono text-xs text-[color:var(--wp-text)] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
            />
          </div>
          <div>
            <button
              type="button"
              disabled={pending}
              onClick={onCreate}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Uložit koncept"}
            </button>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-[color:var(--wp-text)]">Poslední kampaně</h2>
        {initialRows.length === 0 ? (
          <p className="text-sm text-[color:var(--wp-text-secondary)]">Zatím žádný koncept ani odeslaná kampaň.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[color:var(--wp-surface-card-border)]">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="border-b border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-muted)] text-xs uppercase tracking-wider text-[color:var(--wp-text-secondary)]">
                <tr>
                  <th className="px-4 py-3 font-bold">Název</th>
                  <th className="px-4 py-3 font-bold">Předmět</th>
                  <th className="px-4 py-3 font-bold">Stav</th>
                  <th className="px-4 py-3 font-bold">Vytvořeno</th>
                  <th className="px-4 py-3 font-bold">Odesláno</th>
                  <th className="w-36 px-4 py-3 font-bold" />
                </tr>
              </thead>
              <tbody>
                {initialRows.map((row) => (
                  <tr key={row.id} className="border-b border-[color:var(--wp-surface-card-border)] last:border-0">
                    <td className="px-4 py-3 font-medium text-[color:var(--wp-text)]">{row.name}</td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-[color:var(--wp-text-secondary)]">{row.subject}</td>
                    <td className="px-4 py-3 text-[color:var(--wp-text)]">{statusLabel(row.status)}</td>
                    <td className="px-4 py-3 text-[color:var(--wp-text-secondary)]">{formatPragueDateTime(row.createdAt)}</td>
                    <td className="px-4 py-3 text-[color:var(--wp-text-secondary)]">
                      {row.sentAt ? formatPragueDateTime(row.sentAt) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {row.status === "draft" ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => onSend(row)}
                          className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-200"
                        >
                          <Send className="h-3.5 w-3.5" />
                          Odeslat
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-[color:var(--wp-text-tertiary)]">
          Historii jednotlivých odeslání uvidíte v{" "}
          <Link href="/portal/settings/notification-log" className="font-semibold text-indigo-600 underline-offset-2 hover:underline">
            historii e-mailů
          </Link>{" "}
          (šablona <code className="rounded bg-[color:var(--wp-surface-muted)] px-1">email_campaign</code>).
        </p>
      </section>
    </div>
  );
}
