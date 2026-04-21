"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * FL-2.3 — Cookie notice banner.
 *
 * Aidvisora dnes používá pouze **essential cookies** (auth, promo kód, theme,
 * mobile UI preference). Non-essential cookies (analytika, reklama) aktuálně
 * nenasazujeme. Tento banner proto:
 *
 * 1. Jen **informuje** uživatele o essential cookies a odkazuje na `/cookies`.
 * 2. Nezobrazuje tlačítka „Přijmout vše / Odmítnout všechny“ — to by
 *    implikovalo přítomnost non-essential cookies a ePrivacy by takovou
 *    implementaci považovala za dark pattern.
 * 3. Po dismissu si pamatuje stav v localStorage (`aidvisora_cookie_notice`),
 *    takže se nezobrazuje opakovaně.
 *
 * Až začneme nasazovat analytiku / marketing, banner se musí rozšířit o
 * granularní souhlas podle kategorií (nebo přejít na CMP jako Cookiebot).
 * Signalizační flag pro to je `NEXT_PUBLIC_NON_ESSENTIAL_COOKIES=1` — dokud
 * není nastaven, banner ukazuje jen informativní text.
 */
const STORAGE_KEY = "aidvisora_cookie_notice_v1";

const HIDE_ON_PATHS = [
  "/cookies",
  "/privacy",
  "/terms",
  "/vop",
  "/dpa",
  "/legal",
  "/beta-terms",
];

export function CookieNoticeBanner() {
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [hiddenByPath, setHiddenByPath] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "dismissed") setDismissed(true);
    } catch {
      /* storage může být disabled (in-private / sandbox) — banner se zobrazí, oukej. */
    }
    const path = window.location.pathname;
    if (HIDE_ON_PATHS.some((p) => path === p || path.startsWith(`${p}/`))) {
      setHiddenByPath(true);
    }
  }, []);

  function dismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, "dismissed");
    } catch {
      /* noop */
    }
  }

  if (!mounted || dismissed || hiddenByPath) return null;

  return (
    <div
      role="dialog"
      aria-label="Informace o cookies"
      className="fixed inset-x-2 bottom-2 z-[999] mx-auto max-w-3xl rounded-[20px] border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] px-5 py-4 shadow-2xl backdrop-blur"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        <div className="flex-1 text-sm text-[color:var(--wp-text)]">
          <p className="font-black">Používáme jen nezbytné cookies.</p>
          <p className="mt-1 text-[color:var(--wp-text-secondary)]">
            Aidvisora aktuálně nenasazuje analytické ani marketingové cookies.
            Ukládáme jen cookies potřebné pro přihlášení, zabezpečení a vzhled
            aplikace. Detaily najdete v sekci{" "}
            <Link
              href="/cookies"
              className="font-bold text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-400"
            >
              Cookies
            </Link>{" "}
            a v{" "}
            <Link
              href="/privacy"
              className="font-bold text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-400"
            >
              Zásadách ochrany osobních údajů
            </Link>
            .
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-indigo-700 sm:shrink-0"
        >
          Rozumím
        </button>
      </div>
    </div>
  );
}
