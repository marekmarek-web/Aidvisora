"use client";

import { CalendarPlus, Sparkles, Trash2, ListTodo } from "lucide-react";
import { ChatModal } from "./ChatModal";

export function NewAdvisorActionsMenu({
  open,
  onClose,
  onAiSuggest,
  onScheduleMeeting,
  onCreateTask,
  onDeleteConversation,
}: {
  open: boolean;
  onClose: () => void;
  onAiSuggest: () => void;
  onScheduleMeeting: () => void;
  onCreateTask: () => void;
  onDeleteConversation: () => void;
}) {
  function wrap(fn: () => void) {
    return () => {
      fn();
      onClose();
    };
  }

  return (
    <ChatModal open={open} title="Nová akce" onClose={onClose}>
      <p className="mb-4 text-[color:var(--wp-text-secondary)]">
        Zvolte akci. Plná integrace kalendáře, úkolů a AI odpovědí přijde v dalších fázích.
      </p>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={wrap(onAiSuggest)}
          className="flex w-full items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-left text-sm font-medium text-violet-800 hover:bg-violet-100/80"
        >
          <Sparkles className="h-4 w-4 shrink-0" />
          Navrhnout odpověď AI
        </button>
        <button
          type="button"
          onClick={wrap(onScheduleMeeting)}
          className="flex w-full items-center gap-3 rounded-2xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] px-4 py-3 text-left text-sm font-medium text-[color:var(--wp-text)] hover:bg-[color:var(--wp-surface-muted)]"
        >
          <CalendarPlus className="h-4 w-4 shrink-0" />
          Naplánovat schůzku
        </button>
        <button
          type="button"
          onClick={wrap(onCreateTask)}
          className="flex w-full items-center gap-3 rounded-2xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] px-4 py-3 text-left text-sm font-medium text-[color:var(--wp-text)] hover:bg-[color:var(--wp-surface-muted)]"
        >
          <ListTodo className="h-4 w-4 shrink-0" />
          Vytvořit úkol
        </button>
        <button
          type="button"
          onClick={() => {
            onClose();
            onDeleteConversation();
          }}
          className="mt-2 flex w-full items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-left text-sm font-medium text-rose-800 hover:bg-rose-100/80"
        >
          <Trash2 className="h-4 w-4 shrink-0" />
          Smazat konverzaci
        </button>
      </div>
    </ChatModal>
  );
}
