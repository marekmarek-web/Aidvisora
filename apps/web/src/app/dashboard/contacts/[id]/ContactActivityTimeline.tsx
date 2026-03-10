"use client";

import { useState, useEffect } from "react";
import { getActivityForEntity } from "@/app/actions/activity";
import type { ActivityRow } from "@/app/actions/activity";

const ACTION_LABELS: Record<string, string> = {
  create: "Vytvořeno",
  update: "Upraveno",
  delete: "Smazáno",
  complete: "Dokončeno",
  status_change: "Změna stavu",
  upload: "Nahráno",
};

const ENTITY_LABELS: Record<string, string> = {
  contact: "Kontakt",
  contract: "Smlouva",
  document: "Dokument",
  event: "Událost",
  task: "Úkol",
  opportunity: "Příležitost",
};

function formatDate(date: Date | string) {
  return new Date(date).toLocaleString("cs-CZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ContactActivityTimeline({ contactId }: { contactId: string }) {
  const [items, setItems] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getActivityForEntity("contact", contactId)
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [contactId]);

  return (
    <div className="rounded-[var(--wp-radius-lg)] border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="font-semibold text-slate-800 mb-4 text-sm">Aktivita</h2>

      {loading && (
        <p className="text-sm text-slate-500">Načítání…</p>
      )}

      {!loading && items.length === 0 && (
        <p className="text-sm text-slate-500">Zatím žádná aktivita.</p>
      )}

      {!loading && items.length > 0 && (
        <div className="relative space-y-0">
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-200" />
          {items.map((item) => (
            <div key={item.id} className="relative flex gap-3 py-2">
              <div className="relative z-10 mt-1.5 h-[9px] w-[9px] shrink-0 rounded-full bg-[var(--wp-accent)] ring-2 ring-white" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-800">
                  <span className="font-medium">
                    {ACTION_LABELS[item.action] ?? item.action}
                  </span>
                  {" · "}
                  <span className="text-slate-500">
                    {ENTITY_LABELS[item.entityType] ?? item.entityType}
                  </span>
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {formatDate(item.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
