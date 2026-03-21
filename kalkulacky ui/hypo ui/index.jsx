"use client"; // Next.js App Router — odstraňte pokud používáte Pages Router

/**
 * ================================================================
 * HypotecniKalkulacka — Standalone React modul
 * ================================================================
 * Závislosti (přidejte do package.json):
 *   npm install chart.js
 *
 * Fonty — přidejte do layout.jsx nebo _document.jsx:
 *   <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700
 *     &family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet">
 *
 * Použití:
 *   import HypotecniKalkulacka from "@/components/HypotecniKalkulacka";
 *   <HypotecniKalkulacka />
 * ================================================================
 */

import { useState, useEffect, useRef, useCallback } from "react";
import s from "./styles.module.css";

// ================================================================
// CONSTANTS
// ================================================================

const GRAD_START = "#2563EB"; // REPLACE: Aidvisora brand primary
const GRAD_END   = "#38BDF8"; // REPLACE: Aidvisora brand secondary
const TRACK_COL  = "#E2E8F0";
const CIRC       = 2 * Math.PI * 36; // SVG donut circumference (r=36)

/** @type {{ fix_years: number }: number} */
const BANKS = [
  { id: "moneta", name: "Moneta Money Bank", abbr: "MO",  color: "#006D9F",
    rates: { 1: 4.09, 3: 4.14, 5: 4.19, 7: 4.25, 10: 4.35 } },
  { id: "fio",    name: "Fio banka",          abbr: "Fio", color: "#007B3E",
    rates: { 1: 4.09, 3: 4.14, 5: 4.19, 7: 4.26, 10: 4.38 } },
  { id: "ucb",    name: "UniCredit Bank",     abbr: "UCB", color: "#B7002D",
    rates: { 1: 4.10, 3: 4.15, 5: 4.19, 7: 4.27, 10: 4.39 } },
  { id: "rb",     name: "Raiffeisenbank",     abbr: "RB",  color: "#E9C500", textColor: "#1a1a1a",
    rates: { 1: 4.14, 3: 4.19, 5: 4.24, 7: 4.30, 10: 4.42 } },
  { id: "air",    name: "Air Bank",           abbr: "AIR", color: "#2E9E30",
    rates: { 1: 4.19, 3: 4.24, 5: 4.29, 7: 4.36, 10: 4.49 } },
  { id: "kb",     name: "Komerční banka",     abbr: "KB",  color: "#0F2B6F",
    rates: { 1: 4.39, 3: 4.44, 5: 4.49, 7: 4.55, 10: 4.68 } },
  { id: "csas",   name: "Česká spořitelna",   abbr: "ČS",  color: "#005BA1",
    rates: { 1: 4.39, 3: 4.44, 5: 4.49, 7: 4.56, 10: 4.69 } },
  { id: "csob",   name: "ČSOB",               abbr: "ČSOB",color: "#003E8C",
    rates: { 1: 4.59, 3: 4.64, 5: 4.69, 7: 4.75, 10: 4.89 } },
];

const PRODUCTS = {
  hypoteka: ["Nová hypotéka", "Konsolidace / Refinancování", "Klasická", "Investiční", "Americká"],
  uver:     ["Spotřebitelský", "Konsolidace", "Leasing"],
};

// ================================================================
// MATH HELPERS
// ================================================================

const fmt = (n) =>
  Math.round(n)
    .toLocaleString("cs-CZ")
    .replace(/[\u202F\u00A0]/g, "\u00A0"); // non-breaking space

const parseCzk = (str) =>
  parseInt(String(str).replace(/\s/g, "").replace(/[^\d]/g, "")) || 0;

