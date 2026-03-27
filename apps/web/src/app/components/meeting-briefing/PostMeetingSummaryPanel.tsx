"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  FileText,
  CheckSquare,
  Calendar,
  Briefcase,
  Mail,
  Copy,
  Sparkles,
  AlertCircle,
  ArrowUpRight,
} from "lucide-react";
import { getPostMeetingSummary } from "@/app/actions/post-meeting-summary";
import { createTask } from "@/app/actions/tasks";
import { createEvent } from "@/app/actions/events";
import { createOpportunity } from "@/app/actions/pipeline";
import { getOpportunityStages } from "@/app/actions/pipeline";
import { getTasksByContactId } from "@/app/actions/tasks";
import { submitAiFeedbackWithAction } from "@/app/actions/ai-actions";
import clsx from "clsx";
import type { PostMeetingSummary as PostMeetingSummaryType } from "@/lib/meeting-briefing/types";
import { portalPrimaryButtonClassName } from "@/lib/ui/create-action-button-styles";

type Props = {
  contactId: string;
  meetingNoteId?: string | null;
  eventId?: string | null;
  generationId?: string | null;
  /** When set, show form to generate from raw notes. */
  showRawNotesInput?: boolean;
};

function isSimilarTask(existing: { title: string; dueDate: string | null }[], suggested: { title: string; dueDate?: string }): boolean {
  const t = suggested.title.trim().toLowerCase();
  const d = suggested.dueDate ?? null;
  return existing.some((e) => e.title.trim().toLowerCase() === t || (d && e.dueDate === d));
}

