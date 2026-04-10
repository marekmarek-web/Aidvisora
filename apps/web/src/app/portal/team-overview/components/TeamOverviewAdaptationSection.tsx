"use client";

import Link from "next/link";
import { Check, X } from "lucide-react";
import type { TeamMemberInfo } from "@/app/actions/team-overview";
import type { NewcomerAdaptation } from "@/app/actions/team-overview";

export function TeamOverviewAdaptationSection({
  members,
  newcomers,
  displayName,
  memberDetailHref,
  selectMember,
}: {
  members: TeamMemberInfo[];
  newcomers: NewcomerAdaptation[];
  displayName: (m: TeamMemberInfo) => string;
  memberDetailHref: (userId: string) => string;
  selectMember: (userId: string) => void;
}) {
  return (
    <section
      className="mb-8 rounded-2xl border border-blue-200/60 bg-gradient-to-br from-blue-50/40 via-[color:var(--wp-surface-card)] to-[color:var(--wp-surface-card)] p-5 shadow-sm sm:p-6"
      aria-labelledby="team-adaptation-heading"
    >
      <h2 id="team-adaptation-heading" className="text-lg font-bold text-[color:var(--wp-text)] sm:text-xl">
        Adaptace a rozvoj
      </h2>
      <p className="mt-1 text-xs text-[color:var(--wp-text-secondary)] sm:text-sm">
        Nováčci v adaptačním okně — checklist a signály z CRM. Podpůrný tón: investice do náběhu, ne dohled.
      </p>
      {newcomers.length === 0 ? (
        <div className="mt-4 rounded-xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-muted)]/30 px-4 py-5 text-center text-sm text-[color:var(--wp-text-secondary)]">
          <p className="font-medium text-[color:var(--wp-text)]">Žádní nováčci v adaptačním okně</p>
          <p className="mt-1 text-xs leading-relaxed">
            Jakmile někdo nový přistoupí do týmu, objeví se tady s checklistem — dobrý podklad na krátký check-in.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {newcomers.map((n) => {
            const member = members.find((m) => m.userId === n.userId);
            const name = member ? displayName(member) : "Člen týmu";
            return (
              <div
                key={n.userId}
                className="rounded-2xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md"
              >
                <button
                  type="button"
                  onClick={() => selectMember(n.userId)}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-[color:var(--wp-text)]">{name}</p>
                      <p className="text-xs text-[color:var(--wp-text-secondary)]">
                        {n.daysInTeam} dní v týmu · {n.adaptationStatus}
                      </p>
                    </div>
                    <div className="rounded-full bg-[color:var(--wp-surface-muted)] px-2 py-0.5 text-xs font-bold text-[color:var(--wp-text-secondary)]">
                      {n.adaptationScore} %
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {n.checklist.map((s) => (
                      <span
                        key={s.key}
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                          s.completed ? "bg-emerald-100 text-emerald-600" : "bg-[color:var(--wp-surface-muted)] text-[color:var(--wp-text-tertiary)]"
                        }`}
                        title={s.label}
                      >
                        {s.completed ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      </span>
                    ))}
                  </div>
                  {n.warnings.length > 0 && <p className="mt-2 text-xs text-amber-600">{n.warnings.join(" · ")}</p>}
                </button>
                <Link
                  href={memberDetailHref(n.userId)}
                  className="mt-3 inline-flex text-xs font-medium text-indigo-600 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  Otevřít plný detail →
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
