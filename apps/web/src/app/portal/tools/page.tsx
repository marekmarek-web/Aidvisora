import Link from "next/link";

export const dynamic = "force-dynamic";

export default function PortalToolsIndexPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-black text-[color:var(--wp-text)]">Nástroje Google</h1>
      <p className="mt-2 text-sm text-[color:var(--wp-text-secondary)]">
        Otevřete plnohodnotný interní workspace pro Gmail nebo Google Drive.
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Link
          href="/portal/tools/gmail"
          className="rounded-2xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] p-5 transition hover:border-indigo-300 hover:shadow-sm"
        >
          <h2 className="text-lg font-bold text-[color:var(--wp-text)]">Gmail Workspace</h2>
          <p className="mt-1 text-sm text-[color:var(--wp-text-secondary)]">Inbox, detail, thready, compose, reply a label akce.</p>
        </Link>
        <Link
          href="/portal/tools/drive"
          className="rounded-2xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] p-5 transition hover:border-indigo-300 hover:shadow-sm"
        >
          <h2 className="text-lg font-bold text-[color:var(--wp-text)]">Google Drive Workspace</h2>
          <p className="mt-1 text-sm text-[color:var(--wp-text-secondary)]">Browse, upload, rename, share, download i mazání souborů.</p>
        </Link>
      </div>
    </div>
  );
}
