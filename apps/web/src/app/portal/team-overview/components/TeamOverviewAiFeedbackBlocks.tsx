"use client";

import { useState } from "react";
import { ClipboardList, User } from "lucide-react";
import type { TeamMemberInfo } from "@/app/actions/team-overview";
import type { AiFeedbackVerdict, AiFeedbackActionTaken } from "@/app/actions/ai-feedback";
import type { AiActionType } from "@/lib/ai/actions/action-suggestions";
import { CustomDropdown } from "@/app/components/ui/CustomDropdown";
import { portalPrimaryButtonClassName } from "@/lib/ui/create-action-button-styles";
import clsx from "clsx";

const FEEDBACK_VERDICTS: { value: AiFeedbackVerdict; label: string }[] = [
  { value: "accepted", label: "Přijato" },
  { value: "rejected", label: "Zamítnuto" },
  { value: "edited", label: "Upraveno" },
];

const FEEDBACK_ACTION_TAKEN: { value: AiFeedbackActionTaken; label: string }[] = [
  { value: "none", label: "Žádná akce" },
  { value: "task_created", label: "Vytvořena úloha" },
  { value: "meeting_created", label: "Vytvořena schůzka" },
  { value: "service_action_created", label: "Servisní akce" },
];

export function TeamSummaryFeedback({
  onSubmit,
  saving,
  disabled,
}: {
  onSubmit: (verdict: AiFeedbackVerdict, actionTaken: AiFeedbackActionTaken) => void;
  saving: boolean;
  disabled: boolean;
}) {
  const [verdict, setVerdict] = useState<AiFeedbackVerdict>("accepted");
  const [actionTaken, setActionTaken] = useState<AiFeedbackActionTaken>("none");

  return (
    <div className="mt-4 pt-4 border-t border-[color:var(--wp-surface-card-border)]">
      <p className="text-sm font-medium text-[color:var(--wp-text-secondary)] mb-2">Zpětná vazba k shrnutí</p>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {FEEDBACK_VERDICTS.map((v) => (
          <button
            key={v.value}
            type="button"
            onClick={() => setVerdict(v.value)}
            disabled={disabled}
            className={`min-h-[44px] rounded-xl border px-3 py-2 text-sm font-medium disabled:opacity-60 ${
              verdict === v.value
                ? "border-violet-500 bg-violet-50 text-violet-700"
                : "border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] text-[color:var(--wp-text-secondary)] hover:bg-[color:var(--wp-surface-muted)]"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-[color:var(--wp-text-secondary)]">Co jste udělali:</label>
        <CustomDropdown
          value={actionTaken}
          onChange={(id) => setActionTaken(id as AiFeedbackActionTaken)}
          options={FEEDBACK_ACTION_TAKEN.map((a) => ({ id: a.value, label: a.label }))}
          placeholder="Akce"
          icon={ClipboardList}
        />
        <button
          type="button"
          onClick={() => onSubmit(verdict, actionTaken)}
          disabled={disabled}
          className="min-h-[44px] rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
        >
          {saving ? "Odesílám…" : "Odeslat zpětnou vazbu"}
        </button>
      </div>
    </div>
  );
}

const TEAM_ACTION_TYPES: { value: AiActionType; label: string }[] = [
  { value: "task", label: "Úkol" },
  { value: "meeting", label: "Schůzka" },
  { value: "service_action", label: "Servisní akce" },
];

export function TeamSummaryFollowUp({
  members,
  onCreate,
  saving,
  error,
}: {
  members: TeamMemberInfo[];
  onCreate: (actionType: AiActionType, title: string, memberId: string | null, dueAt?: string) => void;
  saving: boolean;
  error: string | null;
}) {
  const [actionType, setActionType] = useState<AiActionType>("task");
  const [title, setTitle] = useState("");
  const [memberId, setMemberId] = useState<string>("");
  const [dueAt, setDueAt] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onCreate(actionType, title.trim(), memberId || null, dueAt || undefined);
  };

  return (
    <div className="mt-4 pt-4 border-t border-[color:var(--wp-surface-card-border)]">
      <p className="text-sm font-medium text-[color:var(--wp-text-secondary)] mb-2">Vytvořit follow-up z shrnutí</p>
      {error && (
        <p className="mb-2 text-sm text-rose-600" role="alert">
          {error}
        </p>
      )}
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        <CustomDropdown
          value={actionType}
          onChange={(id) => setActionType(id as AiActionType)}
          options={TEAM_ACTION_TYPES.map((a) => ({ id: a.value, label: a.label }))}
          placeholder="Typ"
          icon={ClipboardList}
        />
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Název úkolu nebo schůzky"
          disabled={saving}
          className="min-h-[44px] flex-1 min-w-[160px] rounded-xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] px-3 py-2 text-sm text-[color:var(--wp-text-secondary)] placeholder:text-[color:var(--wp-text-tertiary)] disabled:opacity-60"
        />
        <CustomDropdown
          value={memberId}
          onChange={setMemberId}
          options={[{ id: "", label: "— Přiřadit mně —" }, ...members.map((m) => ({ id: m.userId, label: m.displayName || m.email || m.userId }))]}
          placeholder="— Přiřadit mně —"
          icon={User}
        />
        <input
          type="date"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
          disabled={saving}
          className="min-h-[44px] rounded-xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] px-3 py-2 text-sm text-[color:var(--wp-text-secondary)] disabled:opacity-60"
          title="Termín"
        />
        <button type="submit" disabled={saving || !title.trim()} className={clsx(portalPrimaryButtonClassName, "px-4 py-2 text-sm font-medium disabled:opacity-60")}>
          {saving ? "Vytvářím…" : "Vytvořit"}
        </button>
      </form>
    </div>
  );
}
