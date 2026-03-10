"use client";

import { useCallback, useEffect, useState } from "react";

export type ContactTabId = "prehled" | "smlouvy" | "dokumenty" | "aktivita" | "ukoly" | "obchody" | "kyc";

const TAB_IDS: ContactTabId[] = ["prehled", "smlouvy", "dokumenty", "aktivita", "ukoly", "obchody", "kyc"];

export function ContactTabLayout({
  tabs,
  defaultTab = "prehled",
}: {
  tabs: { id: ContactTabId; label: string; content: React.ReactNode }[];
  defaultTab?: ContactTabId;
}) {
  const [activeId, setActiveId] = useState<ContactTabId>(defaultTab);

  const readHash = useCallback(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.slice(1) as ContactTabId;
    if (hash && TAB_IDS.includes(hash)) setActiveId(hash);
  }, []);

  useEffect(() => {
    readHash();
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, [readHash]);

  const setTab = useCallback((id: ContactTabId) => {
    setActiveId(id);
    window.history.replaceState(null, "", `#${id}`);
  }, []);

  return (
    <div>
      <nav className="flex items-center gap-4 sm:gap-6 md:gap-8 border-b border-slate-200 px-1 overflow-x-auto min-h-[44px] hide-scrollbar" aria-label="Záložky">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setTab(tab.id)}
            className={`relative pb-4 pt-1 px-1 text-sm font-bold transition-colors whitespace-nowrap ${
              activeId === tab.id ? "text-indigo-600" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab.label}
            {activeId === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-indigo-600 rounded-t-full" aria-hidden />
            )}
          </button>
        ))}
      </nav>
      <div className="max-w-[1400px] mx-auto pt-6 px-0 sm:px-4 md:px-6 space-y-6">
        {tabs.map((tab) => (
          <div key={tab.id} className={activeId === tab.id ? "block" : "hidden"}>
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  );
}
