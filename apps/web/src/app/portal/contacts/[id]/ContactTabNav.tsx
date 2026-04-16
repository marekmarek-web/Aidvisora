"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CONTACT_TAB_IDS,
  CONTACT_TAB_LABELS,
  normalizeContactTab,
  type ContactTabId,
} from "./contact-detail-tabs";

function buildHref(pathname: string, tab: ContactTabId, baseQueryNoTab: string): string {
  const p = new URLSearchParams(baseQueryNoTab);
  p.set("tab", tab);
  // `add` / `edit` jen u Přehledu — jinak by wizard nebo úprava zůstaly v URL
  if (tab !== "prehled") {
    p.delete("add");
    p.delete("edit");
  }
  p.delete("addPayment");
  const q = p.toString();
  return q ? `${pathname}?${q}` : `${pathname}?tab=${tab}`;
}

/** Jen detail kontaktu (ne /new ani vnořené cesty) — migrace hash → query nesmí běžet po navigaci pryč. */
function isContactDetailPathForHashSync(pathname: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length !== 3 || parts[0] !== "portal" || parts[1] !== "contacts") return false;
  const id = parts[2];
  if (!id || id === "new") return false;
  return true;
}

/** Přesměruje staré záložky `#prehled` na `?tab=` (jednorázově po načtení). */
function HashToQuerySync({ baseQueryNoTab }: { baseQueryNoTab: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    let cancelled = false;
    if (searchParams.get("tab")) return;
    if (!isContactDetailPathForHashSync(pathname)) return;
    const raw = typeof window !== "undefined" ? window.location.hash.slice(1) : "";
    const parts = raw.split("&").filter(Boolean);
    const tabPart = parts[0] ?? "";
    const hasAddFromHash = parts.some((x) => x === "add=1");
    const normalized = normalizeContactTab(tabPart);
    if (!tabPart || normalized === "prehled") return;
    const p = new URLSearchParams(baseQueryNoTab);
    p.set("tab", normalized);
    if (hasAddFromHash && normalized === "prehled") p.set("add", "1");
    const nextUrl = `${pathname}?${p.toString()}`;
    queueMicrotask(() => {
      if (cancelled) return;
      router.replace(nextUrl, { scroll: false });
    });
    return () => {
      cancelled = true;
    };
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
            prefetch={false}
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
