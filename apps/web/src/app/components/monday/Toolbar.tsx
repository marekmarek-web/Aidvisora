"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import type { Column } from "./types";
import { CustomDropdown } from "@/app/components/ui/CustomDropdown";
import { getStatusLabels, STATUS_LABELS_UPDATED_EVENT } from "@/app/lib/status-labels";
import { Filter } from "lucide-react";

interface ToolbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  columns: Column[];
  hiddenColumnIds: Set<string>;
  onToggleColumn: (columnId: string) => void;
  filterOpen: boolean;
  onFilterOpenChange: (open: boolean) => void;
  sortOpen: boolean;
  onSortOpenChange: (open: boolean) => void;
  hideOpen: boolean;
  onHideOpenChange: (open: boolean) => void;
  groupByOpen: boolean;
  onGroupByOpenChange: (open: boolean) => void;
  personOpen: boolean;
  onPersonOpenChange: (open: boolean) => void;
  assignedTo: string | null;
  onAssignedToChange: (id: string | null) => void;
  filterStatus: string | null;
  onFilterStatusChange: (id: string | null) => void;
  sortColumnId: string | null;
  sortDir: "asc" | "desc";
  onSortChange: (columnId: string | null, dir: "asc" | "desc") => void;
  groupBy: "none" | "status";
  onGroupByChange: (v: "none" | "status") => void;
  /** Členové týmu (userId → jméno) pro filtr „Osoba“; první položka „Všichni“ se doplní automaticky. */
  personFilterOptions?: { id: string; name: string }[];
}

