import Link from "next/link";
import type { HouseholdForContact } from "@/app/actions/households";

export function ContactHouseholdCard({
  household,
  className = "",
}: {
  household: HouseholdForContact;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}
    >
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
        Součást domácnosti
      </h3>
      <p className="font-semibold text-slate-900 mb-1">{household.name}</p>
      {household.role && (
        <p className="text-sm text-slate-600 mb-2">{household.role}</p>
      )}
      <p className="text-sm text-slate-500 mb-4">
        {household.memberCount} {household.memberCount === 1 ? "člen" : household.memberCount >= 2 && household.memberCount <= 4 ? "členové" : "členů"}
      </p>
      <Link
        href={`/portal/households/${household.id}`}
        className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors min-h-[44px] min-w-[44px] justify-center"
      >
        Otevřít rodinu
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      </Link>
    </div>
  );
}
