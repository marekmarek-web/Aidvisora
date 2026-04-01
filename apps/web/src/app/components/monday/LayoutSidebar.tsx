"use client";

import Link from "next/link";

const SIDEBAR_WIDTH = 260;

export function LayoutSidebar() {
  return (
    <aside
      className="fixed left-0 top-0 bottom-0 z-20 flex flex-col bg-monday-surface border-r border-monday-border"
      style={{ width: SIDEBAR_WIDTH }}
    >
      {/* Logo + primary nav */}
      <div className="p-3 border-b border-monday-border">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="w-8 h-8 rounded-md bg-monday-blue flex items-center justify-center text-white text-sm font-semibold">
            A
          </div>
          <span className="text-monday-text font-semibold text-sm">Advisor</span>
        </div>
        <nav className="mt-2 space-y-0.5">
          <NavItem href="/board" label="Úvod" />
          <NavItem href="/board" label="Moje práce" />
          <NavItem href="/board" label="Více" />
        </nav>
      </div>

      {/* Workspace + boards */}
      <div className="flex-1 overflow-auto p-3">
        <p className="text-monday-text-muted text-xs font-semibold uppercase tracking-wider px-2 py-1.5">
          Pracovní prostor
        </p>
        <ul className="mt-1 space-y-0.5">
          <li>
            <Link
              href="/board"
              className="flex items-center gap-2 px-3 py-2 rounded-[var(--monday-radius)] text-monday-text text-sm hover:bg-monday-row-hover"
            >
              Kontakty
            </Link>
          </li>
          <li>
            <Link
              href="/board"
              className="flex items-center gap-2 px-3 py-2 rounded-[var(--monday-radius)] text-monday-text text-sm font-medium bg-monday-row-hover"
            >
              Nástěnka
            </Link>
          </li>
        </ul>
      </div>
    </aside>
  );
}

function NavItem({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block px-3 py-2 rounded-[var(--monday-radius)] text-monday-text text-sm hover:bg-monday-row-hover"
    >
      {label}
    </Link>
  );
}
