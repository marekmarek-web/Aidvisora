import Link from "next/link";
import { listEmailCampaigns } from "@/app/actions/email-campaigns";
import { EmailCampaignsClient } from "./EmailCampaignsClient";

export const dynamic = "force-dynamic";

export default async function EmailCampaignsPage() {
  let rows: Awaited<ReturnType<typeof listEmailCampaigns>> = [];
  let forbidden = false;
  try {
    rows = await listEmailCampaigns();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("oprávnění") || msg.includes("Nemáte")) forbidden = true;
    rows = [];
  }

  return (
    <div className="space-y-4 p-4 wp-fade-in md:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[color:var(--wp-text)]">E-mail kampaně</h1>
          <p className="text-sm text-[color:var(--wp-text-secondary)]">
            Jednoduché hromadné zprávy klientům (MVP). Segment: všichni způsobilí kontakty v tenantu.
          </p>
        </div>
        <Link
          href="/portal/contacts"
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[color:var(--wp-surface-card-border)] px-4 text-sm font-semibold text-indigo-600 hover:bg-[color:var(--wp-link-hover-bg)]"
        >
          ← Klienti
        </Link>
      </div>

      {forbidden ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Tuto stránku mohou používat uživatelé s oprávněním ke kontaktům.
        </p>
      ) : (
        <EmailCampaignsClient initialRows={rows} />
      )}
    </div>
  );
}
