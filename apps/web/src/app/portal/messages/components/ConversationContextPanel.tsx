"use client";

import { CheckCheck, Clock3, Mail, Phone, Sparkles } from "lucide-react";
import clsx from "clsx";
import type { ContactRow } from "@/app/actions/contacts";

export function ConversationContextPanel({
  contactName,
  contact,
  lastMessagePreview,
  onAiSuggest,
  onScheduleMeeting,
  onCreateTask,
  asDiv,
  className,
}: {
  contactName: string;
  contact: ContactRow | null;
  lastMessagePreview: string;
  onAiSuggest: () => void;
  onScheduleMeeting: () => void;
  onCreateTask: () => void;
  /** Vnoření v modalu — sémanticky `div`, bez duplicitního rámečku kolem celého sheetu. */
  asDiv?: boolean;
  className?: string;
}) {
  const email = contact?.email?.trim();
  const phone = contact?.phone?.trim();
  const stage = contact?.lifecycleStage?.trim();
  const tags = contact?.tags?.filter(Boolean).slice(0, 4) ?? [];
  const subtitle = [stage, tags.length ? tags.join(" · ") : null].filter(Boolean).join(" · ") || "Aktivní klient";

  const todo = [
    { label: "Navrhnout odpověď AI", onClick: onAiSuggest },
    { label: "Naplánovat schůzku", onClick: onScheduleMeeting },
    { label: "Vytvořit úkol", onClick: onCreateTask },
  ] as const;

  const Root = asDiv ? "div" : "aside";

  return (
    <Root
      className={clsx(
        "flex min-h-0 flex-col gap-4 overflow-y-auto rounded-[28px] border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] p-4 shadow-sm",
        asDiv && "rounded-none border-0 bg-transparent p-0 shadow-none",
        className,
      )}
    >
      <div className="rounded-3xl bg-gradient-to-br from-slate-900 to-violet-800 p-5 text-white shadow-sm">
        <div className="text-xs uppercase tracking-[0.16em] text-violet-200">Rychlý kontext</div>
        <div className="mt-2 text-lg font-semibold leading-snug">{contactName}</div>
        <div className="mt-1 text-sm text-violet-100/90">{subtitle}</div>
        {lastMessagePreview ? (
          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-white/85">{lastMessagePreview}</p>
        ) : null}
      </div>

      <div className="rounded-3xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-muted)] p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--wp-text)]">
          <Sparkles className="h-4 w-4 text-violet-500" />
          AI kontext
        </div>
        <div className="mt-3 rounded-2xl bg-[color:var(--wp-surface-card)] px-3 py-3 text-sm leading-6 text-[color:var(--wp-text-secondary)] shadow-sm">
          Ve druhé fázi zde přibude shrnutí vlákna a návrhy odpovědí. Prozatím použijte tlačítko{' '}
          <span className="font-medium text-[color:var(--wp-text)]">Navrhnout odpověď AI</span> nad konverzací.
        </div>
      </div>

      <div className="rounded-3xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-muted)] p-4">
        <div className="text-sm font-semibold text-[color:var(--wp-text)]">Co udělat teď</div>
        <div className="mt-3 space-y-2 text-sm text-[color:var(--wp-text-secondary)]">
          {todo.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={item.onClick}
              className="flex w-full items-start gap-3 rounded-2xl bg-[color:var(--wp-surface-card)] px-3 py-3 text-left shadow-sm transition hover:bg-[color:var(--wp-surface-muted)]"
            >
              <CheckCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-muted)] p-4">
        <div className="text-sm font-semibold text-[color:var(--wp-text)]">Kontakt</div>
        <div className="mt-3 space-y-2 text-sm text-[color:var(--wp-text-secondary)]">
          {email ? (
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 shrink-0 text-[color:var(--wp-text-tertiary)]" />
              <a href={`mailto:${email}`} className="truncate text-indigo-600 underline">
                {email}
              </a>
            </div>
          ) : (
            <p className="text-xs text-[color:var(--wp-text-tertiary)]">E-mail není vyplněný.</p>
          )}
          {phone ? (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 shrink-0 text-[color:var(--wp-text-tertiary)]" />
              <a href={`tel:${phone}`} className="text-indigo-600 underline">
                {phone}
              </a>
            </div>
          ) : null}
          <div className="flex items-start gap-2 pt-1">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--wp-text-tertiary)]" />
            <span>Detaily dostupnosti doplníme v další fázi.</span>
          </div>
        </div>
      </div>
    </Root>
  );
}
