"use client";

import { useEffect, useState, Suspense, lazy } from "react";
import {
  TrendingUp,
  Home,
  Umbrella,
  Heart,
  ChevronRight,
  ArrowRight,
  Target,
} from "lucide-react";
import { getCalculators } from "@/lib/calculators/core/registry";
import { FullscreenSheet } from "@/app/shared/mobile-ui/primitives";
import type { DeviceClass } from "@/lib/ui/useDeviceClass";

const InvestmentCalculatorPage = lazy(() =>
  import("@/app/portal/calculators/_components/investment/InvestmentCalculatorPage").then((m) => ({
    default: m.InvestmentCalculatorPage,
  }))
);
const MortgageCalculatorPage = lazy(() =>
  import("@/app/portal/calculators/_components/mortgage/MortgageCalculatorPage").then((m) => ({
    default: m.MortgageCalculatorPage,
  }))
);
const PensionCalculatorPage = lazy(() =>
  import("@/app/portal/calculators/_components/pension/PensionCalculatorPage").then((m) => ({
    default: m.PensionCalculatorPage,
  }))
);
const LifeCalculatorPage = lazy(() =>
  import("@/app/portal/calculators/_components/life/LifeCalculatorPage").then((m) => ({
    default: m.LifeCalculatorPage,
  }))
);

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type CalculatorSlug = "investment" | "mortgage" | "pension" | "life";

const CALC_ICONS: Record<string, React.ElementType> = {
  investment: TrendingUp,
  mortgage: Home,
  pension: Umbrella,
  life: Heart,
};

const CALC_COLORS: Record<string, { from: string }> = {
  investment: { from: "from-emerald-600 to-teal-700" },
  mortgage: { from: "from-blue-600 to-indigo-700" },
  pension: { from: "from-amber-500 to-orange-600" },
  life: { from: "from-rose-500 to-pink-700" },
};

function CalculatorLoader() {
  return (
    <div className="flex min-h-[200px] items-center justify-center px-4">
      <p className="text-sm font-semibold text-[color:var(--wp-text-secondary)]">Načítání kalkulačky…</p>
    </div>
  );
}

function WebCalculatorBody({ slug }: { slug: CalculatorSlug }) {
  switch (slug) {
    case "investment":
      return (
        <Suspense fallback={<CalculatorLoader />}>
          <InvestmentCalculatorPage />
        </Suspense>
      );
    case "mortgage":
      return (
        <Suspense fallback={<CalculatorLoader />}>
          <MortgageCalculatorPage />
        </Suspense>
      );
    case "pension":
      return (
        <Suspense fallback={<CalculatorLoader />}>
          <PensionCalculatorPage />
        </Suspense>
      );
    case "life":
      return (
        <Suspense fallback={<CalculatorLoader />}>
          <LifeCalculatorPage />
        </Suspense>
      );
    default:
      return null;
  }
}

/**
 * Mobile/tablet hub: stejné kalkulačky jako web (/portal/calculators/[slug]) přes lazy import.
 * Props onCreateTask… zachovány kvůli API shellu — webové stránky mají vlastní CTA/modály.
 */
