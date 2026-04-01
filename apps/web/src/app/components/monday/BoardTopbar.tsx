"use client";

import { useState } from "react";

export function BoardTopbar({ boardName = "" }: { boardName?: string }) {
  const [viewOpen, setViewOpen] = useState(false);

  return (
    <div className="sticky top-0 z-10 flex items-center justify-between h-12 px-4 bg-monday-surface border-b border-monday-border shrink-0">
      {/* Left: board name + view dropdown */}
      <div className="flex items-center gap-2">
        <h1 className="text-monday-text font-semibold text-[15px]">{boardName.trim() || "Nástěnka"}</h1>
        <div className="relative">
          <button
            type="button"
            onClick={() => setViewOpen((o) => !o)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--monday-radius)] text-monday-text-muted text-sm hover:bg-monday-row-hover border border-monday-border"
          >
            Hlavní tabulka
            <span className="text-monday-text-muted">▼</span>
          </button>
          {viewOpen && (
            <>
              <div className="fixed inset-0 z-40" aria-hidden onClick={() => setViewOpen(false)} />
              <div className="absolute left-0 top-full mt-1 py-1 min-w-[140px] bg-monday-surface border border-monday-border rounded-[var(--monday-radius)] shadow-[var(--monday-shadow)] z-50">
                <button type="button" className="w-full text-left px-3 py-2 text-sm text-monday-text hover:bg-monday-row-hover">
                  Hlavní tabulka
                </button>
                <button type="button" className="w-full text-left px-3 py-2 text-sm text-monday-text-muted hover:bg-monday-row-hover">
                  Kanban
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Center: actions */}
      <div className="flex items-center gap-1">
        <TopbarBtn label="Hledat" />
        <TopbarBtn label="Osoba" />
        <TopbarBtn label="Filtr" />
        <TopbarBtn label="Řazení" />
        <TopbarBtn label="Skrýt" />
        <TopbarBtn label="Seskupit podle" />
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        <button type="button" className="px-2.5 py-1.5 text-monday-text-muted text-sm hover:bg-monday-row-hover rounded-[var(--monday-radius)]">
          Integrovat
        </button>
        <button type="button" className="px-2.5 py-1.5 text-monday-text-muted text-sm hover:bg-monday-row-hover rounded-[var(--monday-radius)]">
          Automatizovat
        </button>
        <button
          type="button"
          className="px-3 py-1.5 bg-monday-blue text-white text-sm font-medium rounded-[var(--monday-radius)] hover:opacity-90"
        >
          Pozvat
        </button>
      </div>
    </div>
  );
}

function TopbarBtn({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="px-2.5 py-1.5 text-monday-text-muted text-sm hover:bg-monday-row-hover rounded-[var(--monday-radius)]"
    >
      {label}
    </button>
  );
}
