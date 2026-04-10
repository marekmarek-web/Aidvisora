"use client";

import { Search, Filter, BarChart3 } from "lucide-react";
import { CustomDropdown } from "@/app/components/ui/CustomDropdown";
import type { PeopleSegmentFilter } from "@/lib/team-overview-page-model";

export function TeamOverviewPeopleFiltersBar({
  peopleSearch,
  onPeopleSearchChange,
  peopleSegment,
  onPeopleSegmentChange,
  performanceFilter,
  onPerformanceFilterChange,
  visibleCount,
  totalCount,
}: {
  peopleSearch: string;
  onPeopleSearchChange: (value: string) => void;
  peopleSegment: PeopleSegmentFilter;
  onPeopleSegmentChange: (segment: PeopleSegmentFilter) => void;
  performanceFilter: "all" | "top" | "bottom";
  onPerformanceFilterChange: (f: "all" | "top" | "bottom") => void;
  visibleCount: number;
  totalCount: number;
}) {
  return (
    <>
      <div className="mb-6 border-t border-slate-200/70 pt-8" id="lide-v-tymu">
        <h2 className="text-lg font-bold text-[color:var(--wp-text)]">Lidé v týmu</h2>
        <p className="mt-1 max-w-2xl text-xs text-[color:var(--wp-text-secondary)] sm:text-sm">
          Filtr, vyhledání a metriky — řádek vede do detailu člena (kariéra, coaching, 1:1, CRM).
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[min(100%,220px)] flex-1 max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--wp-text-tertiary)]"
            aria-hidden
          />
          <input
            type="search"
            value={peopleSearch}
            onChange={(e) => onPeopleSearchChange(e.target.value)}
            placeholder="Hledat jméno nebo e-mail…"
            className="min-h-[44px] w-full rounded-xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] py-2 pl-10 pr-3 text-sm text-[color:var(--wp-text-secondary)] placeholder:text-[color:var(--wp-text-tertiary)]"
            aria-label="Hledat v seznamu členů"
          />
        </div>
        <CustomDropdown
          value={peopleSegment}
          onChange={(id) => onPeopleSegmentChange(id as PeopleSegmentFilter)}
          options={[
            { id: "all", label: "Všichni" },
            { id: "attention", label: "Vyžaduje pozornost" },
            { id: "adaptation", label: "V adaptaci" },
            { id: "managers", label: "Manažeři a ředitelé" },
            { id: "healthy", label: "Stabilní" },
          ]}
          placeholder="Segment"
          icon={Filter}
        />
        <CustomDropdown
          value={performanceFilter}
          onChange={(id) => onPerformanceFilterChange(id as "all" | "top" | "bottom")}
          options={[
            { id: "all", label: "Všichni výkon" },
            { id: "top", label: "Nejsilnější výkon" },
            { id: "bottom", label: "Podpora ve výkonu" },
          ]}
          placeholder="Výkon"
          icon={BarChart3}
        />
      </div>
      <p className="mb-2 text-xs text-[color:var(--wp-text-secondary)]">
        Zobrazeno <strong className="tabular-nums text-[color:var(--wp-text)]">{visibleCount}</strong> z{" "}
        <strong className="tabular-nums text-[color:var(--wp-text)]">{totalCount}</strong> členů v rozsahu.
      </p>
      <p className="mb-4 text-[11px] text-[color:var(--wp-text-tertiary)] max-w-3xl">
        Segment „Vyžaduje pozornost“ = CRM signály nebo coaching výběr z kariérní vrstvy. „Stabilní“ = bez varování v CRM a mimo adaptační okno (zjednodušený proxy).
      </p>
    </>
  );
}
