"use client";

import { useState, useEffect } from "react";
import { getTasksByContactId, type TaskRow } from "@/app/actions/tasks";
import Link from "next/link";

const PREVIEW_COUNT = 5;

export function ContactOpenTasksPreview({ contactId }: { contactId: string }) {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTasksByContactId(contactId)
      .then((list) => setTasks(list.filter((t) => !t.completedAt).slice(0, PREVIEW_COUNT)))
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  }, [contactId]);

  if (loading) {
    return (
      <div className="rounded-[var(--wp-radius-lg)] border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
          Otevřené úkoly
        </h3>
        <p className="text-sm text-slate-400">Načítám…</p>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="rounded-[var(--wp-radius-lg)] border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
          Otevřené úkoly
        </h3>
        <p className="text-sm text-slate-500">Žádné otevřené úkoly.</p>
        <Link
          href="#ukoly"
          className="mt-3 inline-flex items-center min-h-[44px] text-sm font-medium text-[var(--wp-accent)] hover:underline"
        >
          Úkoly a schůzky →
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--wp-radius-lg)] border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
        Otevřené úkoly ({tasks.length})
      </h3>
      <ul className="space-y-2">
        {tasks.map((task) => (
          <li key={task.id} className="flex items-center gap-2 text-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" aria-hidden />
            <span className="flex-1 truncate text-slate-700">{task.title}</span>
            {task.dueDate && (
              <span className="text-xs text-slate-400 shrink-0">
                {new Date(task.dueDate + "T00:00:00").toLocaleDateString("cs-CZ")}
              </span>
            )}
          </li>
        ))}
      </ul>
      <Link
        href="#ukoly"
        className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[var(--wp-accent)] hover:underline min-h-[44px] items-center"
      >
        Všechny úkoly
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      </Link>
    </div>
  );
}
