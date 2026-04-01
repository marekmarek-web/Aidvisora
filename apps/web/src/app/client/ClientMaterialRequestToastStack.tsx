"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getPortalNotificationsForClient, markPortalNotificationRead } from "@/app/actions/portal-notifications";
import { X } from "lucide-react";

type ToastItem = { id: string; notificationId: string; title: string; href: string };

/**
 * Toast pro klienta při nové notifikaci typu požadavek od poradce (stejný zdroj jako přehled oznámení).
 */
export function ClientMaterialRequestToastStack() {
  const router = useRouter();
  const shownRef = useRef<Set<string>>(new Set());
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((localId: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== localId));
  }, []);

  const poll = useCallback(async () => {
    try {
      const list = await getPortalNotificationsForClient();
      for (const n of list) {
        if (n.type !== "advisor_material_request" || n.readAt) continue;
        if (shownRef.current.has(n.id)) continue;
        shownRef.current.add(n.id);
        let requestId = n.relatedEntityId ?? "";
        try {
          const b = JSON.parse(n.body || "{}") as { requestId?: string };
          if (typeof b.requestId === "string" && b.requestId) requestId = b.requestId;
        } catch {
          /* ignore */
        }
        if (!requestId) continue;
        const href = `/client/pozadavky-poradce/${requestId}`;
        setToasts((prev) => [
          ...prev.slice(-4),
          {
            id: `local-${n.id}`,
            notificationId: n.id,
            title: n.title,
            href,
          },
        ]);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void poll();
    const t = window.setInterval(() => void poll(), 35_000);
    return () => window.clearInterval(t);
  }, [poll]);

  async function openAndRead(toast: ToastItem) {
    try {
      await markPortalNotificationRead(toast.notificationId);
    } catch {
      /* best-effort */
    }
    router.push(toast.href);
    dismiss(toast.id);
  }

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[200] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
        >
          <div className="flex justify-between gap-2">
            <p className="text-sm font-bold text-slate-900">{t.title}</p>
            <button
              type="button"
              className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              aria-label="Zavřít"
              onClick={() => dismiss(t.id)}
            >
              <X size={16} />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void openAndRead(t)}
              className="min-h-[44px] rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white"
            >
              Otevřít
            </button>
            <Link
              href={t.href}
              className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-800"
              onClick={() => dismiss(t.id)}
            >
              Zobrazit
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
