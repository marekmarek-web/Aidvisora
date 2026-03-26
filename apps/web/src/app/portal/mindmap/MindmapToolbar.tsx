"use client";

import { Settings } from "lucide-react";
import type { MindmapInteractionMode } from "./types";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function MindmapToolbar({
  mode,
  onModeChange,
  onOpenSettings,
}: {
  mode: MindmapInteractionMode;
  onModeChange: (m: MindmapInteractionMode) => void;
  onOpenSettings: () => void;
}) {
  return (
    <div className="absolute left-3 bottom-20 md:bottom-auto md:left-6 md:top-6 flex flex-col md:flex-col gap-3 z-50">
      <div className="bg-[color:var(--wp-surface-card)]/90 backdrop-blur-xl p-2 rounded-2xl shadow-xl border border-[color:var(--wp-surface-card-border)] flex md:flex-col flex-row gap-1">
        <button
          type="button"
          onClick={() => onModeChange("select")}
          className={cx(
            "p-3 rounded-xl transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center",
            mode === "select" ? "bg-indigo-50 text-indigo-600" : "text-[color:var(--wp-text-tertiary)] active:bg-[color:var(--wp-surface-muted)] active:text-[color:var(--wp-text)]"
          )}
          title="Nástroj pro výběr"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
            <path d="M13 13l6 6" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => onModeChange("connect")}
          className={cx(
            "p-3 rounded-xl transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center",
            mode === "connect" ? "bg-indigo-50 text-indigo-600" : "text-[color:var(--wp-text-tertiary)] active:bg-[color:var(--wp-surface-muted)] active:text-[color:var(--wp-text)]"
          )}
          title="Spojování uzlů (Link)"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        </button>
        <div className="md:w-10 md:h-px w-px h-6 bg-[color:var(--wp-surface-card-border)] mx-auto my-0.5 md:my-1" />
        <button
          type="button"
          onClick={onOpenSettings}
          className="p-3 rounded-xl text-[color:var(--wp-text-tertiary)] active:bg-[color:var(--wp-surface-muted)] active:text-[color:var(--wp-text)] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          title="Nastavení mapy"
        >
          <Settings size={20} />
        </button>
      </div>
    </div>
  );
}