export function Toolbar(props: ToolbarProps) {
  const {
    searchQuery,
    onSearchChange,
    columns,
    hiddenColumnIds,
    onToggleColumn,
    filterOpen,
    onFilterOpenChange,
    sortOpen,
    onSortOpenChange,
    hideOpen,
    onHideOpenChange,
    groupByOpen,
    onGroupByOpenChange,
    personOpen,
    onPersonOpenChange,
    assignedTo,
    onAssignedToChange,
    filterStatus,
    onFilterStatusChange,
    sortColumnId,
    sortDir,
    onSortChange,
    groupBy,
    onGroupByChange,
    personFilterOptions = [],
  } = props;

  const filterRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const hideRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const personRef = useRef<HTMLDivElement>(null);
  const [statusLabelsVersion, setStatusLabelsVersion] = useState(0);
  useEffect(() => {
    const h = () => setStatusLabelsVersion((v) => v + 1);
    window.addEventListener(STATUS_LABELS_UPDATED_EVENT, h);
    return () => window.removeEventListener(STATUS_LABELS_UPDATED_EVENT, h);
  }, []);
  const statusLabelsList = useMemo(() => getStatusLabels(), [statusLabelsVersion]);

  const personOptions = useMemo(
    () => [{ id: "all", name: "Všichni" }, ...personFilterOptions.filter((p) => p.id && p.id !== "all")],
    [personFilterOptions]
  );

  return (
    <div className="flex h-10 shrink-0 items-center gap-1 border-b border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] px-3">
      {/* Hledat */}
      <input
        type="text"
        placeholder="Hledat"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-32 h-7 px-2 text-[13px] border border-monday-border rounded-[6px] focus:outline-none focus:border-monday-blue"
      />
      {/* Osoba */}
      <div className="relative" ref={personRef}>
        <button
          type="button"
          onClick={() => { onPersonOpenChange(!personOpen); onFilterOpenChange(false); onSortOpenChange(false); onHideOpenChange(false); onGroupByOpenChange(false); }}
          className="px-2.5 py-1.5 text-monday-text-muted text-[13px] hover:bg-monday-row-hover rounded-[6px]"
        >
          Osoba
        </button>
        {personOpen && (
          <>
            <div className="fixed inset-0 z-[100]" onClick={() => onPersonOpenChange(false)} />
            <div className="absolute left-0 top-full mt-1 py-1 min-w-[140px] bg-monday-surface border border-monday-border rounded-[var(--monday-radius)] shadow-[var(--monday-shadow)] z-[110]">
              {personOptions.map((p) => (
                <button key={p.id} type="button" onClick={() => { onAssignedToChange(p.id === "all" ? null : p.id); onPersonOpenChange(false); }} className="w-full text-left px-3 py-2 text-[13px] hover:bg-monday-row-hover">
                  {p.name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="relative" ref={filterRef}>
        <button type="button" onClick={() => { onFilterOpenChange(!filterOpen); onSortOpenChange(false); onHideOpenChange(false); onGroupByOpenChange(false); onPersonOpenChange(false); }} className="px-2.5 py-1.5 text-monday-text-muted text-[13px] hover:bg-monday-row-hover rounded-[6px]">Filtrovat</button>
        {filterOpen && (
          <>
            <div className="fixed inset-0 z-[100]" onClick={() => onFilterOpenChange(false)} />
            <div className="absolute left-0 top-full mt-1 p-3 min-w-[200px] bg-monday-surface border border-monday-border rounded-[var(--monday-radius)] shadow-[var(--monday-shadow)] z-[110]">
              <p className="text-[11px] font-semibold text-monday-text-muted uppercase mb-2">STAV</p>
              {statusLabelsList.length === 0 ? (
                <p className="text-[13px] text-monday-text-muted">Nejdřív si v buňce stavu vytvořte štítky (Upravit štítky).</p>
              ) : (
                <CustomDropdown
                  value={filterStatus ?? ""}
                  onChange={(id) => onFilterStatusChange(id || null)}
                  options={[
                    { id: "", label: "Všechny" },
                    ...statusLabelsList.map((s) => ({ id: s.id, label: s.label })),
                  ]}
                  placeholder="Všechny"
                  icon={Filter}
                />
              )}
            </div>
          </>
        )}
      </div>
      <div className="relative" ref={sortRef}>
        <button type="button" onClick={() => { onSortOpenChange(!sortOpen); onFilterOpenChange(false); onHideOpenChange(false); onGroupByOpenChange(false); }} className="px-2.5 py-1.5 text-monday-text-muted text-[13px] hover:bg-monday-row-hover rounded-[6px]">Seřadit</button>
        {sortOpen && (
          <>
            <div className="fixed inset-0 z-[100]" onClick={() => onSortOpenChange(false)} />
            <div className="absolute left-0 top-full mt-1 py-1 min-w-[160px] bg-monday-surface border border-monday-border rounded-[var(--monday-radius)] shadow-[var(--monday-shadow)] z-[110]">
              <button type="button" onClick={() => { onSortChange("item", "asc"); onSortOpenChange(false); }} className="w-full text-left px-3 py-2 text-[13px] hover:bg-monday-row-hover">Jméno A–Z</button>
              <button type="button" onClick={() => { onSortChange("item", "desc"); onSortOpenChange(false); }} className="w-full text-left px-3 py-2 text-[13px] hover:bg-monday-row-hover">Jméno Z–A</button>
              <button type="button" onClick={() => { onSortChange("zp", "asc"); onSortOpenChange(false); }} className="w-full text-left px-3 py-2 text-[13px] hover:bg-monday-row-hover">ŽP status</button>
            </div>
          </>
        )}
      </div>
      <div className="relative" ref={hideRef}>
        <button type="button" onClick={() => { onHideOpenChange(!hideOpen); onFilterOpenChange(false); onSortOpenChange(false); onGroupByOpenChange(false); }} className="px-2.5 py-1.5 text-monday-text-muted text-[13px] hover:bg-monday-row-hover rounded-[6px]">Skrýt</button>
        {hideOpen && (
          <>
            <div className="fixed inset-0 z-[100]" onClick={() => onHideOpenChange(false)} />
            <div className="absolute left-0 top-full mt-1 py-1 min-w-[180px] max-h-64 overflow-auto bg-monday-surface border border-monday-border rounded-[var(--monday-radius)] shadow-[var(--monday-shadow)] z-[110]">
              {columns.map((c) => (
                <label key={c.id} className="flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-monday-row-hover cursor-pointer">
                  <input type="checkbox" checked={!hiddenColumnIds.has(c.id)} onChange={() => onToggleColumn(c.id)} />
                  {c.title}
                </label>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="relative" ref={groupRef}>
        <button type="button" onClick={() => { onGroupByOpenChange(!groupByOpen); onFilterOpenChange(false); onSortOpenChange(false); onHideOpenChange(false); }} className="px-2.5 py-1.5 text-monday-text-muted text-[13px] hover:bg-monday-row-hover rounded-[6px]">Seskupit</button>
        {groupByOpen && (
          <>
            <div className="fixed inset-0 z-[100]" onClick={() => onGroupByOpenChange(false)} />
            <div className="absolute left-0 top-full mt-1 py-1 min-w-[140px] bg-monday-surface border border-monday-border rounded-[var(--monday-radius)] shadow-[var(--monday-shadow)] z-[110]">
              <button type="button" onClick={() => { onGroupByChange("none"); onGroupByOpenChange(false); }} className={`w-full text-left px-3 py-2 text-[13px] hover:bg-monday-row-hover ${groupBy === "none" ? "font-medium text-monday-blue" : ""}`}>Žádné</button>
              <button type="button" onClick={() => { onGroupByChange("status"); onGroupByOpenChange(false); }} className={`w-full text-left px-3 py-2 text-[13px] hover:bg-monday-row-hover ${groupBy === "status" ? "font-medium text-monday-blue" : ""}`}>Stav</button>
            </div>
          </>
        )}
      </div>
      <div className="flex-1" />
    </div>
  );
}
