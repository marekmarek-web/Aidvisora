"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getMindmap } from "@/app/actions/mindmap";
import { ListPageShell, ListPageHeader, ListPageToolbar, ListPageSearchInput } from "@/app/components/list-page";
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
      <MindmapListView
        contacts={contacts}
        households={households}
        standaloneMaps={standaloneMaps}
        newMapName={newMapName}
        setNewMapName={setNewMapName}
        creating={creating}
        handleCreateStandaloneMap={handleCreateStandaloneMap}
        error={error}
        setError={setError}
      />
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

/** List view: same layout pattern as Contacts (header, count, search, action). */
function MindmapListView({
  contacts,
  households,
  standaloneMaps,
  newMapName,
  setNewMapName,
  creating,
  handleCreateStandaloneMap,
  error,
  setError,
}: {
  contacts: ContactRow[];
  households: HouseholdRow[];
  standaloneMaps: StandaloneMapRow[];
  newMapName: string;
  setNewMapName: (v: string) => void;
  creating: boolean;
  handleCreateStandaloneMap: () => Promise<void>;
  error: string | null;
  setError: (v: string | null) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const q = searchQuery.trim().toLowerCase();
  const filteredMaps = q ? standaloneMaps.filter((m) => m.name.toLowerCase().includes(q)) : standaloneMaps;
  const filteredContacts = q ? contacts.filter((c) => `${c.firstName} ${c.lastName}`.toLowerCase().includes(q)) : contacts;
  const filteredHouseholds = q ? households.filter((h) => h.name.toLowerCase().includes(q)) : households;
  const totalItems = filteredMaps.length + filteredContacts.length + filteredHouseholds.length;
  const totalAll = standaloneMaps.length + contacts.length + households.length;

  return (
    <ListPageShell>
      <ListPageHeader
        title="Mindmap"
        count={totalItems}
        totalCount={totalAll}
        subtitle="Vyberte mapu, klienta nebo domácnost pro zobrazení a úpravu."
        actions={
          <button
            type="button"
            onClick={handleCreateStandaloneMap}
            disabled={creating}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#1a1c2e] text-white rounded-[var(--wp-radius-sm)] text-xs font-bold uppercase tracking-wide shadow-md hover:bg-[#2a2d4a] transition-all hover:-translate-y-0.5 disabled:opacity-50"
          >
            {creating ? "Vytvářím…" : "Nová mapa"}
          </button>
        }
      />

      <ListPageToolbar>
        <ListPageSearchInput
          placeholder="Hledat mapu, klienta, domácnost…"
          value={searchQuery}
          onChange={setSearchQuery}
        />
      </ListPageToolbar>

      {error && (
        <div className="rounded-[var(--wp-radius-sm)] border border-rose-200 bg-rose-50 p-4 text-rose-700 text-sm flex items-center justify-between">
          {error}
          <button type="button" onClick={() => setError(null)} className="font-medium hover:underline">Zavřít</button>
        </div>
      )}

      <div className="max-w-2xl space-y-8">
        <section className="space-y-4">
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
          <ul className="rounded-[var(--wp-radius-sm)] border border-slate-200 bg-white shadow-sm divide-y divide-slate-100 overflow-hidden">
            {filteredMaps.length === 0 ? (
              <li className="px-6 py-4 text-slate-500 text-sm">
                {standaloneMaps.length === 0 ? "Žádné libovolné mapy. Vytvořte první výše." : "Žádné výsledky pro hledaný výraz."}
              </li>
            ) : (
              filteredMaps.map((m) => (
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

        <section className="space-y-4">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Klienti</h2>
          <ul className="rounded-[var(--wp-radius-sm)] border border-slate-200 bg-white shadow-sm divide-y divide-slate-100 overflow-hidden">
            {filteredContacts.length === 0 ? (
              <li className="px-6 py-4 text-slate-500 text-sm">{contacts.length === 0 ? "Žádní klienti" : "Žádné výsledky pro hledaný výraz."}</li>
            ) : (
              filteredContacts.map((c) => (
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
          <ul className="rounded-[var(--wp-radius-sm)] border border-slate-200 bg-white shadow-sm divide-y divide-slate-100 overflow-hidden">
            {filteredHouseholds.length === 0 ? (
              <li className="px-6 py-4 text-slate-500 text-sm">{households.length === 0 ? "Žádné domácnosti" : "Žádné výsledky pro hledaný výraz."}</li>
            ) : (
              filteredHouseholds.map((h) => (
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
    </ListPageShell>
  );
}
