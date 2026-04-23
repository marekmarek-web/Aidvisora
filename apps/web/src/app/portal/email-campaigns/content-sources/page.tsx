import Link from "next/link";
import { listContentSources } from "@/app/actions/email-content-sources";
import ContentSourcesClient from "./ContentSourcesClient";

export const dynamic = "force-dynamic";

export default async function ContentSourcesPage() {
  let sources: Awaited<ReturnType<typeof listContentSources>> = [];
  let forbidden = false;
  try {
    sources = await listContentSources();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("oprávnění") || msg.includes("Nemáte")) forbidden = true;
  }

  if (forbidden) {
    return (
      <div className="p-4 md:p-6">
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Zdroje obsahu jsou dostupné uživatelům s oprávněním ke kontaktům.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 md:px-8 md:py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/portal/email-campaigns"
            className="text-xs font-bold text-[color:var(--wp-text-tertiary)] hover:text-[color:var(--wp-text)]"
          >
            ← Zpět na kampaně
          </Link>
          <h1 className="mt-2 text-2xl font-black text-[color:var(--wp-text)]">
            Zdroje obsahu
          </h1>
          <p className="mt-1 text-sm text-[color:var(--wp-text-secondary)]">
            Ručně kurátované články z důvěryhodných zpravodajských portálů, které
            můžete vložit do newsletterů. Metadata (titulek, popis, obrázek) se
            automaticky stáhnou z Open Graph.
          </p>
        </div>
      </div>
      <ContentSourcesClient initialSources={sources} />
    </div>
  );
}
