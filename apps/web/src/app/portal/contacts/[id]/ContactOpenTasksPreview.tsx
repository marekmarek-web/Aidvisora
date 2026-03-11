"use client";

import { useState, useEffect } from "react";
import { getTasksByContactId, type TaskRow } from "@/app/actions/tasks";
import Link from "next/link";
import { CheckCircle } from "lucide-react";

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
      <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-50 flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <CheckCircle size={18} className="text-emerald-500" /> Otevřené úkoly
          </h3>
        </div>
        <div className="p-4">
          <p className="text-sm text-slate-400">Načítám…</p>
        </div>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-50 flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <CheckCircle size={18} className="text-emerald-500" /> Otevřené úkoly
          </h3>
        </div>
        <div className="p-4">
          <p className="text-sm text-slate-500">Žádné otevřené úkoly.</p>
          <Link
            href="#ukoly"
            className="mt-3 inline-flex items-center min-h-[44px] text-sm font-medium text-indigo-600 hover:underline"
          >
            Úkoly a schůzky →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-50 flex items-center justify-between">
        <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
          <CheckCircle size={18} className="text-emerald-500" /> Otevřené úkoly
        </h3>
        <Link
          href="#ukoly"
          className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors min-h-[44px] min-w-[44px]"
          aria-label="Přidat úkol"
        >
          <span className="text-lg leading-none">+</span>
        </Link>
      </div>
      <div className="p-4 space-y-2">
        {tasks.map((task) => (
          <Link
            key={task.id}
            href="#ukoly"
            className="flex gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group min-h-[44px]"
          >
            <span className="mt-0.5 w-5 h-5 rounded-md border-2 border-slate-300 group-hover:border-emerald-400 text-transparent flex-shrink-0 transition-colors flex items-center justify-center">
              <CheckCircle size={12} className="stroke-[3]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-800 mb-1 leading-snug truncate">{task.title}</p>
              {task.dueDate && (
                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded inline-block bg-slate-100 text-slate-600">
                  {new Date(task.dueDate + "T00:00:00").toLocaleDateString("cs-CZ")}
                </span>
              )}
            </div>
          </Link>
        ))}
        <Link
          href="#ukoly"
          className="mt-3 inline-flex items-center gap-1 text-sm font-black uppercase tracking-widest text-indigo-600 hover:underline min-h-[44px] items-center"
        >
          Všechny úkoly
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </Link>
      </div>
    </div>
  );
}
