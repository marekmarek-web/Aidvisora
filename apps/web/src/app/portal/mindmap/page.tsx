"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getMindmap } from "@/app/actions/mindmap";
import { listStandaloneMaps, createStandaloneMap } from "@/app/actions/mindmap";
import type { MindmapState } from "@/app/actions/mindmap";
import { MindmapView } from "./MindmapView";
import { getContactsList } from "@/app/actions/contacts";
import { getHouseholdsList } from "@/app/actions/households";
import type { ContactRow } from "@/app/actions/contacts";
import type { HouseholdRow } from "@/app/actions/households";

type StandaloneMapRow = { id: string; name: string; updatedAt: Date };

export default function MindmapPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const contactId = searchParams.get("contactId");
  const householdId = searchParams.get("householdId");

  const [state, setState] = useState<MindmapState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [households, setHouseholds] = useState<HouseholdRow[]>([]);
  const [standaloneMaps, setStandaloneMaps] = useState<StandaloneMapRow[]>([]);
  const [newMapName, setNewMapName] = useState("");
  const [creating, setCreating] = useState(false);

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
      getContactsList().then(setContacts).catch(() => {});
      getHouseholdsList().then(setHouseholds).catch(() => {});
      listStandaloneMaps().then(setStandaloneMaps).catch(() => {});
    }
  }, [contactId, householdId]);

  async function handleCreateStandaloneMap() {
    const name = newMapName.trim() || "Nová mapa";
    setCreating(true);
    try {
      const { mapId } = await createStandaloneMap(name);
      router.push(`/portal/mindmap/${mapId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nepodařilo se vytvořit mapu");
    } finally {
      setCreating(false);
      setNewMapName("");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-[#f8fafc]">
        <p className="text-slate-500 font-medium">Načítám mapu…</p>
      </div>
    );
  }

  if (error && (contactId || householdId)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-[#f8fafc] gap-4">
        <p className="text-rose-600 font-medium">{error}</p>
        <Link href="/portal/mindmap" className="text-indigo-600 hover:underline text-sm font-medium">
          Zpět na výběr
        </Link>
      </div>
    );
  }

  if (!contactId && !householdId) {
    return (
      <div className="min-h-screen bg-[#f8fafc] p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Mindmap</h1>
          <p className="text-slate-600 mb-8">
            Vyberte libovolnou mapu, klienta nebo domácnost pro zobrazení a úpravu mapy.
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
              {error}
              <button type="button" onClick={() => setError(null)} className="ml-2 underline">Zavřít</button>
            </div>
          )}

          <section className="space-y-4 mb-10">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Libovolné mapy</h2>
            <p className="text-slate-600 text-sm">Mapy nezávislé na klientovi (např. náborové schůzky, projekty).</p>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="text"
                placeholder="Název nové mapy"
                value={newMapName}
                onChange={(e) => setNewMapName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateStandaloneMap()}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm w-48 max-w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={handleCreateStandaloneMap}
                disabled={creating}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50"
              >
                {creating ? "Vytvářím…" : "Nová mapa"}
              </button>
            </div>
            <ul className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
              {standaloneMaps.length === 0 ? (
                <li className="px-6 py-4 text-slate-500 text-sm">Žádné libovolné mapy. Vytvořte první výše.</li>
              ) : (
                standaloneMaps.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/portal/mindmap/${m.id}`}
                      className="block px-6 py-4 hover:bg-slate-50 transition-colors font-medium text-slate-800"
                    >
                      <span>{m.name}</span>
                      <span className="text-slate-400 text-xs font-normal ml-2">
                        {new Date(m.updatedAt).toLocaleDateString("cs-CZ")}
                      </span>
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="space-y-4 mb-10">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Klienti</h2>
            <ul className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
              {contacts.length === 0 ? (
                <li className="px-6 py-4 text-slate-500 text-sm">Žádní klienti</li>
              ) : (
                contacts.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/portal/mindmap?contactId=${c.id}`}
                      className="block px-6 py-4 hover:bg-slate-50 transition-colors font-medium text-slate-800"
                    >
                      {c.firstName} {c.lastName}
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Domácnosti</h2>
            <ul className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
              {households.length === 0 ? (
                <li className="px-6 py-4 text-slate-500 text-sm">Žádné domácnosti</li>
              ) : (
                households.map((h) => (
                  <li key={h.id}>
                    <Link
                      href={`/portal/mindmap?householdId=${h.id}`}
                      className="block px-6 py-4 hover:bg-slate-50 transition-colors font-medium text-slate-800"
                    >
                      {h.name}
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-[#f8fafc]">
        <p className="text-slate-500">Žádná data.</p>
      </div>
    );
  }

  return <MindmapView initial={state} />;
}
