"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getMeetingNotesList } from "@/app/actions/meeting-notes";
import type { MeetingNoteRow } from "@/app/actions/meeting-notes";
import { EmptyState } from "@/app/components/EmptyState";

export function ContactNotesSection({ contactId }: { contactId: string }) {
  const [notes, setNotes] = useState<MeetingNoteRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMeetingNotesList(contactId)
      .then(setNotes)
      .catch(() => setNotes([]))
      .finally(() => setLoading(false));
  }, [contactId]);

  if (loading) {
    return (
      <div className="rounded-[var(--wp-radius-lg)] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Načítám zápisky…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-slate-800">Zápisky ze schůzek</h2>
        <Link
          href={`/portal/notes?contactId=${contactId}`}
          className="inline-flex items-center gap-2 rounded-[var(--wp-radius)] bg-[var(--wp-accent)] text-white px-4 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity min-h-[44px]"
        >
          Nový zápisek
        </Link>
      </div>
      <div className="rounded-[var(--wp-radius-lg)] border border-slate-200 bg-white shadow-sm overflow-hidden">
        {notes.length === 0 ? (
          <EmptyState
            icon="📝"
            title="Zatím žádné zápisky"
            description="Zápisky ze schůzek s tímto klientem se zobrazí zde."
            actionLabel="Nový zápisek"
            onAction={() => window.location.assign(`/portal/notes?contactId=${contactId}`)}
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {notes.map((n) => (
              <li key={n.id}>
                <Link
                  href={`/portal/notes?note=${n.id}`}
                  className="flex flex-wrap items-center gap-3 px-4 py-4 hover:bg-slate-50 transition-colors min-h-[44px]"
                >
                  <span className="text-sm font-medium text-slate-800">
                    {new Date(n.meetingAt).toLocaleDateString("cs-CZ", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                  {n.domain && (
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {n.domain}
                    </span>
                  )}
                  <span className="text-xs text-slate-400">
                    {new Date(n.createdAt).toLocaleString("cs-CZ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
