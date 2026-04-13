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
      <div className="mb-5 border-t border-slate-200/60 pt-6" id="lide-v-tymu">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-black tracking-tight text-[color:var(--wp-text)]">Lidé v týmu</h2>
            <p className="mt-1 text-sm text-[color:var(--wp-text-secondary)]">
              Klikněte na řádek pro souhrn člena — kariéra, coaching, CRM.
            </p>
          </div>
          <p className="shrink-0 text-xs text-[color:var(--wp-text-tertiary)] tabular-nums">
            {visibleCount} / {totalCount}
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[min(100%,200px)] flex-1 max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--wp-text-tertiary)]"
            aria-hidden
          />
          <input
            type="search"
            value={peopleSearch}
            onChange={(e) => onPeopleSearchChange(e.target.value)}
            placeholder="Hledat jméno nebo e-mail…"
            className="min-h-[42px] w-full rounded-2xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm text-[color:var(--wp-text-secondary)] placeholder:text-[color:var(--wp-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-indigo-300/60"
            aria-label="Hledat v seznamu členů"
          />
        </div>
        <CustomDropdown
          value={peopleSegment}
          onChange={(id) => onPeopleSegmentChange(id as PeopleSegmentFilter)}
          options={[
            { id: "all", label: "Všichni" },
            { id: "attention", label: "Potřebuje pozornost" },
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
            { id: "all", label: "Všichni" },
            { id: "top", label: "Nejsilnější výkon" },
            { id: "bottom", label: "Podpora ve výkonu" },
          ]}
          placeholder="Výkon"
          icon={BarChart3}
        />
      </div>
    </>
  );
}
