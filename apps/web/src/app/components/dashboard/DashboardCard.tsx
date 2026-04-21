"use client";

import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CreateActionButton } from "@/app/components/ui/CreateActionButton";

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
  /** Optional top-edge "envelope" bar (e.g. border-t-4 border-t-indigo-500) */
  topBorderClass?: string;
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
  topBorderClass,
}: DashboardCardProps) {
  return (
    <div
      className={`flex min-h-[240px] flex-col overflow-hidden rounded-[24px] border border-[color:var(--wp-surface-card-border)] shadow-[var(--wp-shadow-card)] ${backgroundClass ?? "bg-[color:var(--wp-surface-card)]"} ${topBorderClass ?? ""} ${className}`}
    >
      <div className="flex shrink-0 items-center justify-between px-6 py-5 sm:px-8 sm:py-6">
        <h2 className="flex items-center gap-2 text-xl font-black tracking-tight text-[color:var(--wp-text)] md:text-2xl">
          <Icon size={22} className={iconColorClass ?? "text-[color:var(--wp-icon-default)]"} />
          {title}
        </h2>
        {rightElement != null ? rightElement : null}
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-stretch overflow-y-auto px-6 pb-6 sm:px-8 sm:pb-8">
        {children}
        {footerLink && (
          <div className="mt-auto flex w-full shrink-0 justify-center px-2 pt-6">
            <CreateActionButton href={footerLink} icon={ChevronRight} className="max-w-full shadow-none">
              {footerLabel}
            </CreateActionButton>
          </div>
        )}
      </div>
    </div>
  );
}
