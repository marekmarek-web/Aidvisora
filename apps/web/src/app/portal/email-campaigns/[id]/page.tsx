import Link from "next/link";
import { notFound } from "next/navigation";
import { getCampaignDetail } from "@/app/actions/email-campaign-detail";
import CampaignDetailClient from "./CampaignDetailClient";

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let data: Awaited<ReturnType<typeof getCampaignDetail>>;
  try {
    data = await getCampaignDetail(id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("nebyla nalezena")) return notFound();
    throw e;
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 md:px-8 md:py-10">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/portal/email-campaigns"
          className="text-sm font-bold text-[color:var(--wp-text-tertiary)] hover:text-[color:var(--wp-text)]"
        >
          ← Zpět na kampaně
        </Link>
      </div>
      <CampaignDetailClient data={data} />
    </div>
  );
}
