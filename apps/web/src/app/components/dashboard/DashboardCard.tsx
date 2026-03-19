"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface DashboardCardProps {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  footerLink?: string;
  footerLabel?: string;
  rightElement?: React.ReactNode;
  backgroundClass?: string;
  className?: string;
  /** Optional icon color class for the header icon */
  iconColorClass?: string;
}

export function DashboardCard({
  title,
  icon: Icon,
  children,
  footerLink,
  footerLabel = "Více",
  rightElement,
  backgroundClass,
  className = "",
  iconColorClass,
}: DashboardCardProps) {
  return (
    <div
      className={`flex flex-col rounded-[32px] border border-slate-100 shadow-sm min-h-[240px] max-h-[500px] overflow-hidden ${backgroundClass ?? "bg-white"} ${className}`}
    >
      <div className="px-6 sm:px-8 py-5 sm:py-6 flex items-center justify-between shrink-0">
        <h2 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
          <Icon size={18} className={iconColorClass ?? "text-slate-400"} />
          {title}
        </h2>
        {rightElement != null ? rightElement : null}
      </div>
      <div className="px-6 sm:px-8 pb-6 sm:pb-8 flex-1 overflow-y-auto min-h-0 flex flex-col">
        {children}
        {footerLink && (
          <Link
            href={footerLink}
            className="mt-auto pt-4 text-xs font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1 shrink-0"
          >
            {footerLabel} <ChevronRight size={14} />
          </Link>
        )}
      </div>
    </div>
  );
}
