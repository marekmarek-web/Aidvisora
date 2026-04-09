"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarPlus, CheckSquare, Loader2 } from "lucide-react";
import { createTeamEvent, createTeamTask } from "@/app/actions/team-events";
import type { CareerCoachingPackage } from "@/lib/career/career-coaching";

function defaultStartLocal(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function MemberCareerQuickActions({
  memberUserId,
  coaching,
  canCreateTeamCalendar,
  canEditTeamCareer,
}: {
  memberUserId: string;
  coaching: CareerCoachingPackage;
  canCreateTeamCalendar: boolean;
  canEditTeamCareer: boolean;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState<"event" | "task" | null>(null);

  const showSetupLink =
    coaching.recommendedActionKind === "data_completion" && canEditTeamCareer;

  async function runEvent(title: string) {
    setPending("event");
    setStatus(null);
    try {
      await createTeamEvent(
        {
          title: title.trim(),
          startAt: defaultStartLocal(),
          notes: coaching.cta.notesPreset || undefined,
          eventType: "schuzka",
        },
        [memberUserId]
      );
      setStatus("Týmová schůzka vytvořena a přiřazena členovi — zkontrolujte kalendář.");
    } catch {
      setStatus("Schůzku se nepodařilo vytvořit (oprávnění nebo chyba serveru).");
    } finally {
      setPending(null);
    }
  }

  async function runTask(title: string) {
    setPending("task");
    setStatus(null);
    try {
      await createTeamTask(
        {
          title: title.trim(),
          description: coaching.cta.notesPreset || undefined,
        },
        [memberUserId]
      );
      setStatus("Úkol vytvořen a přiřazen členovi.");
    } catch {
      setStatus("Úkol se nepodařilo vytvořit (oprávnění nebo chyba serveru).");
    } finally {
      setPending(null);
    }
  }

  if (!canCreateTeamCalendar) {
    return (
      <div className="rounded-xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-muted)]/40 p-4 text-sm text-[color:var(--wp-text-secondary)]">
        <p>
          Rychlé vytvoření schůzky nebo týmového úkolu zde není k dispozici podle vaší role. Můžete si domluvit termín mimo systém nebo požádat vedení
          workspace.
        </p>
        {showSetupLink ? (
          <Link
            href="/portal/setup?tab=tym"
            className="inline-flex mt-2 text-sm font-medium text-indigo-600 hover:underline"
          >
            Otevřít Nastavení → Tým (doplnit kariéru)
          </Link>
        ) : null}
      </div>
    );
  }

  const primaryEvent = coaching.cta.eventTitlePresets[0] ?? "1:1 — kariérní progres";
  const secondaryEvent = coaching.cta.eventTitlePresets[1];
  const primaryTask = coaching.cta.taskTitlePresets[0] ?? "Follow-up k 1:1";

  return (
    <div className="rounded-xl border border-indigo-200/70 bg-indigo-50/40 p-4 space-y-3">
      <p className="text-xs font-semibold text-[color:var(--wp-text)]">Rychlé akce (stejný flow jako týmový přehled)</p>
      <p className="text-[11px] text-[color:var(--wp-text-secondary)]">
        Vytvoří týmovou událost nebo úkol přiřazený tomuto členovi. Začátek schůzky je předvyplněn na zítra 9:00 — upravte v kalendáři.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => void runEvent(primaryEvent)}
          className={`inline-flex items-center gap-2 min-h-[40px] rounded-xl px-3 py-2 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60`}
        >
          {pending === "event" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarPlus className="w-4 h-4" />}
          Naplánovat: {primaryEvent}
        </button>
        {secondaryEvent ? (
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => void runEvent(secondaryEvent)}
            className="inline-flex items-center gap-2 min-h-[40px] rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-800 hover:bg-indigo-50 disabled:opacity-60"
          >
            {secondaryEvent}
          </button>
        ) : null}
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => void runTask(primaryTask)}
          className={`inline-flex items-center gap-2 min-h-[40px] rounded-xl px-3 py-2 text-sm font-medium border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] disabled:opacity-60`}
        >
          {pending === "task" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckSquare className="w-4 h-4" />}
          Úkol: {primaryTask}
        </button>
      </div>
      {showSetupLink ? (
        <Link href="/portal/setup?tab=tym" className="inline-flex text-sm font-medium text-violet-700 hover:underline">
          Doplnit kariérní zařazení v Nastavení → Tým
        </Link>
      ) : null}
      {status ? <p className="text-sm text-[color:var(--wp-text-secondary)]">{status}</p> : null}
      <p className="text-[10px] text-[color:var(--wp-text-tertiary)]">
        Vyžaduje oprávnění team_calendar:write. Plný týmový výběr více lidí je na{" "}
        <Link href="/portal/team-overview#team-calendar-actions" className="text-indigo-600 hover:underline">
          hlavním týmovém přehledu
        </Link>
        .
      </p>
    </div>
  );
}
