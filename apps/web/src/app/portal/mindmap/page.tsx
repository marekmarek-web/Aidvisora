"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getMindmap, listRecentClientMaps, listStandaloneMaps } from "@/app/actions/mindmap";
import type { MindmapState, ClientMapItem, FreeMapItem } from "@/app/actions/mindmap";
import { MindmapListClient } from "./MindmapListClient";

const MindmapView = dynamic(
  () => import("./MindmapView").then((m) => m.MindmapView),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 min-h-[50vh] items-center justify-center text-[color:var(--wp-text-secondary)] text-sm">Načítání mapy…</div>
    ),
  },
);

export default function MindmapPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const contactId = searchParams.get("contactId");
  const householdId = searchParams.get("householdId");

  const [state, setState] = useState<MindmapState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientMaps, setClientMaps] = useState<ClientMapItem[]>([]);
  const [standaloneMaps, setStandaloneMaps] = useState<FreeMapItem[]>([]);
  const [listRefreshKey, setListRefreshKey] = useState(0);

  useEffect(() => {
    if (contactId) {
      setLoading(true);
      setError(null);
      getMindmap("contact", contactId)
        .then(setState)
        .catch((e) => {
          setError(e instanceof Error ? e.message : "Chyba načtení");
          setState(null);
        })
        .finally(() => setLoading(false));
    } else if (householdId) {
      setLoading(true);
      setError(null);
      getMindmap("household", householdId)
        .then(setState)
        .catch((e) => {
          setError(e instanceof Error ? e.message : "Chyba načtení");
          setState(null);
        })
        .finally(() => setLoading(false));
    } else {
      setState(null);
      setError(null);
      setLoading(false);
      Promise.all([listRecentClientMaps(), listStandaloneMaps()])
        .then(([client, standalone]) => {
          setClientMaps(client);
          setStandaloneMaps(standalone);
        })
        .catch(() => {});
    }
  }, [contactId, householdId, listRefreshKey]);

  const refreshList = () => setListRefreshKey((k) => k + 1);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-[color:var(--wp-main-scroll-bg)]">
        <p className="text-[color:var(--wp-text-secondary)] font-medium">Načítám mapu…</p>
      </div>
    );
  }

  if (error && (contactId || householdId)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-[color:var(--wp-main-scroll-bg)] gap-4">
        <p className="text-rose-600 dark:text-rose-400 font-medium">{error}</p>
        <Link href="/portal/mindmap" className="text-indigo-600 dark:text-indigo-400 hover:underline text-sm font-medium">
          Zpět na výběr
        </Link>
      </div>
    );
  }

  if (!contactId && !householdId) {
    return (
      <MindmapListClient
        clientMaps={clientMaps}
        standaloneMaps={standaloneMaps}
        onRefresh={refreshList}
      />
    );
  }

  if (!state) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-[color:var(--wp-main-scroll-bg)]">
        <p className="text-[color:var(--wp-text-secondary)]">Žádná data.</p>
      </div>
    );
  }

  return <MindmapView initial={state} />;
}