export function CalculatorsHubScreen({
  detailSlugFromPath,
  onCreateTaskFromResult: _onCreateTaskFromResult,
  onCreateOpportunityFromResult: _onCreateOpportunityFromResult,
  onOpenAnalyses: _onOpenAnalyses,
  deviceClass = "phone",
}: {
  detailSlugFromPath: string | null;
  onCreateTaskFromResult: (title: string) => void;
  onCreateOpportunityFromResult: (title: string) => void;
  onOpenAnalyses: () => void;
  deviceClass?: DeviceClass;
}) {
  void _onCreateTaskFromResult;
  void _onCreateOpportunityFromResult;
  void _onOpenAnalyses;

  const calculators = getCalculators();
  const [selectedSlug, setSelectedSlug] = useState<CalculatorSlug | null>(
    (detailSlugFromPath as CalculatorSlug | null) ?? null
  );
  const [open, setOpen] = useState(Boolean(detailSlugFromPath));

  useEffect(() => {
    setSelectedSlug((detailSlugFromPath as CalculatorSlug | null) ?? null);
    setOpen(Boolean(detailSlugFromPath));
  }, [detailSlugFromPath]);

  const calcTitles: Record<CalculatorSlug, string> = {
    investment: "Investiční kalkulačka",
    mortgage: "Hypoteční kalkulačka",
    pension: "Penzijní kalkulačka",
    life: "Životní kalkulačka",
  };

  const isTablet = deviceClass === "tablet" || deviceClass === "desktop";

  const calcNode =
    selectedSlug && ["investment", "mortgage", "pension", "life"].includes(selectedSlug) ? (
      <div className="-mx-1 max-w-full overflow-x-hidden">
        <WebCalculatorBody slug={selectedSlug} />
      </div>
    ) : null;

  return (
    <>
      <div className="px-4 py-3 bg-[color:var(--wp-surface-card)] border-b border-[color:var(--wp-surface-card-border)]">
        <div className="flex items-center gap-2">
          <Target size={18} className="text-indigo-600" />
          <h2 className="text-base font-black text-[color:var(--wp-text)]">Kalkulačky</h2>
        </div>
        <p className="text-xs text-[color:var(--wp-text-secondary)] mt-0.5">Stejné propočty jako na webu</p>
      </div>

      {isTablet && selectedSlug ? (
        <div className="grid grid-cols-2 gap-0 h-[calc(100vh-10rem)]">
          <div className="border-r border-[color:var(--wp-surface-card-border)] overflow-y-auto px-4 py-3 space-y-2">
            {calculators.map((calc) => {
              const Icon = CALC_ICONS[calc.slug] ?? Target;
              const color = CALC_COLORS[calc.slug] ?? { from: "from-[#475569] to-[#1e293b]" };
              const active = selectedSlug === calc.slug;
              return (
                <button
                  key={calc.id}
                  type="button"
                  onClick={() => setSelectedSlug(calc.slug as CalculatorSlug)}
                  className={cx(
                    "w-full text-left rounded-xl border p-3.5 transition-colors",
                    active ? "border-indigo-300 bg-indigo-50" : "border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] hover:border-indigo-200"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cx(
                        "w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center flex-shrink-0",
                        color.from
                      )}
                    >
                      <Icon size={18} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cx("text-sm font-bold truncate", active ? "text-indigo-800" : "text-[color:var(--wp-text)]")}>
                        {calc.title}
                      </p>
                      <p className="text-xs text-[color:var(--wp-text-secondary)] mt-0.5 line-clamp-1">{calc.description}</p>
                    </div>
                    {active ? (
                      <ArrowRight size={14} className="text-indigo-500 flex-shrink-0" />
                    ) : (
                      <ChevronRight size={14} className="text-[color:var(--wp-text-tertiary)] flex-shrink-0" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="overflow-y-auto overflow-x-hidden px-2 py-3">{calcNode}</div>
        </div>
      ) : (
        <div className="px-4 py-3 space-y-2">
          {calculators.map((calc) => {
            const Icon = CALC_ICONS[calc.slug] ?? Target;
            const color = CALC_COLORS[calc.slug] ?? { from: "from-[#475569] to-[#1e293b]" };
            return (
              <button
                key={calc.id}
                type="button"
                onClick={() => {
                  setSelectedSlug(calc.slug as CalculatorSlug);
                  setOpen(true);
                }}
                className="w-full text-left bg-[color:var(--wp-surface-card)] border border-[color:var(--wp-surface-card-border)] rounded-xl overflow-hidden hover:border-indigo-200 transition-colors"
              >
                <div className="flex items-center gap-3 p-3.5">
                  <div
                    className={cx(
                      "w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center flex-shrink-0",
                      color.from
                    )}
                  >
                    <Icon size={22} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[color:var(--wp-text)]">{calc.title}</p>
                    <p className="text-xs text-[color:var(--wp-text-secondary)] mt-0.5 line-clamp-2">{calc.description}</p>
                  </div>
                  <ChevronRight size={16} className="text-[color:var(--wp-text-tertiary)] flex-shrink-0" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {!isTablet ? (
        <FullscreenSheet
          open={open}
          onClose={() => setOpen(false)}
          title={selectedSlug ? calcTitles[selectedSlug] : "Kalkulačka"}
        >
          <div className="pb-4">{calcNode}</div>
        </FullscreenSheet>
      ) : null}
    </>
  );
}
