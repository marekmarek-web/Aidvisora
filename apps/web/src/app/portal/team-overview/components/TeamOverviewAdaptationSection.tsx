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
  variant = "compact",
  onCheckIn,
}: {
  members: TeamMemberInfo[];
  newcomers: NewcomerAdaptation[];
  displayName: (m: TeamMemberInfo) => string;
  memberDetailHref: (userId: string) => string;
  selectMember: (userId: string) => void;
  /** Standalone tab „Adaptace“ — širší karty + check-in CTA. */
  variant?: "compact" | "standalone";
  onCheckIn?: (userId: string) => void;
}) {
  const sectionClass =
    variant === "standalone"
      ? "mb-0 rounded-[32px] border border-slate-200/80 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)] sm:p-7"
      : "mb-8 rounded-[32px] border border-slate-200/80 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] sm:p-6";

  return (
    <section className={sectionClass} aria-labelledby="team-adaptation-heading">
      <h2 id="team-adaptation-heading" className="text-[26px] font-black tracking-tight text-[color:var(--wp-text)] sm:text-[1.9rem]">
        {variant === "standalone" ? "Adaptace finančního poradce" : "Adaptace a rozvoj"}
      </h2>
      <p className="mt-1.5 text-sm text-[color:var(--wp-text-secondary)]">
        Nováčci v adaptačním okně, checklist a signály z CRM pro kompaktní check-in.
      </p>
      {newcomers.length === 0 ? (
        <div className="mt-4 rounded-3xl border border-slate-200/80 bg-slate-50/80 px-5 py-7 text-center text-sm text-[color:var(--wp-text-secondary)]">
          <p className="font-semibold text-[color:var(--wp-text)]">Aktuálně bez aktivní adaptace</p>
          <p className="mt-1 text-xs leading-relaxed">
            Jakmile do týmu nastoupí nový člen v adaptačním okně, objeví se zde jeho checklist i rychlý kontext pro vedení.
          </p>
        </div>
      ) : (
        <div
          className={
            variant === "standalone"
              ? "mt-6 grid gap-5 xl:grid-cols-2"
              : "mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          }
        >
          {newcomers.map((n) => {
            const member = members.find((m) => m.userId === n.userId);
            const name = member ? displayName(member) : "Člen týmu";
            const risky = n.adaptationStatus === "Rizikový";
            return (
              <div
                key={n.userId}
                className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-px hover:border-slate-300"
              >
                <button
                  type="button"
                  onClick={() => selectMember(n.userId)}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-extrabold text-[16px] text-[color:var(--wp-text)]">{name}</p>
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[color:var(--wp-text-secondary)]">
                        Fáze: {n.adaptationStatus}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${
                          risky ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {n.adaptationStatus}
                      </span>
                      <div className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-bold text-[color:var(--wp-text-secondary)]">
                        {n.adaptationScore} %
                      </div>
                    </div>
                  </div>
                  <div className="mt-5">
                    <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
                      <span>Adaptační osa poradce</span>
                      <span className="text-[#16192b]">{n.adaptationScore}% hotovo</span>
                    </div>
                    <div className="relative space-y-3 before:absolute before:bottom-0 before:left-[11px] before:top-0 before:w-px before:bg-slate-200">
                      {n.checklist.map((s, index) => (
                        <div key={s.key} className="relative flex items-start gap-3">
                          <span
                            className={`relative z-10 inline-flex h-6 w-6 items-center justify-center rounded-full border-2 bg-white text-xs ${
                              s.completed
                                ? "border-emerald-500 bg-emerald-500 text-white"
                                : index === 0
                                  ? "border-[#16192b] text-[#16192b]"
                                  : "border-slate-200 text-slate-400"
                            }`}
                            title={s.label}
                          >
                            {s.completed ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                          </span>
                          <div
                            className={`flex-1 rounded-[16px] border p-3 ${
                              s.completed
                                ? "border-slate-100 bg-slate-50 text-slate-500"
                                : index === 0
                                  ? "border-[#16192b] bg-[#16192b] text-white"
                                  : "border-slate-100 bg-white text-slate-400"
                            }`}
                          >
                            <div className="text-[11px] font-bold">{s.label}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {n.warnings.length > 0 && <p className="mt-2 text-xs text-amber-700">{n.warnings.join(" · ")}</p>}
                </button>
                <Link
                  href={memberDetailHref(n.userId)}
                  className="mt-3 inline-flex text-xs font-semibold text-indigo-600 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  Otevřít plný detail →
                </Link>
                {variant === "standalone" && onCheckIn ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCheckIn(n.userId);
                    }}
                    className="mt-3 w-full rounded-2xl bg-[#16192b] py-3 text-[11px] font-black uppercase tracking-[0.16em] text-white shadow-sm transition hover:bg-black"
                  >
                    Check-in schůzka
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
