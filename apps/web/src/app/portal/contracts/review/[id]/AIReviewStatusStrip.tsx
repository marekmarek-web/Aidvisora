"use client";

import Link from "next/link";
import { ArrowLeft, LayoutDashboard } from "lucide-react";

/**
 * FL-1 — kompaktní status strip pro AI Review detail.
 *
 * Nahrazuje globální `PortalShell` u `/portal/contracts/review/[id]`.
 * Tři úkoly:
 *   1. back na seznam revizí,
 *   2. minimální kontext (název feature),
 *   3. rychlý odskok zpět na portál (jakmile poradce skončí s revizí).
 *
 * Není to systémová hlavička — je záměrně tichá, aby neubírala vertikální prostor
 * extrakčnímu panelu + PDF vieweru, kde se trávi většina času práce.
 */
export function AIReviewStatusStrip() {
  return (
    <header
      role="banner"
      className="sticky top-0 z-30 flex h-11 w-full items-center justify-between gap-2 border-b border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-page)] px-3 text-[13px] font-semibold text-[color:var(--wp-text-secondary)] md:px-4"
    >
      <div className="flex min-w-0 items-center gap-2">
        <Link
          href="/portal/contracts/review"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[color:var(--wp-text)] hover:bg-[color:var(--wp-surface-hover)]"
          aria-label="Zpět na seznam AI Review"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Seznam revizí</span>
        </Link>
        <span
          className="mx-1 hidden h-5 w-px bg-[color:var(--wp-surface-card-border)] sm:inline-block"
          aria-hidden
        />
        <span className="truncate">AI Review — detail dokumentu</span>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/portal/today"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[color:var(--wp-text)] hover:bg-[color:var(--wp-surface-hover)]"
        >
          <LayoutDashboard className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Portál</span>
        </Link>
      </div>
    </header>
  );
}
