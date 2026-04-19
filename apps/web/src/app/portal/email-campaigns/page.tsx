import {
  listEmailCampaignsFull,
  getSegmentCounts,
} from "@/app/actions/email-campaigns";
import { EmailCampaignsClient } from "./EmailCampaignsClient";

export const dynamic = "force-dynamic";

export default async function EmailCampaignsPage() {
  let rows: Awaited<ReturnType<typeof listEmailCampaignsFull>> = [];
  let segments: Awaited<ReturnType<typeof getSegmentCounts>> = [];
  let forbidden = false;
  try {
    const [r, s] = await Promise.all([listEmailCampaignsFull(), getSegmentCounts()]);
    rows = r;
    segments = s;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("oprávnění") || msg.includes("Nemáte")) forbidden = true;
    rows = [];
    segments = [];
  }

  if (forbidden) {
    return (
      <div className="p-4 md:p-6">
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Tuto stránku mohou používat uživatelé s oprávněním ke kontaktům.
        </p>
      </div>
    );
  }

  return <EmailCampaignsClient initialRows={rows} initialSegments={segments} />;
}
