"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getMindmapByMapId } from "@/app/actions/mindmap";
import type { MindmapState } from "@/app/actions/mindmap";

const MindmapView = dynamic(
  () => import("../MindmapView").then((m) => m.MindmapView),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 min-h-[50vh] items-center justify-center text-[color:var(--wp-text-secondary)] text-sm">
        Načítání mapy…
      </div>
    ),
  },
);

export default function MindmapStandalonePage() {
  const params = useParams();
  const mapId = typeof params.mapId === "string" ? params.mapId : null;

  const [state, setState] = useState<MindmapState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapId) {
      setLoading(false);
      setError("Chybí id mapy");
      return;
    }
    setLoading(true);
    setError(null);
    getMindmapByMapId(mapId)
      .then(setState)
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Chyba načtení");
        setState(null);
      })
      .finally(() => setLoading(false));
  }, [mapId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-[#f8fafc]">
        <p className="text-[color:var(--wp-text-secondary)] font-medium">Načítám mapu…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-[#f8fafc] gap-4">
        <p className="text-rose-600 font-medium">{error}</p>
        <Link href="/portal/mindmap" className="text-indigo-600 hover:underline text-sm font-medium">
          Zpět na výběr
        </Link>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-[#f8fafc]">
        <p className="text-[color:var(--wp-text-secondary)]">Mapa nenalezena.</p>
        <Link href="/portal/mindmap" className="ml-2 text-indigo-600 hover:underline text-sm">
          Výběr map
        </Link>
      </div>
    );
  }

  return <MindmapView initial={state} />;
}
