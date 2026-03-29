import Link from "next/link";
import { TrendingUp, Calculator, PiggyBank, HeartPulse, FileText, ChevronRight } from "lucide-react";
import { getCalculators } from "@/lib/calculators/core/registry";
import type { CalculatorIconId } from "@/lib/calculators/core/types";
import { RECENT_CALCULATIONS_PLACEHOLDER } from "@/lib/calculators/recent-calculations-placeholder";
import { ListPageShell, ListPageEmpty } from "@/app/components/list-page";

type IconProps = { className?: string; size?: number | string; strokeWidth?: number | string };
const ICON_MAP: Record<CalculatorIconId, React.ComponentType<IconProps>> = {
  "trending-up": TrendingUp as React.ComponentType<IconProps>,
  calculator: Calculator as React.ComponentType<IconProps>,
  "piggy-bank": PiggyBank as React.ComponentType<IconProps>,
  "heart-pulse": HeartPulse as React.ComponentType<IconProps>,
  "circle-help": Calculator as React.ComponentType<IconProps>,
};

type ThemeId = "investment" | "mortgage" | "pension" | "life";
const THEME: Record<
  ThemeId,
  { color: string; lightBg: string; hoverRing: string; tagColor?: string }
> = {
  investment: {
    color: "bg-indigo-600",
    lightBg: "bg-indigo-50",
    hoverRing: "group-hover:ring-indigo-100",
    tagColor: "text-indigo-700 bg-indigo-100",
  },
  mortgage: {
    color: "bg-blue-600",
    lightBg: "bg-blue-50",
    hoverRing: "group-hover:ring-blue-100",
  },
  pension: {
    color: "bg-emerald-600",
    lightBg: "bg-emerald-50",
    hoverRing: "group-hover:ring-emerald-100",
  },
  life: {
    color: "bg-rose-600",
    lightBg: "bg-rose-50",
    hoverRing: "group-hover:ring-rose-100",
  },
};

function getTheme(category: string): ThemeId {
  if (category === "investment") return "investment";
  if (category === "mortgage") return "mortgage";
  if (category === "pension") return "pension";
  if (category === "life") return "life";
  return "investment";
}

export default function CalculatorsPage() {
  const calculators = getCalculators();

  if (calculators.length === 0) {
    return (
      <ListPageShell className="max-w-[1200px]">
        <ListPageEmpty
          icon="🧮"
          title="Žádné kalkulačky"
          description="V registru nejsou momentálně žádné kalkulačky."
        />
        <p className="mt-8 text-center text-sm text-[color:var(--wp-text-secondary)]">
          Orientační výpočet. Nejedná se o finanční poradenství ani závaznou nabídku.
        </p>
      </ListPageShell>
    );
  }

  return (
    <ListPageShell className="max-w-[1200px]">
      {/* Hlavička stránky – 1:1 s návrhem */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 md:mb-12">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-black tracking-tight text-[color:var(--wp-text)] md:text-4xl">
              Kalkulačky
            </h1>
            <span className="rounded-lg border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-muted)] px-3 py-1 text-xs font-black text-[color:var(--wp-text-secondary)]">
              {calculators.length} celkem
            </span>
          </div>
          <p className="text-sm font-medium text-[color:var(--wp-text-secondary)]">
            Hypoteční, investiční a další expertní kalkulačky pro přípravu řešení.
          </p>
        </div>
      </div>

      {/* Grid 2×2 – pouze 4 kalkulačky, bez Komplexní analýzy */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        {calculators.map((def) => {
          const Icon = ICON_MAP[def.icon] ?? Calculator;
          const themeId = getTheme(def.category);
          const theme = THEME[themeId];
          const isFirst = def.id === "investment";
          const cardContent = (
            <>
              {/* Dekorativní blur glow na hover */}
              <div
                className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[60px] opacity-0 group-hover:opacity-40 transition-opacity duration-500 ${theme.color}`}
                aria-hidden
              />
              {isFirst && theme.tagColor && (
                <div
                  className={`absolute top-6 right-6 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${theme.tagColor}`}
                >
                  Nejpoužívanější
                </div>
              )}
              <div className="flex flex-col h-full relative z-10 text-center items-center justify-center min-h-[240px]">
                <div
                  className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg mb-6 transition-transform duration-300 group-hover:scale-110 ring-4 ring-transparent ${theme.hoverRing} ${theme.color}`}
                >
                  <Icon size={28} strokeWidth={2} />
                </div>
                <h2 className="text-lg font-black text-[color:var(--wp-text)] mb-3 group-hover:text-indigo-600 transition-colors duration-300">
                  {def.title}
                </h2>
                <p className="text-sm font-medium text-[color:var(--wp-text-secondary)] leading-relaxed max-w-[280px]">
                  {def.description}
                </p>
              </div>
            </>
          );

          if (def.status !== "active") {
            return (
              <div
                key={def.id}
                className="block rounded-[32px] border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] p-8 shadow-sm opacity-75 cursor-not-allowed"
              >
                {cardContent}
              </div>
            );
          }

          return (
            <Link
              key={def.id}
              href={def.route}
              className="group block rounded-[32px] border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] p-8 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all duration-300 relative overflow-hidden transform hover:-translate-y-1"
            >
              {cardContent}
            </Link>
          );
        })}
      </div>

      {/* Nedávné propočty – vizuál 1:1, připraveno na live data */}
      <div className="rounded-[32px] border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] p-6 shadow-sm md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h2 className="text-lg font-black text-[color:var(--wp-text)] flex items-center gap-2">
            <FileText size={18} className="text-indigo-500" />
            Nedávné propočty
          </h2>
          <Link
            href="/portal/calculators/history"
            className="inline-flex min-h-[44px] items-center gap-1 text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            Zobrazit všechny <ChevronRight size={16} aria-hidden />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {RECENT_CALCULATIONS_PLACEHOLDER.slice(0, 3).map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="group flex items-start gap-4 rounded-2xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-muted)] p-4 transition-all hover:border-indigo-200 hover:bg-[color:var(--wp-surface-card)] hover:shadow-md"
            >
              <div className="shrink-0 rounded-xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] p-2 text-indigo-500 shadow-sm transition-colors group-hover:bg-indigo-50 group-hover:text-indigo-600 dark:group-hover:bg-indigo-950/40">
                <FileText size={20} />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-sm text-[color:var(--wp-text)] group-hover:text-indigo-600 transition-colors mb-0.5 truncate">
                  {item.client}
                </h3>
                <p className="text-xs font-bold text-[color:var(--wp-text-secondary)] mb-2">{item.type}</p>
                <span className="text-[10px] font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">
                  {item.date}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <p className="text-center text-sm text-[color:var(--wp-text-secondary)] mt-8">
        Orientační výpočet. Nejedná se o finanční poradenství ani závaznou nabídku.
      </p>
    </ListPageShell>
  );
}