function calcPmt(principal, annualRate, termYears) {
  if (!principal || !annualRate || !termYears) return 0;
  const r = annualRate / 100 / 12;
  const n = termYears * 12;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function buildAmortTable(principal, annualRate, termYears) {
  const r      = annualRate / 100 / 12;
  const n      = termYears * 12;
  const pmtVal = calcPmt(principal, annualRate, termYears);
  let balance  = principal;
  const rows   = [];
  for (let i = 1; i <= n; i++) {
    const interest = balance * r;
    const prinPay  = pmtVal - interest;
    balance = Math.max(0, balance - prinPay);
    rows.push({ month: i, interest, principal: prinPay, balance });
  }
  return rows;
}

function getBestRate(fix) {
  return BANKS.reduce((min, b) => {
    const r = b.rates[fix] ?? 99;
    return r < min ? r : min;
  }, 99);
}

function sliderGradient(value, min, max) {
  const pct = (((value - min) / (max - min)) * 100).toFixed(1);
  return `linear-gradient(90deg, ${GRAD_START} 0%, ${GRAD_END} ${pct}%, ${TRACK_COL} ${pct}%)`;
}

// ================================================================
// SUB-COMPONENTS
// ================================================================

/** Slider s gradient trackem a zarovnanými limity */
function Slider({ id, value, min, max, step, onChange, limitLeft, limitRight }) {
  const bg = sliderGradient(value, min, max);
  return (
    <div className={s.sliderOuter}>
      <div className={s.sliderWrap}>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ background: bg }}
          className={s.rangeInput}
          aria-label={id}
        />
      </div>
      {(limitLeft || limitRight) && (
        <div className={s.rangeLimits}>
          <span className={s.rangeLimit}>{limitLeft}</span>
          <span className={s.rangeLimit}>{limitRight}</span>
        </div>
      )}
    </div>
  );
}

/** SVG donut chart — žádná externí závislost */
function DonutChart({ principal, interest, ltv }) {
  const total = principal + interest;
  const iLen  = total > 0 ? (interest / total) * CIRC : 0;
  const pLen  = total > 0 ? (principal / total) * CIRC : 0;

  return (
    <div className={s.donutWrap}>
      <svg width={96} height={96} viewBox="0 0 96 96" aria-hidden="true">
        {/* Track */}
        <circle cx={48} cy={48} r={36} fill="none"
          stroke="rgba(255,255,255,0.07)" strokeWidth={11} />
        {/* Úroky (zelená) */}
        <circle cx={48} cy={48} r={36} fill="none"
          stroke="#34D399" strokeWidth={11}
          strokeDasharray={`${iLen.toFixed(2)} ${CIRC.toFixed(2)}`}
          strokeDashoffset={0}
          strokeLinecap="butt"
          transform="rotate(-90 48 48)"
          style={{ transition: "stroke-dasharray 0.5s ease" }} />
        {/* Jistina (modrá) */}
        <circle cx={48} cy={48} r={36} fill="none"
          stroke="#60A5FA" strokeWidth={11}
          strokeDasharray={`${pLen.toFixed(2)} ${CIRC.toFixed(2)}`}
          strokeDashoffset={`${(-iLen).toFixed(2)}`}
          strokeLinecap="butt"
          transform="rotate(-90 48 48)"
          style={{ transition: "stroke-dasharray 0.5s ease, stroke-dashoffset 0.5s ease" }} />
      </svg>
      <div className={s.donutCenter}>
        <span className={s.donutCenterLabel}>LTV</span>
        <span className={s.donutCenterVal}>{ltv} %</span>
      </div>
    </div>
  );
}

/** Toggle switch */
function Toggle({ on, onToggle, label }) {
  return (
    <button
      className={`${s.togglePill} ${on ? s.toggleOn : ""}`}
      onClick={onToggle}
      type="button"
      aria-pressed={on}
    >
      <span className={`${s.sw} ${on ? s.swOn : ""}`} />
      <span className={s.toggleLabel}>{label}</span>
    </button>
  );
}

// ================================================================
// MAIN COMPONENT
// ================================================================

