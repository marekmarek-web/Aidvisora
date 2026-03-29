"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CONTACT_TAB_IDS,
  CONTACT_TAB_LABELS,
  type ContactTabId,
} from "./contact-detail-tabs";

function buildHref(pathname: string, tab: ContactTabId, baseQueryNoTab: string): string {
  const p = new URLSearchParams(baseQueryNoTab);
  p.set("tab", tab);
  const q = p.toString();
  return q ? `${pathname}?${q}` : `${pathname}?tab=${tab}`;
}

/** Přesměruje staré záložky `#prehled` na `?tab=` (jednorázově po načtení). */
function HashToQuerySync({ baseQueryNoTab }: { baseQueryNoTab: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("tab")) return;
    const raw = typeof window !== "undefined" ? window.location.hash.slice(1) : "";
    const tabPart = raw.split("&")[0] as ContactTabId;
    if (!tabPart || !CONTACT_TAB_IDS.includes(tabPart)) return;
    const p = new URLSearchParams(baseQueryNoTab);
    p.set("tab", tabPart);
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  }, [baseQueryNoTab, pathname, router, searchParams]);

  return null;
}

export function ContactTabNav({
  activeTab,
  baseQueryNoTab,
}: {
  activeTab: ContactTabId;
  /** Výsledek `contactDetailQueryWithoutTab` — bez `tab`. */
  baseQueryNoTab: string;
}) {
  const pathname = usePathname();

  return (
    <div className="wp-contact-v2-tabs">
      <Suspense fallback={null}>
        <HashToQuerySync baseQueryNoTab={baseQueryNoTab} />
      </Suspense>
      <nav
        className="flex items-center gap-6 md:gap-8 border-b border-[color:var(--wp-surface-card-border)] px-2 overflow-x-auto hide-scrollbar min-h-[48px]"
        aria-label="Záložky"
      >
        {CONTACT_TAB_IDS.map((tab) => (
          <Link
            key={tab}
            href={buildHref(pathname, tab, baseQueryNoTab)}
            scroll={false}
            className={`relative pb-4 pt-2 text-sm font-black uppercase tracking-widest transition-all whitespace-nowrap min-h-[44px] flex items-center ${
              activeTab === tab
                ? "text-indigo-600"
                : "text-[color:var(--wp-text-tertiary)] hover:text-[color:var(--wp-text)]"
            }`}
          >
            {CONTACT_TAB_LABELS[tab]}
            {activeTab === tab && (
              <div className="absolute bottom-0 left-0 w-full h-[3px] bg-indigo-600 rounded-t-full" aria-hidden />
            )}
          </Link>
        ))}
      </nav>
    </div>
  );
}
