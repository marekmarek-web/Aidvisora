"use client";

import { useEffect, useMemo, useState } from "react";
import {
  TrendingUp,
  Home,
  Umbrella,
  Heart,
  ChevronRight,
  ArrowRight,
  Target,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { getCalculators } from "@/lib/calculators/core/registry";
import { computeProjection } from "@/lib/calculators/investment/investment.engine";
import { INVESTMENT_PROFILES } from "@/lib/calculators/investment/investment.config";
import { calculateResult as calculateMortgageResult } from "@/lib/calculators/mortgage/mortgage.engine";
import { runCalculations as runPensionCalculations } from "@/lib/calculators/pension/pension.engine";
import { runCalculations as runLifeCalculations } from "@/lib/calculators/life/life.engine";
import {
  FullscreenSheet,
  MobileCard,
  StatusBadge,
} from "@/app/shared/mobile-ui/primitives";
import type { DeviceClass } from "@/lib/ui/useDeviceClass";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function fmtCzk(v: number) {
  return `${Math.round(v).toLocaleString("cs-CZ")} Kč`;
}

type CalculatorSlug = "investment" | "mortgage" | "pension" | "life";

/* ------------------------------------------------------------------ */
/*  Calculator icon map                                                */
/* ------------------------------------------------------------------ */

const CALC_ICONS: Record<string, React.ElementType> = {
  investment: TrendingUp,
  mortgage: Home,
  pension: Umbrella,
  life: Heart,
};

const CALC_COLORS: Record<string, { from: string; icon: string }> = {
  investment: { from: "from-emerald-600 to-teal-700", icon: "text-emerald-500" },
  mortgage: { from: "from-blue-600 to-indigo-700", icon: "text-blue-500" },
  pension: { from: "from-amber-500 to-orange-600", icon: "text-amber-500" },
  life: { from: "from-rose-500 to-pink-700", icon: "text-rose-500" },
};

/* ------------------------------------------------------------------ */
/*  Shared input helpers                                               */
/* ------------------------------------------------------------------ */

function FieldLabel({ label, sublabel }: { label: string; sublabel?: string }) {
  return (
    <div className="mb-1">
      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
        {label}
      </label>
      {sublabel ? <span className="text-[10px] text-slate-400 ml-1.5">{sublabel}</span> : null}
    </div>
  );
}

function NumInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value || 0))}
        className="flex-1 min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-900 bg-white"
      />
      {suffix ? (
        <span className="text-xs font-bold text-slate-400 w-8 text-center">{suffix}</span>
      ) : null}
    </div>
  );
}