export default function HypotecniKalkulacka() {
  // --- State ---
  const [property,  setProperty]  = useState(8_000_000);
  const [mortgage,  setMortgage]  = useState(5_600_000);
  const [term,      setTerm]      = useState(30);
  const [fix,       setFix]       = useState(5);
  const [category,  setCategory]  = useState("hypoteka");
  const [subtype,   setSubtype]   = useState(0); // index within category
  const [showEarly, setShowEarly] = useState(false);
  const [earlyYear, setEarlyYear] = useState(15);

  // --- Derived ---
  const rate      = getBestRate(fix);
  const payment   = calcPmt(mortgage, rate, term);
  const totalPaid = payment * term * 12;
  const interest  = totalPaid - mortgage;
  const ltv       = Math.round((mortgage / property) * 100);
  const ownSources = Math.max(0, property - mortgage);

  // Amort stats
  const pivot    = Math.min(earlyYear, term - 1);
  const table    = buildAmortTable(mortgage, rate, term);
  const monthEnd = pivot * 12 - 1;
  const slice15  = monthEnd >= 0 && monthEnd < table.length
    ? table.slice(0, monthEnd + 1) : [];
  const paid15   = payment * (monthEnd + 1);
  const int15    = slice15.reduce((acc, r) => acc + r.interest, 0);
  const prin15   = paid15 - int15;
  const totalInt = table.reduce((acc, r) => acc + r.interest, 0);
  const intPct   = totalInt > 0 ? Math.round((int15 / totalInt) * 100) : 0;
  const saving   = totalInt - int15;

  // Ranked banks
  const rankedBanks = [...BANKS]
    .map((b) => ({ ...b, rate: b.rates[fix] ?? 9.99, monthly: calcPmt(mortgage, b.rates[fix] ?? 9.99, term) }))
    .sort((a, b) => a.monthly - b.monthly);

  // --- Chart ---
  const chartRef     = useRef(null);
  const chartInstRef = useRef(null);

  const buildChartData = useCallback(() => {
    const labels   = [];
    const debtData = [];
    const intData  = [];
    let cumInt = 0;
    for (let y = 1; y <= term; y++) {
      const sl = table.slice((y - 1) * 12, y * 12);
      cumInt += sl.reduce((acc, r) => acc + r.interest, 0);
      labels.push(`${y}r`);
      debtData.push(Math.max(0, table[y * 12 - 1]?.balance ?? 0));
      intData.push(cumInt);
    }

    const datasets = [
      {
        label: "Zbývající dluh",
        data: debtData,
        borderColor: "#60A5FA",
        backgroundColor: "rgba(96,165,250,0.06)",
        fill: true, tension: 0.4, borderWidth: 2,
        pointRadius: 0, pointHoverRadius: 5,
        pointBackgroundColor: "#60A5FA",
      },
      {
        label: "Kumulativní úroky",
        data: intData,
        borderColor: "#34D399",
        backgroundColor: "rgba(52,211,153,0.04)",
        fill: true, tension: 0.4, borderWidth: 2,
        borderDash: [6, 4],
        pointRadius: 0, pointHoverRadius: 5,
        pointBackgroundColor: "#34D399",
      },
    ];

    if (showEarly) {
      const ey = Math.min(earlyYear, term - 1);
      datasets.push({
        label: `Splacení v roce ${ey}`,
        data: debtData.map((v, i) => (i < ey ? v : null)),
        borderColor: "#F97316",
        backgroundColor: "transparent",
        fill: false, tension: 0.4, borderWidth: 2.5,
        borderDash: [4, 4],
        pointRadius: debtData.map((_, i) => (i === ey - 1 ? 7 : 0)),
        pointBackgroundColor: "#F97316",
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
      });
    }

    return { labels, datasets };
  }, [table, term, showEarly, earlyYear]);

  useEffect(() => {
    let Chart;
    import("chart.js").then((mod) => {
      const {
        Chart: ChartJS,
        LineElement, PointElement, LinearScale, CategoryScale,
        Filler, Tooltip, Legend,
      } = mod;
      ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend);
      Chart = ChartJS;

      const ctx = chartRef.current?.getContext("2d");
      if (!ctx) return;

      if (chartInstRef.current) {
        chartInstRef.current.data = buildChartData();
        chartInstRef.current.update("active");
        return;
      }

      chartInstRef.current = new Chart(ctx, {
        type: "line",
        data: buildChartData(),
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: {
              display: true,
              position: "top",
              labels: {
                font: { family: "Inter", size: 11 },
                color: "#64748B",
                boxWidth: 24, boxHeight: 2, padding: 18,
                usePointStyle: false,
              },
            },
            tooltip: {
              backgroundColor: "#0D1F4E",
              titleFont: { family: "Plus Jakarta Sans", size: 12, weight: "700" },
              bodyFont: { family: "Inter", size: 11 },
              padding: 12, cornerRadius: 10,
              callbacks: {
                label: (ctx) =>
                  ctx.raw == null ? null : ` ${ctx.dataset.label}: ${fmt(ctx.raw)} Kč`,
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              border: { display: false },
              ticks: { font: { family: "Inter", size: 11 }, color: "#94A3B8", maxTicksLimit: 10 },
            },
            y: {
              grid: { color: "rgba(0,0,0,0.04)" },
              border: { display: false },
              ticks: {
                font: { family: "Inter", size: 11 },
                color: "#94A3B8",
                callback: (v) =>
                  v >= 1e6 ? (v / 1e6).toFixed(1).replace(".0", "") + "M"
                  : v >= 1e3 ? (v / 1e3).toFixed(0) + "K" : v,
              },
            },
          },
        },
      });
    });

    return () => {
      if (chartInstRef.current) {
        chartInstRef.current.destroy();
        chartInstRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update chart data on any change
  useEffect(() => {
    if (!chartInstRef.current) return;
    chartInstRef.current.data = buildChartData();
    chartInstRef.current.update("active");
  }, [buildChartData]);

  // --- Handlers ---
  const handlePropertyChange = (val) => {
    const v = Math.min(50_000_000, Math.max(500_000, val));
    setProperty(v);
    if (mortgage > v * 0.95) setMortgage(Math.round(v * 0.95));
  };

  const handleMortgageChange = (val) => {
    setMortgage(Math.min(property, Math.max(100_000, val)));
  };

  const handleLtv = (pct) => {
    setMortgage(Math.round(property * pct / 100));
  };

  const handleTermChange = (val) => {
    setTerm(val);
    if (earlyYear >= val) setEarlyYear(val - 1);
  };

  const handleCategorySwitch = (cat) => {
    setCategory(cat);
    setSubtype(0);
  };

  // ================================================================
  // RENDER
  // ================================================================
  return (
    <>
      <div className={s.kalkulacka}>

        {/* Header */}
        <div className={s.modulHeader}>
          <p className={s.eyebrow}>Kalkulačka hypoték a úvěrů · 2026</p>
          <h1 className={s.title}>Spočítejte si splátku</h1>
          <p className={s.subtitle}>Zjistěte přesnou měsíční splátku a srovnejte aktuální nabídky bank.</p>
        </div>

        {/* Main grid */}
        <div className={s.mainGrid}>

          {/* ====== VSTUPNÍ PANEL ====== */}
          <div className={s.inputCard}>

            {/* Produktový selektor */}
            <div className={s.productSelector}>
              {/* Úroveň 1 */}
              <div className={s.catRow}>
                {Object.keys(PRODUCTS).map((cat) => (
                  <button
                    key={cat}
                    className={`${s.catBtn} ${category === cat ? s.catBtnActive : ""}`}
                    onClick={() => handleCategorySwitch(cat)}
                    type="button"
                  >
                    {cat === "hypoteka" ? "Hypotéka" : "Úvěry"}
                  </button>
                ))}
              </div>
              {/* Úroveň 2 */}
              <div className={s.subRow}>
                {PRODUCTS[category].map((label, i) => (
                  <button
                    key={i}
                    className={`${s.subBtn} ${subtype === i ? s.subBtnActive : ""}`}
                    onClick={() => setSubtype(i)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 1. Cena nemovitosti */}
            <div className={s.fieldSection}>
              <div className={s.fieldRow}>
                <span className={s.fieldLabel}>Cena nemovitosti</span>
                <div className={s.fieldValueWrap}>
                  <input
                    type="text"
                    className={s.fieldValueInput}
                    value={fmt(property)}
                    onChange={(e) => handlePropertyChange(parseCzk(e.target.value))}
                    onFocus={(e) => e.target.select()}
                    aria-label="Cena nemovitosti"
                  />
                  <span className={s.fieldUnit}>Kč</span>
                </div>
              </div>
              <Slider
                id="propertyRange"
                value={property} min={500_000} max={50_000_000} step={100_000}
                onChange={handlePropertyChange}
                limitLeft="500 tis. Kč" limitRight="50 mil. Kč"
              />
            </div>

            {/* 2. Výše hypotéky */}
            <div className={`${s.fieldSection} ${s.fieldSectionBorder}`}>
              <div className={s.fieldRow}>
                <span className={s.fieldLabel}>Výše hypotéky</span>
                <div className={s.fieldValueWrap}>
                  <input
                    type="text"
                    className={`${s.fieldValueInput} ${s.fieldValueAccent}`}
                    value={fmt(mortgage)}
                    onChange={(e) => handleMortgageChange(parseCzk(e.target.value))}
                    onFocus={(e) => e.target.select()}
                    aria-label="Výše hypotéky"
                  />
                  <span className={s.fieldUnit}>Kč</span>
                </div>
              </div>
              <Slider
                id="mortgageRange"
                value={mortgage} min={100_000} max={50_000_000} step={50_000}
                onChange={handleMortgageChange}
              />

              {/* LTV row */}
              <div className={s.ltvRow}>
                <span className={s.ltvLabel}>LTV:</span>
                <div className={s.ltvBtnGroup}>
                  {[90, 80, 70].map((p) => (
                    <button
                      key={p}
                      className={`${s.ltvBtn} ${ltv === p ? s.ltvBtnActive : ""}`}
                      onClick={() => handleLtv(p)}
                      type="button"
                    >
                      {p} %
                    </button>
                  ))}
                </div>
                <div className={s.ownChip}>
                  Vlastní zdroje: <strong>{fmt(ownSources)}</strong> Kč
                </div>
              </div>

              {/* LTV warning */}
              {ltv > 80 && (
                <div className={s.ltvWarning}>
                  <span>⚠️</span>
                  <span>LTV nad <strong>{ltv} %</strong> — většina bank požaduje pojištění nebo účtuje vyšší sazbu.</span>
                </div>
              )}
            </div>

            {/* 3. Splatnost + Fixace */}
            <div className={`${s.fieldSection} ${s.fieldSectionBorder}`}>
              <div className={s.bottomRow}>

                {/* Splatnost */}
                <div>
                  <div className={s.fieldRow}>
                    <span className={s.fieldLabel}>Splatnost</span>
                    <div className={s.fieldValueWrap}>
                      <span className={s.termVal}>{term}</span>
                      <span className={s.fieldUnit}>let</span>
                    </div>
                  </div>
                  <Slider
                    id="termRange"
                    value={term} min={5} max={30} step={1}
                    onChange={handleTermChange}
                    limitLeft="5 let" limitRight="30 let"
                  />
                </div>

                {/* Délka fixace */}
                <div>
                  <div className={s.fieldLabel} style={{ marginBottom: 10 }}>Délka fixace</div>
                  <div className={s.fixGroup}>
                    {[1, 3, 5, 7, 10].map((y) => (
                      <button
                        key={y}
                        className={`${s.fixBtn} ${fix === y ? s.fixBtnActive : ""}`}
                        onClick={() => setFix(y)}
                        type="button"
                      >
                        {y}
                      </button>
                    ))}
                  </div>
                  <div className={s.fixSublabel}>Roků fixní sazby</div>
                </div>

              </div>
            </div>

          </div>{/* /inputCard */}

          {/* ====== VÝSLEDKOVÝ PANEL ====== */}
          <div className={s.resultPanel}>
            <div className={s.resultCard}>
              <div className={s.rcInner}>

                <p className={s.rcEyebrow}>Odhadovaná měsíční splátka</p>
                <div className={s.rcAmount}>
                  {fmt(payment)}
                  <span className={s.rcAmountUnit}>Kč</span>
                </div>

                <div className={s.rcRatePill}>
                  <span className={s.rcRateDot} />
                  Úrok od <strong>{rate.toFixed(2).replace(".", ",")} %</strong> p.a.
                </div>

                <p className={s.rcDonutLabel}>Struktura celkových nákladů</p>
                <div className={s.rcDonutLayout}>
                  <DonutChart principal={mortgage} interest={interest} ltv={ltv} />
                  <div className={s.rcLegend}>
                    <div className={s.rcLegendRow}>
                      <div className={s.rcLegendHeader}>
                        <span className={s.rcLegendPip} style={{ background: "#60A5FA" }} />
                        <span className={s.rcLegendName}>Jistina</span>
                      </div>
                      <div className={s.rcLegendVal}>{fmt(mortgage)}</div>
                      <div className={s.rcLegendSub}>Kč</div>
                    </div>
                    <div className={s.rcLegendRow}>
                      <div className={s.rcLegendHeader}>
                        <span className={s.rcLegendPip} style={{ background: "#34D399" }} />
                        <span className={s.rcLegendName}>Celkem úroky</span>
                      </div>
                      <div className={s.rcLegendVal}>+ {fmt(interest)}</div>
                      <div className={s.rcLegendSub}>Kč</div>
                    </div>
                  </div>
                </div>

                <div className={s.rcTotal}>
                  <span className={s.rcTotalLabel}>Celkem zaplatíte bance</span>
                  <span className={s.rcTotalVal}>{fmt(totalPaid)} Kč</span>
                </div>

                <a href="#bankComparison" className={s.rcCta}>
                  Zobrazit nabídky bank →
                </a>

              </div>
            </div>
          </div>

        </div>{/* /mainGrid */}

        {/* ====== AMORTIZAČNÍ SEKCE ====== */}
        <div className={s.amortSection}>
          <div className={s.amortHeader}>
            <h2 className={s.amortTitle}>
              Kolik skutečně ušetříte předčasným splacením?
            </h2>
            <p className={s.amortSubtitle}>
              Anuitní hypotéka je nastavena tak, aby banka dostala největší část úroků v prvních
              letech. Po {pivot} letech dluh stále existuje, ale většinu úroků jste již zaplatili.
            </p>
          </div>

          {/* Stat boxes */}
          <div className={s.amortStats}>
            <div className={s.astat}>
              <p className={s.astatLabel}>Zaplaceno za prvních {pivot} let</p>
              <p className={s.astatVal}>{slice15.length ? fmt(paid15) : "—"} Kč</p>
              <p className={s.astatSub}>Z toho jistina: <strong>{slice15.length ? fmt(prin15) : "—"} Kč</strong></p>
            </div>
            <div className={`${s.astat} ${s.astatFeatured}`}>
              <p className={s.astatLabel}>Úroky zaplacené do roku {pivot}</p>
              <p className={s.astatVal}>{slice15.length ? fmt(int15) : "—"} Kč</p>
              <p className={s.astatSub}>= <strong>{slice15.length ? intPct : "—"} %</strong> z celkových úroků</p>
            </div>
            <div className={s.astat}>
              <p className={s.astatLabel}>Úspora při splacení v roce {pivot}</p>
              <p className={s.astatVal}>{slice15.length ? fmt(saving) : "—"} Kč</p>
              <p className={s.astatSub}>Zbývající nezaplacené úroky</p>
            </div>
          </div>

          {/* Toggle + year slider */}
          <div className={s.amortToggleRow}>
            <span className={s.amortToggleLabel}>Zobrazit v grafu:</span>
            <Toggle
              on={showEarly}
              onToggle={() => setShowEarly((v) => !v)}
              label="Předčasné splacení"
            />
          </div>

          {showEarly && (
            <div className={s.earlyYearRow}>
              <span className={s.earlyYearLabel}>Splatit po</span>
              <div className={s.earlySliderWrap}>
                <Slider
                  id="earlyYearRange"
                  value={earlyYear}
                  min={1}
                  max={term - 1}
                  step={1}
                  onChange={(v) => setEarlyYear(v)}
                />
              </div>
              <span className={s.earlyYearVal}>{earlyYear} letech</span>
            </div>
          )}

          {showEarly && (
            <div className={s.amortCallout}>
              💡 <strong>Klíčový poznatek:</strong> Splacením v roce {pivot} ušetříte pouze
              zbývající část úroků — větší část jste již zaplatili. Přesto může mít smysl,
              pokud ušetřené splátky reinvestujete.
            </div>
          )}

          <div className={s.chartWrap}>
            <canvas ref={chartRef} />
          </div>
        </div>

        {/* ====== SROVNÁNÍ BANK ====== */}
        <div className={s.banksSection} id="bankComparison">
          <div className={s.banksHeader}>
            <h2 className={s.banksTitle}>Aktuální srovnání trhu</h2>
            <p className={s.banksSubtitle}>
              Seřazeno od nejnižší splátky · fixace {fix} let
            </p>
          </div>
          <div className={s.banksGrid}>
            {rankedBanks.map((bank, i) => {
              const isTop = i === 0;
              const diff  = bank.monthly - rankedBanks[0].monthly;
              return (
                <div key={bank.id} className={`${s.bankCard} ${isTop ? s.bankCardTop : ""}`}>
                  {isTop && <span className={s.bankBestBadge}>Top volba</span>}
                  <div className={s.bankHeader}>
                    <div
                      className={s.bankAvatar}
                      style={{
                        background: bank.color,
                        color: bank.textColor ?? "#fff",
                      }}
                    >
                      {/* REPLACE: <img src={`/banks/${bank.id}.svg`} alt={bank.name} /> */}
                      {bank.abbr}
                    </div>
                    <div>
                      <p className={s.bankName}>{bank.name}</p>
                      <p className={s.bankRate}>
                        {bank.rate.toFixed(2).replace(".", ",")} % p.a.
                      </p>
                    </div>
                  </div>
                  <p className={s.bankPmtLabel}>Měsíční splátka</p>
                  <p className={s.bankPmtVal}>
                    {fmt(bank.monthly)} <span className={s.bankPmtUnit}>Kč</span>
                  </p>
                  <p className={`${s.bankDiff} ${diff < 1 ? s.bankDiffGreen : s.bankDiffOrange}`}>
                    {diff < 1 ? "✓ Nejlepší nabídka" : `+ ${fmt(diff)} Kč/měs.`}
                  </p>
                </div>
              );
            })}
          </div>
          <p className={s.disclaimer}>
            * Sazby jsou orientační. Přesná nabídka závisí na individuálním posouzení bankou,
            hodnotě nemovitosti a bonitě žadatele. {/* REPLACE: IČO, GDPR odkaz Aidvisora */}
          </p>
        </div>

      </div>

      {/* Mobilní floating bar */}
      <div className={s.mobileBar}>
        <div className={s.mobileBarInner}>
          <div>
            <p className={s.mobileBarLabel}>Měsíční splátka</p>
            <p className={s.mobileBarAmount}>{fmt(payment)} Kč</p>
          </div>
          <a href="#bankComparison" className={s.mobileBarBtn}>
            Srovnat banky →
          </a>
        </div>
      </div>
    </>
  );
}
