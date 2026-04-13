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
      <div className="mb-5" id="lide-v-tymu">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-[26px] font-black tracking-tight text-slate-950">Lidé v týmu</h2>
            <p className="mt-1.5 text-sm text-slate-500">
              Klikněte na řádek pro souhrn člena — kariéra, coaching, CRM.
            </p>
          </div>
          <p className="shrink-0 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 tabular-nums">
            {visibleCount} / {totalCount}
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[min(100%,220px)] flex-1 max-w-md">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            value={peopleSearch}
            onChange={(e) => onPeopleSearchChange(e.target.value)}
            placeholder="Hledat jméno nebo e-mail…"
            className="min-h-[52px] w-full rounded-[16px] border border-slate-200 bg-white py-3 pl-12 pr-4 text-sm font-semibold text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#16192b]/10"
            aria-label="Hledat v seznamu členů"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
      </div>
    </>
  );
}
