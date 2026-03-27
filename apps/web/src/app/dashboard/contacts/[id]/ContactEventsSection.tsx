"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { listEvents, type EventRow } from "@/app/actions/events";
import { Calendar, Loader2 } from "lucide-react";
import { EVENT_TYPE_LABELS } from "@/lib/db-constants";

function formatEventDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("cs-CZ", { day: "numeric", month: "short", year: "numeric" });
}

function formatEventTime(d: Date | string): string {
  return new Date(d).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" });
}

export function ContactEventsSection({ contactId }: { contactId: string }) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listEvents({ contactId })
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [contactId]);

  const now = new Date();
  const upcoming = events.filter((e) => new Date(e.startAt) >= now).sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  const past = events.filter((e) => new Date(e.startAt) < now).sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());

  return (
    <div className="rounded-xl border border-[var(--brand-border)] bg-[color:var(--wp-surface)] p-6 shadow-sm">
      <h2 className="font-semibold text-[color:var(--wp-text)] mb-4 text-sm flex items-center gap-2">
        <Calendar size={16} className="text-[color:var(--wp-text-muted)]" aria-hidden />
        Schůzky a události
      </h2>
      {loading && (
        <p className="text-sm text-[color:var(--wp-text-muted)] flex items-center gap-2">
          <Loader2 size={16} className="animate-spin shrink-0" /> Načítání…
        </p>
      )}
      {!loading && events.length === 0 && (
        <p className="text-sm text-[color:var(--wp-text-muted)]">Zatím žádné schůzky ani události.</p>
      )}
      {!loading && events.length > 0 && (
        <div className="space-y-4">
          {upcoming.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--wp-text-muted)] mb-2">Nadcházející</p>
              <ul className="space-y-2" role="list">
                {upcoming.slice(0, 10).map((ev) => (
                  <li key={ev.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="font-medium text-[color:var(--wp-text)]">{ev.title}</span>
                    <span className="text-[color:var(--wp-text-muted)]">
                      {formatEventDate(ev.startAt)}
                      {!ev.allDay && ` · ${formatEventTime(ev.startAt)}`}
                    </span>
                    {ev.eventType && (
                      <span className="text-xs font-medium text-[color:var(--wp-text-muted)]">
                        {EVENT_TYPE_LABELS[ev.eventType as keyof typeof EVENT_TYPE_LABELS] ?? ev.eventType}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {upcoming.length > 10 && (
                <p className="text-xs text-[color:var(--wp-text-muted)] mt-1">a dalších {upcoming.length - 10}</p>
              )}
            </div>
          )}
          {past.length > 0 && upcoming.length <= 10 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--wp-text-muted)] mb-2">Minulé</p>
              <ul className="space-y-2" role="list">
                {past.slice(0, 5).map((ev) => (
                  <li key={ev.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[color:var(--wp-text-muted)]">
                    <span className="font-medium text-[color:var(--wp-text)]">{ev.title}</span>
                    <span className="text-[color:var(--wp-text-muted)]">
                      {formatEventDate(ev.startAt)}
                      {!ev.allDay && ` · ${formatEventTime(ev.startAt)}`}
                    </span>
                  </li>
                ))}
              </ul>
              {past.length > 5 && (
                <p className="text-xs text-[color:var(--wp-text-muted)] mt-1">a dalších {past.length - 5}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
