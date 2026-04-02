"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CreateActionButton } from "@/app/components/ui/CreateActionButton";
import { queryKeys } from "@/lib/query-keys";

type Provider = "gmail" | "drive";

type Status = {
  connected: boolean;
  email?: string;
  error?: string;
};

function IntegrationWorkspaceSkeleton() {
  return (
    <div
      className="flex h-full min-h-[500px] w-full animate-pulse gap-0 overflow-hidden rounded-2xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)]"
      role="status"
      aria-label="Načítání rozhraní…"
    >
      <div className="hidden w-[min(260px,32vw)] shrink-0 flex-col border-r border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-muted)] p-4 md:flex">
        <div className="mb-6 h-9 w-28 rounded-lg bg-[color:var(--wp-skeleton-bg)]" />
        <div className="mb-4 h-10 w-full rounded-xl bg-[color:var(--wp-skeleton-bg)]" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 rounded-lg bg-[color:var(--wp-skeleton-bg)]" />
          ))}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-4">
        <div className="mb-4 h-10 w-full max-w-lg rounded-lg bg-[color:var(--wp-skeleton-bg)]" />
        <div className="flex min-h-0 flex-1 gap-3">
          <div className="min-h-[280px] flex-1 rounded-xl bg-[color:var(--wp-skeleton-bg)]" />
          <div className="hidden min-h-[280px] flex-1 rounded-xl bg-[color:var(--wp-skeleton-bg)] lg:block" />
        </div>
      </div>
    </div>
  );
}

export function IntegrationConnectionGate({
  provider,
  children,
}: {
  provider: Provider;
  children: React.ReactNode;
}) {
  const statusUrl = provider === "gmail" ? "/api/gmail/status" : "/api/drive/status";
  const queryKey =
    provider === "gmail" ? queryKeys.integrations.gmailStatus() : queryKeys.integrations.driveStatus();

  const { data: status, isPending } = useQuery({
    queryKey,
    queryFn: async (): Promise<Status> => {
      const res = await fetch(statusUrl);
      const data = (await res.json().catch(() => ({}))) as {
        connected?: boolean;
        email?: string;
        error?: string;
      };
      if (!res.ok) {
        return {
          connected: false,
          error: data.error ?? "Nepodařilo se načíst stav integrace.",
        };
      }
      return {
        connected: Boolean(data.connected),
        email: data.email,
      };
    },
    staleTime: 60_000,
  });

  const connectHref =
    provider === "gmail" ? "/api/integrations/gmail/connect" : "/api/integrations/google-drive/connect";

  if (isPending) {
    return <IntegrationWorkspaceSkeleton />;
  }

  if (!status?.connected) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900/40 dark:bg-amber-950/30">
        <h2 className="text-lg font-bold text-[color:var(--wp-text)]">
          {provider === "gmail" ? "Gmail není připojený" : "Google Drive není připojený"}
        </h2>
        <p className="mt-2 text-sm text-[color:var(--wp-text-secondary)]">
          Pro práci v tomto workspace je potřeba nejdřív propojit váš Google účet.
        </p>
        {status?.error ? <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">{status.error}</p> : null}
        <div className="mt-4 flex flex-wrap gap-3">
          <CreateActionButton href={connectHref} nativeAnchor icon={null}>
            Připojit Google účet
          </CreateActionButton>
          <Link
            href={`/portal/setup?tab=integrace&provider=${provider === "gmail" ? "gmail" : "google-drive"}`}
            className="min-h-[44px] rounded-xl border border-[color:var(--wp-border-strong)] px-4 py-2.5 text-sm font-bold text-[color:var(--wp-text-secondary)]"
          >
            Otevřít Integrace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-bold uppercase tracking-wider text-[color:var(--wp-text-secondary)]">
        Připojeno jako {status.email ?? "Google účet"}
      </p>
      {children}
    </div>
  );
}
