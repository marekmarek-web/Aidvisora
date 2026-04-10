"use client";

import { ArrowDown, ArrowUp, Minus } from "lucide-react";

export function TeamOverviewTrendIndicator({ trend }: { trend: number }) {
  if (trend > 0) {
    return (
      <span className="inline-flex items-center text-emerald-600 text-xs font-medium">
        <ArrowUp className="w-3.5 h-3.5 mr-0.5" />+{trend}
      </span>
    );
  }
  if (trend < 0) {
    return (
      <span className="inline-flex items-center text-rose-600 text-xs font-medium">
        <ArrowDown className="w-3.5 h-3.5 mr-0.5" />
        {trend}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-[color:var(--wp-text-secondary)] text-xs">
      <Minus className="w-3.5 h-3.5" />
    </span>
  );
}
