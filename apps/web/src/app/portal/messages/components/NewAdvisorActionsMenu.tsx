"use client";

import { useRouter } from "next/navigation";
import { Briefcase, CalendarPlus, FileText, ListTodo, Trash2 } from "lucide-react";
import { ChatModal } from "./ChatModal";
import {
  calendarNewEventHref,
  contactNewOpportunityHref,
  notesNewWithContactHref,
  tasksNewWithContactHref,
} from "./advisor-chat-crm-routes";

export function NewAdvisorActionsMenu({
  open,
  onClose,
  contactId,
  onDeleteConversation,
}: {
  open: boolean;
  onClose: () => void;
  contactId: string;
  onDeleteConversation: () => void;
}) {
  const router = useRouter();

  function go(href: string) {
    onClose();
    router.push(href);
  }

  return (
    <ChatModal open={open} title="Nová akce" onClose={onClose}>
      <p className="mb-4 text-[color:var(--wp-text-secondary)]">
        Otevře se stávající obrazovka v portálu s předaným kontextem klienta. Dokončení akce je v příslušném modulu.
      </p>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => go(calendarNewEventHref(contactId))}
          className="flex w-full items-center gap-3 rounded-2xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] px-4 py-3 text-left text-sm font-medium text-[color:var(--wp-text)] hover:bg-[color:var(--wp-surface-muted)]"
        >
          <CalendarPlus className="h-4 w-4 shrink-0 text-indigo-600" />
          Naplánovat schůzku
        </button>
        <button
          type="button"
          onClick={() => go(tasksNewWithContactHref(contactId))}
          className="flex w-full items-center gap-3 rounded-2xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] px-4 py-3 text-left text-sm font-medium text-[color:var(--wp-text)] hover:bg-[color:var(--wp-surface-muted)]"
        >
          <ListTodo className="h-4 w-4 shrink-0 text-emerald-600" />
          Vytvořit úkol
        </button>
        <button
          type="button"
          onClick={() => go(notesNewWithContactHref(contactId))}
          className="flex w-full items-center gap-3 rounded-2xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] px-4 py-3 text-left text-sm font-medium text-[color:var(--wp-text)] hover:bg-[color:var(--wp-surface-muted)]"
        >
          <FileText className="h-4 w-4 shrink-0 text-violet-600" />
          Přidat poznámku
        </button>
        <button
          type="button"
          onClick={() => go(contactNewOpportunityHref(contactId))}
          className="flex w-full items-center gap-3 rounded-2xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] px-4 py-3 text-left text-sm font-medium text-[color:var(--wp-text)] hover:bg-[color:var(--wp-surface-muted)]"
        >
          <Briefcase className="h-4 w-4 shrink-0 text-amber-700" />
          Založit obchod / případ
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