export function PostMeetingSummaryPanel({
  contactId,
  meetingNoteId,
  eventId,
  generationId,
  showRawNotesInput = true,
}: Props) {
  const [summary, setSummary] = useState<PostMeetingSummaryType | null>(null);
  const [loading, setLoading] = useState(!!(meetingNoteId || eventId));
  const [error, setError] = useState(false);
  const [rawNotes, setRawNotes] = useState("");
  const [createdTaskIds, setCreatedTaskIds] = useState<Set<string>>(new Set());
  const [createdEventId, setCreatedEventId] = useState<string | null>(null);
  const [createdOppId, setCreatedOppId] = useState<string | null>(null);
  const [openTasks, setOpenTasks] = useState<Array<{ id: string; title: string; dueDate: string | null }>>([]);

  const loadSummary = useCallback(
    async (opts?: { rawNotes?: string }) => {
      setLoading(true);
      setError(false);
      try {
        const s = await getPostMeetingSummary(contactId, {
          meetingNoteId: meetingNoteId ?? undefined,
          eventId: eventId ?? undefined,
          rawNotes: opts?.rawNotes ?? rawNotes,
        });
        setSummary(s);
        if (contactId) {
          const tasks = await getTasksByContactId(contactId);
          setOpenTasks(tasks.filter((t) => !t.completedAt).map((t) => ({ id: t.id, title: t.title, dueDate: t.dueDate })));
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [contactId, meetingNoteId, eventId, rawNotes]
  );

  useEffect(() => {
    if (meetingNoteId || eventId) loadSummary();
  }, [meetingNoteId, eventId, loadSummary]);

  const handleCreateTask = async (title: string, dueDate?: string) => {
    try {
      const id = await createTask({ title, contactId, dueDate: dueDate || undefined });
      if (id) {
        setCreatedTaskIds((prev) => new Set(prev).add(id));
        setOpenTasks((prev) => [...prev, { id, title, dueDate: dueDate ?? null }]);
        if (generationId) {
          await submitAiFeedbackWithAction(generationId, "accepted", {
            actionTaken: "task_created",
            createdEntityType: "task",
            createdEntityId: id,
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateEvent = async (title: string) => {
    const start = new Date();
    start.setDate(start.getDate() + 7);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    try {
      const id = await createEvent({
        title,
        contactId,
        eventType: "schuzka",
        startAt: start.toISOString(),
        endAt: end.toISOString(),
      });
      if (id) {
        setCreatedEventId(id);
        if (generationId) {
          await submitAiFeedbackWithAction(generationId, "accepted", {
            actionTaken: "meeting_created",
            createdEntityType: "event",
            createdEntityId: id,
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateOpportunity = async (title: string) => {
    try {
      const stages = await getOpportunityStages();
      const first = stages.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))[0];
      if (!first) return;
      const id = await createOpportunity({
        title,
        contactId,
        caseType: "jiné",
        stageId: first.id,
      });
      if (id) {
        setCreatedOppId(id);
        if (generationId) {
          await submitAiFeedbackWithAction(generationId, "accepted", {
            actionTaken: "deal_created",
            createdEntityType: "opportunity",
            createdEntityId: id,
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const copyEmail = () => {
    if (!summary?.emailDraft?.body) return;
    const text = summary.emailDraft.subject ? `${summary.emailDraft.subject}\n\n${summary.emailDraft.body}` : summary.emailDraft.body;
    navigator.clipboard.writeText(text);
  };

  const suggestedTasksDeduped = summary?.suggestedTasks?.filter((t) => !isSimilarTask(openTasks, t)) ?? [];

  if (loading && !summary) {
    return (
      <div className="rounded-2xl border border-[color:var(--wp-border)] bg-[color:var(--wp-surface)] p-6 shadow-sm">
        <div className="flex items-center gap-2 text-[color:var(--wp-text-muted)]">
          <Sparkles size={18} className="animate-pulse" />
          <span className="text-sm font-medium">Generuji shrnutí…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-[color:var(--wp-border)] bg-[color:var(--wp-surface)] p-6 shadow-sm">
        <p className="text-sm text-[color:var(--wp-text-muted)] mb-4">Nepodařilo se vygenerovat shrnutí.</p>
        <button type="button" onClick={() => loadSummary()} className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">
          Zkusit znovu
        </button>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="rounded-2xl border border-[color:var(--wp-border)] bg-[color:var(--wp-surface)] p-6 shadow-sm">
        <h3 className="text-sm font-bold text-[color:var(--wp-text)] mb-2">Po schůzce – shrnutí a kroky</h3>
        <p className="text-sm text-[color:var(--wp-text-muted)] mb-4">
          Pro shrnutí přidejte zápisek ze schůzky nebo poznámky k události. Můžete také vložit poznámky níže.
        </p>
        {showRawNotesInput && (
          <>
            <textarea
              value={rawNotes}
              onChange={(e) => setRawNotes(e.target.value)}
              placeholder="Vložte poznámky ze schůzky…"
              className="w-full min-h-[120px] rounded-xl border border-[color:var(--wp-border)] bg-[color:var(--wp-surface)] p-3 text-sm text-[color:var(--wp-text)] placeholder:text-[color:var(--wp-text-muted)]"
              rows={4}
            />
            <button
              type="button"
              onClick={() => loadSummary({ rawNotes })}
              disabled={!rawNotes.trim() || loading}
              className={clsx(portalPrimaryButtonClassName, "mt-3 px-4 py-2.5 font-semibold disabled:opacity-50")}
            >
              <Sparkles size={16} /> Vygenerovat shrnutí
            </button>
          </>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/portal/notes?contactId=${contactId}`} className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">
            Přidat zápisek →
          </Link>
          <Link href={`/portal/calendar?contactId=${contactId}`} className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">
            Kalendář →
          </Link>
        </div>
      </div>
    );
  }

  const hasNoContent = !summary.summaryShort && summary.keyPoints.length === 0 && summary.agreedItems.length === 0;

  if (hasNoContent) {
    return (
      <div className="rounded-2xl border border-[color:var(--wp-border)] bg-[color:var(--wp-surface)] p-6 shadow-sm">
        <h3 className="text-sm font-bold text-[color:var(--wp-text)] mb-2">Po schůzce</h3>
        <p className="text-sm text-[color:var(--wp-text-muted)] mb-4">
          Pro kvalitní shrnutí přidejte zápisek ze schůzky nebo vložte poznámky a znovu vygenerujte.
        </p>
        {showRawNotesInput && (
          <>
            <textarea
              value={rawNotes}
              onChange={(e) => setRawNotes(e.target.value)}
              placeholder="Poznámky ze schůzky…"
              className="w-full min-h-[100px] rounded-xl border border-[color:var(--wp-border)] bg-[color:var(--wp-surface)] p-3 text-sm text-[color:var(--wp-text)]"
              rows={3}
            />
            <button
              type="button"
              onClick={() => loadSummary({ rawNotes })}
              disabled={!rawNotes.trim() || loading}
              className={clsx(portalPrimaryButtonClassName, "mt-3 px-4 py-2.5 font-semibold disabled:opacity-50")}
            >
              Vygenerovat znovu
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-bold text-[color:var(--wp-text)]">Shrnutí a další kroky</h3>
        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded">
          Návrh – zkontrolujte
        </span>
      </div>

      {summary.confidence === "low" && (
        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 text-sm bg-amber-50 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-800/50 rounded-xl p-3">
          <AlertCircle size={18} />
          Nízká jistota – zkontrolujte výstupy před použitím.
        </div>
      )}

      {summary.summaryShort && (
        <section className="rounded-xl border border-[color:var(--wp-border)] bg-[color:var(--wp-surface-muted)] p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText size={16} className="text-[color:var(--wp-text-muted)]" />
            <h4 className="text-sm font-bold text-[color:var(--wp-text)]">Shrnutí schůzky</h4>
          </div>
          <p className="text-sm text-[color:var(--wp-text)] whitespace-pre-wrap">{summary.summaryShort}</p>
        </section>
      )}

      {summary.keyPoints.length > 0 && (
        <section className="rounded-xl border border-[color:var(--wp-border)] bg-[color:var(--wp-surface-muted)] p-4">
          <h4 className="text-sm font-bold text-[color:var(--wp-text)] mb-2">Klíčové body</h4>
          <ul className="list-disc pl-4 text-sm text-[color:var(--wp-text)] space-y-1">
            {summary.keyPoints.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </section>
      )}

      {summary.agreedItems.length > 0 && (
        <section className="rounded-xl border border-[color:var(--wp-border)] bg-[color:var(--wp-surface-muted)] p-4">
          <h4 className="text-sm font-bold text-[color:var(--wp-text)] mb-2">Co bylo domluveno</h4>
          <ul className="list-disc pl-4 text-sm text-[color:var(--wp-text)] space-y-1">
            {summary.agreedItems.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </section>
      )}

      {suggestedTasksDeduped.length > 0 && (
        <section className="rounded-xl border border-indigo-100 dark:border-indigo-800/40 bg-indigo-50/50 dark:bg-indigo-950/30 p-4">
          <h4 className="text-sm font-bold text-[color:var(--wp-text)] mb-2 flex items-center gap-2">
            <CheckSquare size={16} /> Návrh úkolů
          </h4>
          <ul className="space-y-2">
            {suggestedTasksDeduped.map((t, i) => (
              <li key={i} className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm text-[color:var(--wp-text)]">{t.title}{t.dueDate ? ` (${t.dueDate})` : ""}</span>
                <button
                  type="button"
                  onClick={() => handleCreateTask(t.title, t.dueDate)}
                  className={clsx(portalPrimaryButtonClassName, "px-4 py-2 font-semibold")}
                >
                  Vytvořit úkol
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {summary.suggestedNextMeeting && !createdEventId && (
        <section className="rounded-xl border border-indigo-100 dark:border-indigo-800/40 bg-indigo-50/50 dark:bg-indigo-950/30 p-4">
          <h4 className="text-sm font-bold text-[color:var(--wp-text)] mb-2 flex items-center gap-2">
            <Calendar size={16} /> Návrh další schůzky
          </h4>
          <p className="text-sm text-[color:var(--wp-text)] mb-2">{summary.suggestedNextMeeting}</p>
          <button
            type="button"
            onClick={() => handleCreateEvent(summary.suggestedNextMeeting!)}
            className={clsx(portalPrimaryButtonClassName, "px-4 py-2 font-semibold")}
          >
            Naplánovat schůzku
          </button>
        </section>
      )}

      {summary.suggestedOpportunity && !createdOppId && (
        <section className="rounded-xl border border-indigo-100 dark:border-indigo-800/40 bg-indigo-50/50 dark:bg-indigo-950/30 p-4">
          <h4 className="text-sm font-bold text-[color:var(--wp-text)] mb-2 flex items-center gap-2">
            <Briefcase size={16} /> Návrh obchodu
          </h4>
          <p className="text-sm text-[color:var(--wp-text)] mb-2">{summary.suggestedOpportunity}</p>
          <button
            type="button"
            onClick={() => handleCreateOpportunity(summary.suggestedOpportunity!)}
            className={clsx(portalPrimaryButtonClassName, "px-4 py-2 font-semibold")}
          >
            Založit obchod
          </button>
        </section>
      )}

      {summary.emailDraft.body && (
        <section className="rounded-xl border border-[color:var(--wp-border)] bg-[color:var(--wp-surface-muted)] p-4">
          <h4 className="text-sm font-bold text-[color:var(--wp-text)] mb-2 flex items-center gap-2">
            <Mail size={16} /> Návrh e-mailu klientovi
          </h4>
          <p className="text-xs text-[color:var(--wp-text-muted)] mb-1">{summary.emailDraft.subject}</p>
          <div className="text-sm text-[color:var(--wp-text)] whitespace-pre-wrap rounded-lg bg-[color:var(--wp-surface)] p-3 border border-[color:var(--wp-border)] mb-2">
            {summary.emailDraft.body}
          </div>
          <button
            type="button"
            onClick={copyEmail}
            className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold bg-[color:var(--wp-surface-inset)] text-[color:var(--wp-text)] hover:bg-[color:var(--wp-surface-muted)]"
          >
            <Copy size={16} /> Kopírovat do schránky
          </button>
        </section>
      )}

      <div className="flex flex-wrap gap-2 text-xs text-[color:var(--wp-text-muted)]">
        <Link href={`/portal/contacts/${contactId}`} className="hover:text-indigo-600 dark:hover:text-indigo-400">
          Profil klienta <ArrowUpRight size={12} />
        </Link>
        <Link href={`/portal/notes?contactId=${contactId}`} className="hover:text-indigo-600 dark:hover:text-indigo-400">
          Zápisky
        </Link>
      </div>
    </div>
  );
}