function RangeRow({
  label,
  sublabel,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
  display,
}: {
  label: string;
  sublabel?: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  display?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <FieldLabel label={label} sublabel={sublabel} />
        <span className="text-sm font-black text-slate-900">
          {display ?? `${value.toLocaleString("cs-CZ")}${suffix ? ` ${suffix}` : ""}`}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step ?? 1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 accent-indigo-600 rounded-full"
      />
      <div className="flex justify-between mt-0.5">
        <span className="text-[9px] text-slate-400">
          {min.toLocaleString("cs-CZ")}{suffix ? ` ${suffix}` : ""}
        </span>
        <span className="text-[9px] text-slate-400">
          {max.toLocaleString("cs-CZ")}{suffix ? ` ${suffix}` : ""}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Result metric display                                              */
/* ------------------------------------------------------------------ */

function MetricResult({
  label,
  value,
  tone = "neutral",
  large,
}: {
  label: string;
  value: string;
  tone?: "success" | "warning" | "danger" | "neutral" | "info";
  large?: boolean;
}) {
  const textColor = tone === "success" ? "text-emerald-700" : tone === "warning" ? "text-amber-700" : tone === "danger" ? "text-rose-700" : tone === "info" ? "text-indigo-700" : "text-slate-900";
  const bgColor = tone === "success" ? "bg-emerald-50" : tone === "warning" ? "bg-amber-50" : tone === "danger" ? "bg-rose-50" : tone === "info" ? "bg-indigo-50" : "bg-slate-50";
  return (
    <div className={cx("rounded-xl px-3 py-2.5", bgColor)}>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{label}</p>
      <p className={cx("font-black tabular-nums", large ? "text-xl" : "text-base", textColor)}>{value}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CTA row                                                            */
/* ------------------------------------------------------------------ */

function CtaRow({
  onTask,
  onOpportunity,
  onAnalyses,
}: {
  onTask: () => void;
  onOpportunity: () => void;
  onAnalyses: () => void;
}) {
  return (
    <MobileCard className="bg-indigo-50/60 border-indigo-200 p-3.5">
      <p className="text-xs font-black text-indigo-900 mb-2">Uložit do workflow</p>
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={onTask}
          className="min-h-[40px] rounded-xl bg-indigo-600 text-white text-xs font-bold"
        >
          Úkol
        </button>
        <button
          type="button"
          onClick={onOpportunity}
          className="min-h-[40px] rounded-xl border border-indigo-200 bg-white text-indigo-700 text-xs font-bold"
        >
          Obchod
        </button>
        <button
          type="button"
          onClick={onAnalyses}
          className="min-h-[40px] rounded-xl border border-slate-200 text-slate-700 text-xs font-bold"
        >
          Analýza
        </button>
      </div>
    </MobileCard>
  );
}

/* ------------------------------------------------------------------ */
/*  Investment calculator                                              */
/* ------------------------------------------------------------------ */

function InvestmentCalc({
  onTask,
  onOpportunity,
  onAnalyses,
}: {
  onTask: () => void;
  onOpportunity: () => void;
  onAnalyses: () => void;
}) {
  const [initial, setInitial] = useState(500_000);
  const [monthly, setMonthly] = useState(3_000);
  const [years, setYears] = useState(20);
  const [profileId, setProfileId] = useState(INVESTMENT_PROFILES[1]?.id ?? "vyvazeny");
  const profile = useMemo(
    () => INVESTMENT_PROFILES.find((p) => p.id === profileId) ?? INVESTMENT_PROFILES[0],
    [profileId]
  );
  const result = useMemo(
    () => computeProjection({ initial, monthly, years, profile }),
    [initial, monthly, years, profile]
  );
  const contributed = initial + monthly * 12 * years;
  const gain = result.totalBalance - contributed;

  return (
    <div className="space-y-3">
      <MobileCard className="p-4 space-y-4">
        <RangeRow
          label="Počáteční vklad"
          value={initial}
          onChange={setInitial}
          min={0}
          max={5_000_000}
          step={10_000}
          display={fmtCzk(initial)}
        />
        <RangeRow
          label="Měsíční vklad"
          value={monthly}
          onChange={setMonthly}
          min={0}
          max={50_000}
          step={500}
          display={fmtCzk(monthly)}
        />
        <RangeRow
          label="Horizont"
          value={years}
          onChange={setYears}
          min={1}
          max={40}
          suffix="let"
        />
        <div>
          <FieldLabel label="Investiční profil" />
          <div className="grid grid-cols-2 gap-2 mt-1">
            {INVESTMENT_PROFILES.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setProfileId(p.id)}
                className={cx(
                  "min-h-[40px] rounded-xl border text-xs font-bold transition-colors",
                  profileId === p.id
                    ? "border-indigo-300 bg-indigo-600 text-white"
                    : "border-slate-200 text-slate-600"
                )}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      </MobileCard>

      {/* Results */}
      <MobileCard className="p-3.5 space-y-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Výsledek</p>
        <MetricResult label="Celková hodnota" value={fmtCzk(result.totalBalance)} tone="success" large />
        <div className="grid grid-cols-2 gap-2">
          <MetricResult label="Vloženo" value={fmtCzk(contributed)} tone="neutral" />
          <MetricResult label="Výnos" value={fmtCzk(gain)} tone={gain > 0 ? "info" : "warning"} />
        </div>
      </MobileCard>

      <CtaRow
        onTask={onTask}
        onOpportunity={onOpportunity}
        onAnalyses={onAnalyses}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mortgage calculator                                                */
/* ------------------------------------------------------------------ */

function MortgageCalc({
  onTask,
  onOpportunity,
  onAnalyses,
}: {
  onTask: () => void;
  onOpportunity: () => void;
  onAnalyses: () => void;
}) {
  const [loan, setLoan] = useState(4_500_000);
  const [own, setOwn] = useState(900_000);
  const [term, setTerm] = useState(30);

  const result = useMemo(
    () =>
      calculateMortgageResult({
        product: "mortgage",
        mortgageType: "standard",
        loanType: "consumer",
        loan,
        own,
        extra: 0,
        term,
        fix: 5,
        type: "new",
        ltvLock: null,
      }),
    [loan, own, term]
  );

  const totalPurchase = loan + own;
  const ltv = loan > 0 ? Math.round((loan / totalPurchase) * 100) : 0;
  const totalInterest = result.monthlyPayment * term * 12 - loan;

  return (
    <div className="space-y-3">
      <MobileCard className="p-4 space-y-4">
        <RangeRow
          label="Cena nemovitosti (celkem)"
          value={totalPurchase}
          onChange={(v) => setLoan(Math.max(0, v - own))}
          min={500_000}
          max={20_000_000}
          step={100_000}
          display={fmtCzk(totalPurchase)}
        />
        <RangeRow
          label="Vlastní zdroje"
          value={own}
          onChange={setOwn}
          min={0}
          max={totalPurchase}
          step={50_000}
          display={fmtCzk(own)}
        />
        <RangeRow
          label="Splatnost"
          value={term}
          onChange={setTerm}
          min={5}
          max={40}
          suffix="let"
        />
      </MobileCard>

      <MobileCard className="p-3.5 space-y-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Výsledek</p>
        <MetricResult label="Měsíční splátka" value={fmtCzk(result.monthlyPayment)} tone="info" large />
        <div className="grid grid-cols-2 gap-2">
          <MetricResult label="Úroková sazba" value={`${result.finalRate.toFixed(2)} %`} tone="neutral" />
          <MetricResult label="LTV" value={`${ltv} %`} tone={ltv > 90 ? "danger" : ltv > 80 ? "warning" : "success"} />
        </div>
        <MetricResult label="Celkové úroky" value={fmtCzk(Math.max(0, totalInterest))} tone="warning" />
      </MobileCard>

      <CtaRow onTask={onTask} onOpportunity={onOpportunity} onAnalyses={onAnalyses} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Pension calculator                                                 */
/* ------------------------------------------------------------------ */

function PensionCalc({
  onTask,
  onOpportunity,
  onAnalyses,
}: {
  onTask: () => void;
  onOpportunity: () => void;
  onAnalyses: () => void;
}) {
  const [age, setAge] = useState(35);
  const [retireAge, setRetireAge] = useState(65);
  const [salary, setSalary] = useState(42_000);
  const [rentNeed, setRentNeed] = useState(35_000);

  const result = useMemo(
    () =>
      runPensionCalculations({
        age,
        retireAge,
        salary,
        rent: rentNeed,
        scenario: "realistic",
      }),
    [age, retireAge, salary, rentNeed]
  );

  const yearsToRetire = retireAge - age;
  const gapTone = result.monthlyGap > 5000 ? "danger" : result.monthlyGap > 0 ? "warning" : "success";

  return (
    <div className="space-y-3">
      <MobileCard className="p-4 space-y-4">
        <RangeRow label="Aktuální věk" value={age} onChange={setAge} min={18} max={retireAge - 1} suffix="let" />
        <RangeRow label="Věk odchodu do důchodu" value={retireAge} onChange={setRetireAge} min={age + 1} max={75} suffix="let" />
        <RangeRow
          label="Čistý měsíční příjem"
          value={salary}
          onChange={setSalary}
          min={10_000}
          max={200_000}
          step={1_000}
          display={fmtCzk(salary)}
        />
        <RangeRow
          label="Cílová měsíční renta"
          value={rentNeed}
          onChange={setRentNeed}
          min={5_000}
          max={100_000}
          step={1_000}
          display={fmtCzk(rentNeed)}
        />
      </MobileCard>

      <MobileCard className="p-3.5 space-y-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Výsledek</p>
        <div className="grid grid-cols-2 gap-2">
          <MetricResult
            label="Měsíční gap"
            value={fmtCzk(result.monthlyGap)}
            tone={gapTone}
            large
          />
          <MetricResult
            label="Roky do důchodu"
            value={`${yearsToRetire} let`}
            tone="neutral"
          />
        </div>
        <MetricResult
          label="Doporučené měs. spoření"
          value={fmtCzk(result.monthlyInvestment)}
          tone="info"
        />
      </MobileCard>

      <CtaRow onTask={onTask} onOpportunity={onOpportunity} onAnalyses={onAnalyses} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Life insurance calculator                                          */
/* ------------------------------------------------------------------ */

function LifeCalc({
  onTask,
  onOpportunity,
  onAnalyses,
}: {
  onTask: () => void;
  onOpportunity: () => void;
  onAnalyses: () => void;
}) {
  const [income, setIncome] = useState(50_000);
  const [expenses, setExpenses] = useState(35_000);
  const [liabilities, setLiabilities] = useState(2_000_000);

  const result = useMemo(
    () =>
      runLifeCalculations({
        age: 35,
        netIncome: income,
        expenses,
        liabilities,
        reserves: 200_000,
        children: 2,
        hasSpouse: true,
      }),
    [income, expenses, liabilities]
  );

  const surplus = income - expenses;
  const surplusTone = surplus < 0 ? "danger" : surplus < 5000 ? "warning" : "success";

  return (
    <div className="space-y-3">
      <MobileCard className="p-4 space-y-4">
        <RangeRow
          label="Čistý měsíční příjem"
          value={income}
          onChange={setIncome}
          min={10_000}
          max={200_000}
          step={1_000}
          display={fmtCzk(income)}
        />
        <RangeRow
          label="Měsíční výdaje domácnosti"
          value={expenses}
          onChange={setExpenses}
          min={5_000}
          max={income}
          step={1_000}
          display={fmtCzk(expenses)}
        />
        <RangeRow
          label="Závazky (hypotéky, úvěry)"
          value={liabilities}
          onChange={setLiabilities}
          min={0}
          max={20_000_000}
          step={100_000}
          display={fmtCzk(liabilities)}
        />
      </MobileCard>

      <MobileCard className="p-3.5 space-y-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Výsledek</p>
        <MetricResult label="Krytí úmrtí" value={fmtCzk(result.deathCoverage)} tone="info" large />
        <div className="grid grid-cols-2 gap-2">
          <MetricResult label="PN denně" value={fmtCzk(result.pnDailyNeed)} tone="warning" />
          <MetricResult label="Přebytek / měs." value={fmtCzk(surplus)} tone={surplusTone} />
        </div>
      </MobileCard>

      <CtaRow onTask={onTask} onOpportunity={onOpportunity} onAnalyses={onAnalyses} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main screen                                                        */
/* ------------------------------------------------------------------ */

export function CalculatorsHubScreen({
  detailSlugFromPath,
  onCreateTaskFromResult,
  onCreateOpportunityFromResult,
  onOpenAnalyses,
  deviceClass = "phone",
}: {
  detailSlugFromPath: string | null;
  onCreateTaskFromResult: (title: string) => void;
  onCreateOpportunityFromResult: (title: string) => void;
  onOpenAnalyses: () => void;
  deviceClass?: DeviceClass;
}) {
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

  const calcNode = selectedSlug === "investment" ? (
    <InvestmentCalc
      onTask={() => onCreateTaskFromResult("Navázat na investiční propočet")}
      onOpportunity={() => onCreateOpportunityFromResult("Investiční příležitost")}
      onAnalyses={onOpenAnalyses}
    />
  ) : selectedSlug === "mortgage" ? (
    <MortgageCalc
      onTask={() => onCreateTaskFromResult("Navázat na hypoteční propočet")}
      onOpportunity={() => onCreateOpportunityFromResult("Hypoteční příležitost")}
      onAnalyses={onOpenAnalyses}
    />
  ) : selectedSlug === "pension" ? (
    <PensionCalc
      onTask={() => onCreateTaskFromResult("Navázat na penzijní propočet")}
      onOpportunity={() => onCreateOpportunityFromResult("Penzijní příležitost")}
      onAnalyses={onOpenAnalyses}
    />
  ) : selectedSlug === "life" ? (
    <LifeCalc
      onTask={() => onCreateTaskFromResult("Navázat na životní propočet")}
      onOpportunity={() => onCreateOpportunityFromResult("Pojišťovací příležitost")}
      onAnalyses={onOpenAnalyses}
    />
  ) : null;

  return (
    <>
      {/* Header */}
      <div className="px-4 py-3 bg-white border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Target size={18} className="text-indigo-600" />
          <h2 className="text-base font-black text-slate-900">Kalkulačky</h2>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">Rychlé propočty pro poradce</p>
      </div>

      {isTablet && selectedSlug ? (
        /* Tablet: side-by-side */
        <div className="grid grid-cols-2 gap-0 h-[calc(100vh-10rem)]">
          <div className="border-r border-slate-100 overflow-y-auto px-4 py-3 space-y-2">
            {calculators.map((calc) => {
              const Icon = CALC_ICONS[calc.slug] ?? Target;
              const color = CALC_COLORS[calc.slug] ?? { from: "from-slate-600 to-slate-800", icon: "text-slate-500" };
              const active = selectedSlug === calc.slug;
              return (
                <button
                  key={calc.id}
                  type="button"
                  onClick={() => setSelectedSlug(calc.slug as CalculatorSlug)}
                  className={cx(
                    "w-full text-left rounded-xl border p-3.5 transition-colors",
                    active ? "border-indigo-300 bg-indigo-50" : "border-slate-200 bg-white hover:border-indigo-200"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cx("w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center flex-shrink-0", color.from)}>
                      <Icon size={18} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cx("text-sm font-bold truncate", active ? "text-indigo-800" : "text-slate-900")}>
                        {calc.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{calc.description}</p>
                    </div>
                    {active ? <ArrowRight size={14} className="text-indigo-500 flex-shrink-0" /> : <ChevronRight size={14} className="text-slate-300 flex-shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="overflow-y-auto px-4 py-3 space-y-3">
            {calcNode}
          </div>
        </div>
      ) : (
        /* Phone: list + sheet */
        <div className="px-4 py-3 space-y-2">
          {calculators.map((calc) => {
            const Icon = CALC_ICONS[calc.slug] ?? Target;
            const color = CALC_COLORS[calc.slug] ?? { from: "from-slate-600 to-slate-800", icon: "text-slate-500" };
            return (
              <button
                key={calc.id}
                type="button"
                onClick={() => {
                  setSelectedSlug(calc.slug as CalculatorSlug);
                  setOpen(true);
                }}
                className="w-full text-left bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-indigo-200 transition-colors"
              >
                <div className="flex items-center gap-3 p-3.5">
                  <div className={cx("w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center flex-shrink-0", color.from)}>
                    <Icon size={22} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900">{calc.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{calc.description}</p>
                  </div>
                  <ChevronRight size={16} className="text-slate-300 flex-shrink-0" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Phone: detail sheet */}
      {!isTablet ? (
        <FullscreenSheet
          open={open}
          onClose={() => setOpen(false)}
          title={selectedSlug ? calcTitles[selectedSlug] : "Kalkulačka"}
        >
          <div className="space-y-3 pb-4">
            {calcNode}
          </div>
        </FullscreenSheet>
      ) : null}
    </>
  );
}
