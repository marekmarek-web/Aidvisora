"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getNotificationBadgeCount } from "@/app/actions/notification-log";

export function NotificationBell() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    getNotificationBadgeCount().then(setCount).catch(() => setCount(0));
  }, []);

  return (
    <Link
      href="/portal/notifications"
      className="relative flex items-center justify-center w-9 h-9 min-h-[44px] min-w-[44px] rounded-[var(--wp-radius-sm)] text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-colors"
      title="Oznámení – zprávy od klientů, kalendář, úkoly, poznámky"
      aria-label="Oznámení"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {count != null && count > 0 && (
        <span
          className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-[var(--wp-danger)] text-white text-[11px] font-semibold"
          aria-hidden
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
