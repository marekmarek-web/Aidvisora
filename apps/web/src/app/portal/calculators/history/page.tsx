import Link from "next/link";
import { ArrowLeft, FileText, ChevronRight } from "lucide-react";
import { ListPageShell } from "@/app/components/list-page";
import { RECENT_CALCULATIONS_PLACEHOLDER } from "@/lib/calculators/recent-calculations-placeholder";

export default function CalculatorHistoryPage() {
  return (
    <ListPageShell className="max-w-[1200px]">
      <div className="mb-8">
        <Link
          href="/portal/calculators"
          className="inline-flex min-h-[44px] items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          <ArrowLeft size={18} aria-hidden />
          Zpět na kalkulačky
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-black tracking-tight text-[color:var(--wp-text)] md:text-3xl mb-2">
          Nedávné propočty
        </h1>
        <p className="text-sm font-medium text-[color:var(--wp-text-secondary)]">
          Přehled posledních propočtů z kalkulaček. Po napojení na CRM se zde zobrazí skutečná historie podle kontaktů.
        </p>
      </div>

      <div className="rounded-[32px] border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] p-6 shadow-sm md:p-8">
        <ul className="divide-y divide-[color:var(--wp-surface-card-border)]">
          {RECENT_CALCULATIONS_PLACEHOLDER.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="group flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0 transition-colors hover:text-indigo-600"
              >
                <div className="flex min-w-0 flex-1 items-start gap-4">
                  <div className="shrink-0 rounded-xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-muted)] p-2 text-indigo-500 shadow-sm group-hover:bg-indigo-50 group-hover:text-indigo-600 dark:group-hover:bg-indigo-950/40">
                    <FileText size={20} aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-[color:var(--wp-text)] group-hover:text-indigo-600 truncate">
                      {item.client}
                    </p>
                    <p className="text-sm font-semibold text-[color:var(--wp-text-secondary)]">{item.type}</p>
                    <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">
                      {item.date}
                    </p>
                  </div>
                </div>
                <ChevronRight
                  size={20}
                  className="shrink-0 text-[color:var(--wp-text-tertiary)] group-hover:text-indigo-600"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-center text-sm text-[color:var(--wp-text-secondary)] mt-8">
        Orientační výpočet. Nejedná se o finanční poradenství ani závaznou nabídku.
      </p>
    </ListPageShell>
  );
}
