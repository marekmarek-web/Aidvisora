"use client";

import type { RefObject } from "react";
import type { MessageRow, MessageAttachmentRow } from "@/app/actions/messages";
import { PortalMessageBubble } from "./PortalMessageBubble";
import { formatThreadDayLabel } from "./chat-format";

function sameCalendarDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function MessageThread({
  msgs,
  msgAttachments,
  onDeleteOne,
  deletingMessageId,
  bottomRef,
}: {
  msgs: MessageRow[];
  msgAttachments: Record<string, MessageAttachmentRow[]>;
  onDeleteOne: (messageId: string) => void;
  deletingMessageId: string | null;
  bottomRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.05),transparent_28%),linear-gradient(180deg,#fbfcff_0%,#f8fafc_100%)] px-4 py-5 md:px-6 md:py-6 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        {msgs.length === 0 ? (
          <p className="py-10 text-center text-sm text-[color:var(--wp-text-secondary)]">Zatím žádné zprávy. Napište první zprávu.</p>
        ) : null}

        {msgs.map((m, i) => {
          const d = new Date(m.createdAt);
          const prev = i > 0 ? new Date(msgs[i - 1]!.createdAt) : null;
          const showDay = !prev || !sameCalendarDay(d, prev);

          return (
            <div key={m.id} className="contents">
              {showDay ? (
                <div className="mx-auto rounded-full border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] px-3 py-1 text-xs font-medium text-[color:var(--wp-text-secondary)] shadow-sm">
                  {formatThreadDayLabel(d)}
                </div>
              ) : null}
              <PortalMessageBubble
                m={m}
                attachments={msgAttachments[m.id] ?? []}
                isOwn={m.senderType === "advisor"}
                onDeleteOne={onDeleteOne}
                deletePending={deletingMessageId === m.id}
              />
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
