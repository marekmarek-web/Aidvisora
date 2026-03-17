"use client";

import React from "react";
import Link from "next/link";

interface LandingFooterProps {
  activeTheme: "original" | "darkElegance";
}

const linkClass =
  "min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-4 py-3 rounded-xl font-medium transition-all duration-300 text-white/80 hover:text-white hover:bg-white/10";

export function LandingFooter({ activeTheme: _activeTheme }: LandingFooterProps) {
  return (
    <footer
      className="relative z-10 w-full border-t border-white/10 bg-black/20 backdrop-blur-md py-6 transition-colors duration-300"
      role="contentinfo"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 sm:flex-row sm:justify-between sm:px-6">
        <Link
          href="/"
          className="flex min-h-[44px] min-w-[44px] items-center gap-2 text-white/90 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-transparent rounded-lg"
          aria-label="Aidvisora – úvod"
        >
          <img
            src="/aidvisora-logo.png"
            alt=""
            className="h-8 w-auto max-w-[140px] object-contain"
            width={140}
            height={32}
          />
        </Link>
        <nav className="flex flex-wrap items-center justify-center gap-2 sm:gap-4" aria-label="Patička">
          <Link href="/gdpr" className={linkClass}>
            GDPR
          </Link>
          <Link href="/" className={linkClass}>
            Zpět na úvod
          </Link>
        </nav>
      </div>
    </footer>
  );
}
