import Link from "next/link";
import { ChevronRight } from "lucide-react";
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
      className={`bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden group cursor-pointer hover:border-indigo-200 transition-colors ${className}`}
    >
      <div className="px-6 py-5 border-b border-slate-50">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Součást domácnosti
        </h3>
      </div>
      <Link
        href={`/portal/households/${household.id}`}
        className="block p-6"
      >
        <div className="flex items-center gap-4 mb-4">
          <div className="w-10 h-10 rounded-full border-2 border-white bg-slate-700 text-white flex items-center justify-center text-xs font-black shrink-0">
            {household.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{household.name}</h4>
            <p className="text-xs font-bold text-slate-500">
              {household.memberCount} {household.memberCount === 1 ? "člen" : household.memberCount >= 2 && household.memberCount <= 4 ? "členové" : "členů"}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          {household.role && (
            <span className="text-xs font-bold text-slate-500">
              Role: <strong className="text-slate-800">{household.role}</strong>
            </span>
          )}
          <span className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1 group-hover:gap-2 transition-all">
            Otevřít rodinu <ChevronRight size={14} />
          </span>
        </div>
      </Link>
    </div>
  );
}
