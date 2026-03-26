"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { revokeAllStoredPushTokens, revokeStoredPushToken } from "@/lib/push/usePushNotifications";

function getInitials(email: string | undefined): string {
  if (!email) return "?";
  const part = email.split("@")[0];
  const parts = part.split(/[._-]/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
  return part.slice(0, 2).toUpperCase();
}

type UserMenuProps = {
  /** Kulatý trigger 48px jako main banner txt (ř. 516–526). */
  variant?: "default" | "portalHeader";
};

export function UserMenu({ variant = "default" }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [initials, setInitials] = useState("?");
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setInitials(getInitials(user?.email));
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    function onClose() {
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onMouseDownOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDownOutside);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDownOutside);
    };
  }, [open]);

  async function signOut() {
    const supabase = createClient();
    await revokeStoredPushToken();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  async function signOutAllDevices() {
    const supabase = createClient();
    await revokeAllStoredPushTokens();
    await supabase.auth.signOut({ scope: "global" });
    router.push("/");
    router.refresh();
  }

  const triggerClass =
    variant === "portalHeader"
      ? `flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 text-sm font-black transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2
          dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:scale-105 dark:ring-offset-[color:var(--wp-portal-header-bg)]
          border-white bg-slate-200 text-slate-600 shadow-sm hover:scale-105 hover:bg-slate-100 ring-offset-2 ring-offset-[color:var(--wp-portal-header-bg)]
          ${open ? "ring-2 ring-indigo-500 ring-offset-2" : ""}`
      : "flex items-center justify-center min-h-[44px] min-w-[44px] h-9 w-9 rounded-full bg-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={triggerClass}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Profil a nastavení"
      >
        {initials}
      </button>
      {open && (
        <div className="wp-dropdown absolute right-0 top-full mt-1 w-48 z-[9999] rounded-[var(--wp-radius-sm)] border border-slate-200 bg-white shadow-lg py-1">
          <Link
            href="/portal/profile"
            className="block px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 min-h-[44px] flex items-center"
            onClick={() => setOpen(false)}
          >
            Profil
          </Link>
          <Link
            href="/portal/setup"
            className="block px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 min-h-[44px] flex items-center"
            onClick={() => setOpen(false)}
          >
            Nastavení
          </Link>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              signOut();
            }}
            className="block w-full text-left px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 min-h-[44px]"
          >
            Odhlásit se
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              signOutAllDevices();
            }}
            className="block w-full text-left px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 min-h-[44px]"
          >
            Odhlásit všechna zařízení
          </button>
        </div>
      )}
    </div>
  );
}
