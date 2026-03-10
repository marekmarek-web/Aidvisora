"use client";

import { useCallback, useEffect, useState } from "react";

export type ContactTabId = "prehled" | "smlouvy" | "dokumenty" | "zapisky" | "aktivita" | "ukoly" | "obchody" | "kyc";

const TAB_IDS: ContactTabId[] = ["prehled", "smlouvy", "dokumenty", "zapisky", "aktivita", "ukoly", "obchody", "kyc"];

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
    <div className="wp-contact-v2-tabs">
      <nav className="flex items-center gap-1 sm:gap-2 border-b border-slate-200 bg-white/50 rounded-t-[var(--wp-radius-lg)] px-3 pt-2 overflow-x-auto min-h-[48px] hide-scrollbar" aria-label="Záložky">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setTab(tab.id)}
            className={`relative py-3 px-4 text-sm font-semibold transition-colors whitespace-nowrap rounded-t-lg min-h-[44px] flex items-center ${
              activeId === tab.id
                ? "text-[var(--wp-accent)] bg-white shadow-sm"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            }`}
          >
            {tab.label}
            {activeId === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--wp-accent)] rounded-t-full" aria-hidden />
            )}
          </button>
        ))}
      </nav>
      <div className="max-w-[1400px] mx-auto pt-6 pb-8 px-4 sm:px-6 space-y-6 bg-white/30 rounded-b-[var(--wp-radius-lg)]">
        {tabs.map((tab) => (
          <div key={tab.id} className={activeId === tab.id ? "block" : "hidden"}>
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  );
}
