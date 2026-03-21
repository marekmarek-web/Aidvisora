"use client";

/**
 * ================================================================
 * InvesticniKalkulacka — Standalone React modul
 * ================================================================
 * Závislosti:
 *   npm install chart.js
 *
 * Fonty (layout.jsx):
 *   Inter + Plus Jakarta Sans (Google Fonts)
 *
 * Použití:
 *   import InvesticniKalkulacka from "@/components/InvesticniKalkulacka";
 *   <InvesticniKalkulacka />
 * ================================================================
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import s from "./invest.module.css";

// ================================================================
// DATA — profily investora
// ================================================================
const PROFILES = [
  {
    id: "konzervativni",
    label: "Konzervativní",
    rate: 5,
    color: "#3B82F6",
    description:
      "Stabilní zhodnocení s minimálním kolísáním. Ideální pro opatrné investory. Využívá dluhopisy a nemovitostní fondy.",
    composition: [
      { name: "Dluhopisy",          value: 70, color: "#3B82F6" },
      { name: "Nemovitostní fondy", value: 20, color: "#10B981" },
      { name: "Akcie",              value: 10, color: "#F59E0B" },
    ],
  },
  {
    id: "vyvazeny",
    label: "Vyvážený",
    rate: 7,
    color: "#8B5CF6",
    description:
      "Zlatá střední cesta. Kombinace stability dluhopisů, růstového potenciálu akcií a jistoty nemovitostních fondů.",
    composition: [
      { name: "Akcie (ETF)",        value: 50, color: "#F59E0B" },
      { name: "Dluhopisy",          value: 35, color: "#3B82F6" },
      { name: "Nemovitostní fondy", value: 15, color: "#10B981" },
    ],
  },
  {
    id: "dynamicky",
    label: "Dynamický",
    rate: 9,
    color: "#F59E0B",
    description:
      "Maximální potenciál výnosu. Strategie pro dlouhodobé cíle. Vyšší volatilita, vyšší potenciální výnos.",
    composition: [
      { name: "Globální akcie", value: 90, color: "#F59E0B" },
      { name: "Dluhopisy",      value: 10, color: "#3B82F6" },
    ],
  },
];

// Historická data pro backtest (zjednodušená — index bodů)
const HISTORICAL_DATA = [
  { date: "1995-01", sp500: 459,  gold: 380,  bonds: 100, re: 100 },
  { date: "1996-06", sp500: 670,  gold: 385,  bonds: 108, re: 106 },
  { date: "1998-01", sp500: 970,  gold: 290,  bonds: 115, re: 112 },
  { date: "1999-12", sp500: 1469, gold: 290,  bonds: 118, re: 120 },
  { date: "2001-09", sp500: 1040, gold: 290,  bonds: 125, re: 128 },
  { date: "2002-10", sp500: 776,  gold: 315,  bonds: 135, re: 132 },
  { date: "2004-01", sp500: 1130, gold: 410,  bonds: 138, re: 140 },
  { date: "2007-10", sp500: 1565, gold: 750,  bonds: 145, re: 155 },
  { date: "2008-09", sp500: 1100, gold: 830,  bonds: 148, re: 158 },
  { date: "2009-03", sp500: 676,  gold: 920,  bonds: 152, re: 156 },
  { date: "2010-06", sp500: 1030, gold: 1240, bonds: 158, re: 162 },
  { date: "2011-08", sp500: 1120, gold: 1820, bonds: 165, re: 168 },
  { date: "2013-01", sp500: 1498, gold: 1660, bonds: 170, re: 175 },
  { date: "2015-01", sp500: 2000, gold: 1280, bonds: 175, re: 185 },
  { date: "2018-09", sp500: 2900, gold: 1200, bonds: 178, re: 205 },
  { date: "2020-02", sp500: 3380, gold: 1550, bonds: 185, re: 215 },
  { date: "2020-03", sp500: 2300, gold: 1470, bonds: 180, re: 214 },
  { date: "2020-08", sp500: 3500, gold: 2060, bonds: 190, re: 218 },
  { date: "2021-12", sp500: 4766, gold: 1800, bonds: 185, re: 225 },
  { date: "2022-06", sp500: 3785, gold: 1810, bonds: 165, re: 228 },
  { date: "2022-10", sp500: 3580, gold: 1650, bonds: 155, re: 230 },
  { date: "2023-12", sp500: 4700, gold: 2040, bonds: 162, re: 245 },
  { date: "2024-04", sp500: 5200, gold: 2350, bonds: 164, re: 250 },
];

const FAQ_DATA = [
  { q: "Co je investiční kalkulačka a k čemu slouží?",
    a: "Kalkulačka slouží k orientačnímu výpočtu potenciální budoucí hodnoty vaší investice na základě zvolené strategie a investičního horizontu." },
  { q: "Jak kalkulačka počítá výnosy?",
    a: "Používá princip složeného úročení (compound interest) na základě průměrné roční výnosnosti p.a. při pravidelném měsíčním vkladu po celou dobu trvání investice." },
  { q: "Jsou uvedené výnosy garantované?",
    a: "Nejsou. Výsledky jsou pouze orientační projekce. Investování nese riziko a historické výnosy nezaručují výnosy budoucí." },
  { q: "Jaký je rozdíl mezi strategiemi?",
    a: "Konzervativní strategie preferuje stabilitu s nižším očekávaným výnosem (~5 % p.a.). Dynamická upřednostňuje růst s vyšším potenciálem (~9 % p.a.), ale i vyšším rizikem kolísání." },
  { q: "Je kalkulačka vhodná pro dlouhodobé investování?",
    a: "Ano, výpočty modelují horizonty 3–30 let, což odpovídá doporučením pro diverzifikovaná portfolia." },
];

// ================================================================
// HELPERS
// ================================================================
const GRAD_START = "#2563EB";
const GRAD_END   = "#38BDF8";
const TRACK_COL  = "#E2E8F0";

const fmt    = (n) => Math.round(n).toLocaleString("cs-CZ").replace(/[\u202F\u00A0]/g, "\u00A0");
const parseCz = (s) => parseInt(String(s).replace(/\s/g, "").replace(/[^\d]/g, "")) || 0;

function sliderBg(value, min, max) {
  const pct = (((value - min) / (max - min)) * 100).toFixed(1);
  return `linear-gradient(90deg, ${GRAD_START} 0%, ${GRAD_END} ${pct}%, ${TRACK_COL} ${pct}%)`;
}

/** Compound interest projection: year-by-year totals */
function calcProjection(initial, monthly, years, annualRate) {
  const labels    = ["Start"];
  const balances  = [initial];
  const invested  = [initial];
  let bal  = initial;
  let inv  = initial;
  for (let yr = 1; yr <= years; yr++) {
    for (let m = 0; m < 12; m++) {
      bal += bal * (annualRate / 100 / 12) + monthly;
      inv += monthly;
    }
    labels.push(`${yr}. rok`);
    balances.push(Math.round(bal));
    invested.push(Math.round(inv));
  }
  return { labels, balances, invested, finalBalance: bal, finalInvested: inv };
}

/** Build backtest series from HISTORICAL_DATA */
function calcBacktest(monthly, startYear) {
  const targetDate = new Date(`${startYear}-01-01`);
  let startIdx = HISTORICAL_DATA.findIndex((d) => new Date(d.date) >= targetDate);
  if (startIdx === -1) startIdx = 0;

  let accInvested = 0;
  let units = { sp500: 0, gold: 0, bonds: 0, re: 0 };
  const series = { invested: [], sp500: [], gold: [], bonds: [], re: [] };

  const getMonthsDiff = (d1, d2) => {
    const m = (d2.getFullYear() - d1.getFullYear()) * 12 - d1.getMonth() + d2.getMonth();
    return m <= 0 ? 1 : m;
  };

  for (let i = startIdx; i < HISTORICAL_DATA.length; i++) {
    const pt   = HISTORICAL_DATA[i];
    const curr = new Date(pt.date);
    const months = i > startIdx
      ? getMonthsDiff(new Date(HISTORICAL_DATA[i - 1].date), curr)
      : 1;
    const deposit = monthly * months;
    accInvested  += deposit;

    units.sp500  += deposit / pt.sp500;
    units.gold   += deposit / pt.gold;
    units.bonds  += deposit / pt.bonds;
    units.re     += deposit / pt.re;

    const ts = curr.getFullYear() + "-" + String(curr.getMonth() + 1).padStart(2, "0");
    series.invested.push({ x: ts, y: accInvested });
    series.sp500.push({ x: ts, y: Math.round(units.sp500 * pt.sp500) });
    series.gold.push({ x: ts, y: Math.round(units.gold * pt.gold) });
    series.bonds.push({ x: ts, y: Math.round(units.bonds * pt.bonds) });
    series.re.push({ x: ts, y: Math.round(units.re * pt.re) });
  }
  return series;
}

// ================================================================
// SUB-COMPONENTS
// ================================================================

function Slider({ id, value, min, max, step, onChange, limitLeft, limitRight }) {
  return (
    <div className={s.sliderOuter}>
      <div className={s.sliderWrap}>
        <input
          id={id} type="range"
          min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ background: sliderBg(value, min, max) }}
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

/** Inline editable number field with CZ formatting */
function NumField({ value, onChange, accent, ariaLabel }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState("");
  return editing ? (
    <input
      type="text"
      className={`${s.fieldValueInput} ${accent ? s.fieldValueAccent : ""}`}
      value={raw}
      autoFocus
      onChange={(e) => setRaw(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={() => { onChange(parseCz(raw)); setEditing(false); }}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
      aria-label={ariaLabel}
    />
  ) : (
    <span
      className={`${s.fieldValueInput} ${accent ? s.fieldValueAccent : ""}`}
      onClick={() => { setEditing(true); setRaw(String(Math.round(value))); }}
      role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") { setEditing(true); setRaw(String(Math.round(value))); }}}
      title="Klikněte pro úpravu"
    >
      {fmt(value)}
    </span>
  );
}

/** Donut chart — pure SVG, no library */
function DonutChart({ composition }) {
  const CIRC = 2 * Math.PI * 40; // r=40
  let offset = 0;
  const slices = composition.map((item) => {
    const len    = (item.value / 100) * CIRC;
    const slice  = { ...item, len, offset };
    offset += len;
    return slice;
  });
  return (
    <svg width={112} height={112} viewBox="0 0 112 112">
      <circle cx={56} cy={56} r={40} fill="none" stroke="#F1F4FB" strokeWidth={14} />
      {slices.map((sl, i) => (
        <circle key={i} cx={56} cy={56} r={40}
          fill="none"
          stroke={sl.color}
          strokeWidth={14}
          strokeDasharray={`${sl.len.toFixed(2)} ${CIRC.toFixed(2)}`}
          strokeDashoffset={`${(-sl.offset).toFixed(2)}`}
          strokeLinecap="butt"
          transform="rotate(-90 56 56)"
          style={{ transition: "stroke-dasharray 0.45s ease, stroke-dashoffset 0.45s ease" }}
        />
      ))}
    </svg>
  );
}

/** Accordion FAQ item */
function FaqItem({ question, answer }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`${s.faqItem} ${open ? s.faqItemOpen : ""}`}>
      <button className={s.faqQ} onClick={() => setOpen((v) => !v)} type="button">
        <span>{question}</span>
        <span className={`${s.faqChevron} ${open ? s.faqChevronOpen : ""}`}>▾</span>
      </button>
      {open && <p className={s.faqA}>{answer}</p>}
    </div>
  );
}

// ================================================================
// MAIN COMPONENT
// ================================================================
export default function InvesticniKalkulacka() {
  const [initial,    setInitial]    = useState(100_000);
  const [monthly,    setMonthly]    = useState(5_000);
  const [years,      setYears]      = useState(10);
  const [profileIdx, setProfileIdx] = useState(1);   // 0=konzervativni, 1=vyvazeny, 2=dynamicky
  const [startYear,  setStartYear]  = useState(1995);

  const profile = PROFILES[profileIdx];

  // Derived calculations (memo — only recompute when inputs change)
  const projection = useMemo(
    () => calcProjection(initial, monthly, years, profile.rate),
    [initial, monthly, years, profile.rate]
  );

  const { finalBalance, finalInvested } = projection;
  const gain        = finalBalance - finalInvested;
  const gainPct     = finalInvested > 0 ? ((gain / finalInvested) * 100) : 0;

  const backtestSeries = useMemo(
    () => calcBacktest(monthly, startYear),
    [monthly, startYear]
  );

  // ----------------------------------------------------------------
  // Chart refs
  // ----------------------------------------------------------------
  const growthCanvasRef   = useRef(null);
  const allocCanvasRef    = useRef(null);
  const backtestCanvasRef = useRef(null);
  const growthInst        = useRef(null);
  const allocInst         = useRef(null);
  const backtestInst      = useRef(null);

  const CRISIS_ANNOTATIONS = [
    { x: "2000-03", label: "Dot-com" },
    { x: "2008-09", label: "Krize 2008" },
    { x: "2020-03", label: "COVID-19" },
    { x: "2022-02", label: "Válka/Inflace" },
  ];

  // Build chart data
  const buildGrowthData = useCallback(() => ({
    labels: projection.labels,
    datasets: [
      {
        label: "Celková hodnota",
        data: projection.balances,
        borderColor: profile.color,
        backgroundColor: profile.color + "18",
        borderWidth: 2.5, fill: true, tension: 0.4,
        pointRadius: 0, pointHoverRadius: 5,
      },
      {
        label: "Váš vklad",
        data: projection.invested,
        borderColor: "#CBD5E1",
        borderWidth: 2, borderDash: [5, 5], fill: false, tension: 0.4,
        pointRadius: 0, pointHoverRadius: 5,
      },
    ],
  }), [projection, profile.color]);

  const buildAllocData = useCallback(() => ({
    labels: profile.composition.map((c) => c.name),
    datasets: [{
      data: profile.composition.map((c) => c.value),
      backgroundColor: profile.composition.map((c) => c.color),
      borderWidth: 0, hoverOffset: 4,
    }],
  }), [profile.composition]);

  const buildBacktestData = useCallback(() => {
    const labels = backtestSeries.invested.map((p) => p.x);
    return {
      labels,
      datasets: [
        { label: "Vloženo celkem",     data: backtestSeries.invested.map(p=>p.y), borderColor: "#94A3B8", borderWidth:1.5, borderDash:[4,4], fill:false, tension:0.4, pointRadius:0 },
        { label: "S&P 500",            data: backtestSeries.sp500.map(p=>p.y),    borderColor: "#2563EB", backgroundColor:"rgba(37,99,235,0.07)", borderWidth:2, fill:true, tension:0.4, pointRadius:0 },
        { label: "Zlato",              data: backtestSeries.gold.map(p=>p.y),     borderColor: "#F59E0B", borderWidth:1.5, fill:false, tension:0.4, pointRadius:0 },
        { label: "Dluhopisy",          data: backtestSeries.bonds.map(p=>p.y),    borderColor: "#8B5CF6", borderWidth:1.5, fill:false, tension:0.4, pointRadius:0 },
        { label: "Nemovitostní fondy", data: backtestSeries.re.map(p=>p.y),       borderColor: "#10B981", borderWidth:1.5, fill:false, tension:0.4, pointRadius:0 },
      ],
    };
  }, [backtestSeries]);

  // Chart options
  const chartOptions = useCallback((yLabel = false) => ({
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: true, position: "top", labels: { font: { family: "Inter", size: 11 }, color: "#64748B", boxWidth: 20, boxHeight: 2, padding: 16 } },
      tooltip: {
        backgroundColor: "#0D1F4E",
        titleFont: { family: "Plus Jakarta Sans", size: 12, weight: "700" },
        bodyFont: { family: "Inter", size: 11 },
        padding: 12, cornerRadius: 10,
        callbacks: { label: (c) => c.raw == null ? null : ` ${c.dataset.label}: ${fmt(c.raw)} Kč` },
      },
    },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { font: { family: "Inter", size: 11 }, color: "#94A3B8", maxTicksLimit: 8 } },
      y: {
        grid: { color: "rgba(0,0,0,0.04)" }, border: { display: false },
        ticks: {
          font: { family: "Inter", size: 11 }, color: "#94A3B8",
          callback: (v) => v >= 1e6 ? (v/1e6).toFixed(1).replace(".0","")+"M" : v >= 1e3 ? (v/1e3).toFixed(0)+"K" : v,
        },
      },
    },
  }), []);

  // Init + update charts
  useEffect(() => {
    let ChartJS;
    import("chart.js").then((mod) => {
      const { Chart, LineElement, PointElement, LinearScale, CategoryScale,
              ArcElement, DoughnutController, LineController, Filler, Tooltip, Legend } = mod;
      Chart.register(LineElement, PointElement, LinearScale, CategoryScale,
        ArcElement, DoughnutController, LineController, Filler, Tooltip, Legend);
      ChartJS = Chart;

      // Growth chart
      if (growthCanvasRef.current) {
        if (growthInst.current) { growthInst.current.destroy(); }
        growthInst.current = new Chart(growthCanvasRef.current.getContext("2d"), {
          type: "line", data: buildGrowthData(), options: chartOptions(),
        });
      }

      // Allocation donut
      if (allocCanvasRef.current) {
        if (allocInst.current) { allocInst.current.destroy(); }
        allocInst.current = new Chart(allocCanvasRef.current.getContext("2d"), {
          type: "doughnut",
          data: buildAllocData(),
          options: { responsive: true, maintainAspectRatio: false, cutout: "68%",
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${c.label}: ${c.parsed}%` } } } },
        });
      }

      // Backtest chart
      if (backtestCanvasRef.current) {
        if (backtestInst.current) { backtestInst.current.destroy(); }
        backtestInst.current = new Chart(backtestCanvasRef.current.getContext("2d"), {
          type: "line", data: buildBacktestData(), options: chartOptions(),
        });
      }
    });

    return () => {
      growthInst.current?.destroy();
      allocInst.current?.destroy();
      backtestInst.current?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update chart data on any state change
  useEffect(() => {
    if (growthInst.current) {
      growthInst.current.data = buildGrowthData();
      growthInst.current.update("active");
    }
    if (allocInst.current) {
      allocInst.current.data = buildAllocData();
      allocInst.current.update("active");
    }
    if (backtestInst.current) {
      backtestInst.current.data = buildBacktestData();
      backtestInst.current.update("active");
    }
  }, [buildGrowthData, buildAllocData, buildBacktestData]);

  // ================================================================
  // RENDER
  // ================================================================
  return (
    <div className={s.kalkulacka}>

      {/* Header */}
      <div className={s.modulHeader}>
        <p className={s.eyebrow}>Investiční kalkulačka · 2026</p>
        <h1 className={s.title}>Spočítejte si hodnotu investice</h1>
        <p className={s.subtitle}>
          Zjistěte, jak vaše investice poroste v čase při zvoleném profilu a pravidelném vkladu.
        </p>
      </div>

      {/* ====== HLAVNÍ GRID: vstupy | výsledky ====== */}
      <div className={s.mainGrid}>

        {/* -------- VSTUPNÍ PANEL -------- */}
        <div className={s.inputCard}>

          {/* Profil investora — 3 velké karty */}
          <div className={s.profileSection}>
            <p className={s.sectionLabel}>Profil investora</p>
            <div className={s.profileGrid}>
              {PROFILES.map((p, i) => (
                <button
                  key={p.id}
                  className={`${s.profileCard} ${profileIdx === i ? s.profileCardActive : ""}`}
                  onClick={() => setProfileIdx(i)}
                  type="button"
                  style={profileIdx === i ? { "--pc": p.color } : {}}
                >
                  <span className={s.profileCardRate}
                    style={{ color: profileIdx === i ? p.color : undefined }}>
                    {p.rate} % p.a.
                  </span>
                  <span className={s.profileCardLabel}>{p.label}</span>
                  {profileIdx === i && (
                    <span className={s.profileCardCheck}>✓</span>
                  )}
                </button>
              ))}
            </div>

            {/* Popis profilu */}
            <div className={s.profileDesc}>
              <span className={s.profileDescIcon} style={{ background: profile.color + "22", color: profile.color }}>ℹ</span>
              <div>
                <strong className={s.profileDescName}>{profile.label} investor</strong>
                <p className={s.profileDescText}>{profile.description}</p>
              </div>
            </div>
          </div>

          {/* Počáteční vklad */}
          <div className={s.fieldSection}>
            <div className={s.fieldRow}>
              <span className={s.fieldLabel}>Počáteční vklad</span>
              <div className={s.fieldValueWrap}>
                <NumField value={initial} onChange={setInitial} ariaLabel="Počáteční vklad" />
                <span className={s.fieldUnit}>Kč</span>
              </div>
            </div>
            <Slider id="initialRange" value={initial} min={0} max={5_000_000} step={10_000}
              onChange={setInitial} limitLeft="0 Kč" limitRight="5 mil. Kč" />
          </div>

          {/* Měsíční investice */}
          <div className={`${s.fieldSection} ${s.fieldBorder}`}>
            <div className={s.fieldRow}>
              <span className={s.fieldLabel}>Měsíční investice</span>
              <div className={s.fieldValueWrap}>
                <NumField value={monthly} onChange={setMonthly} accent ariaLabel="Měsíční investice" />
                <span className={s.fieldUnit}>Kč</span>
              </div>
            </div>
            <Slider id="monthlyRange" value={monthly} min={500} max={50_000} step={500}
              onChange={setMonthly} limitLeft="500 Kč" limitRight="50 tis." />
          </div>

          {/* Doba investice */}
          <div className={`${s.fieldSection} ${s.fieldBorder}`}>
            <div className={s.fieldRow}>
              <span className={s.fieldLabel}>Doba investice</span>
              <div className={s.fieldValueWrap}>
                <span className={s.termVal}>{years}</span>
                <span className={s.fieldUnit}>let</span>
              </div>
            </div>
            <Slider id="yearsRange" value={years} min={3} max={30} step={1}
              onChange={setYears} limitLeft="3 roky" limitRight="30 let" />
          </div>

        </div>{/* /inputCard */}

        {/* -------- VÝSLEDKOVÝ PANEL -------- */}
        <div className={s.resultPanel}>
          <div className={s.resultCard}>
            <div className={s.rcInner}>

              <p className={s.rcEyebrow}>Předpokládaná hodnota investice</p>
              <div className={s.rcAmount}>
                {fmt(finalBalance)}
                <span className={s.rcAmountUnit}>Kč</span>
              </div>

              <div className={s.rcRows}>
                <div className={s.rcRow}>
                  <span className={s.rcRowLabel}>Váš vklad</span>
                  <span className={s.rcRowVal}>{fmt(finalInvested)} Kč</span>
                </div>
                <div className={s.rcRow}>
                  <span className={s.rcRowLabel}>Zisk z investice</span>
                  <span className={`${s.rcRowVal} ${s.rcRowGreen}`}>+ {fmt(gain)} Kč</span>
                </div>
                <div className={`${s.rcRow} ${s.rcRowLast}`}>
                  <span className={s.rcRowLabel}>Zhodnocení</span>
                  <span className={`${s.rcRowVal} ${s.rcRowGold}`}>
                    + {gainPct.toFixed(1).replace(".", ",")} %
                  </span>
                </div>
              </div>

              <p className={s.rcDisclaimer}>
                Výsledky vycházejí z modelového výpočtu. Historické výnosy nejsou zárukou budoucích.
              </p>

              {/* CTA */}
              <button className={s.rcCta} type="button">
                Chci investiční plán →
              </button>

            </div>
          </div>
        </div>

      </div>{/* /mainGrid */}

      {/* ====== GRAFY: projekce + složení portfolia ====== */}
      <div className={s.chartsGrid}>

        {/* Projekce vývoje */}
        <div className={s.chartCard}>
          <div className={s.chartCardHeader}>
            <h2 className={s.chartCardTitle}>Projekce vývoje</h2>
            <p className={s.chartCardSub}>Odhadovaný vývoj hodnoty při pravidelném investování</p>
          </div>
          <div className={s.chartWrap}>
            <canvas ref={growthCanvasRef} />
          </div>
        </div>

        {/* Složení portfolia */}
        <div className={s.chartCard}>
          <div className={s.chartCardHeader}>
            <h2 className={s.chartCardTitle}>Složení portfolia</h2>
            <p className={s.chartCardSub}>{profile.label} strategie · {profile.rate} % p.a.</p>
          </div>
          <div className={s.allocLayout}>
            {/* SVG donut — žádný Canvas, žádná závislost */}
            <div className={s.allocDonutWrap}>
              <DonutChart composition={profile.composition} />
            </div>
            <div className={s.allocLegend}>
              {profile.composition.map((item, i) => (
                <div key={i} className={s.allocLegendRow}>
                  <span className={s.allocLegendPip} style={{ background: item.color }} />
                  <span className={s.allocLegendName}>{item.name}</span>
                  <span className={s.allocLegendVal}>{item.value} %</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* ====== HISTORICKÝ BACKTEST ====== */}
      <div className={s.backtestCard}>
        <div className={s.backtestHeader}>
          <div>
            <h2 className={s.backtestTitle}>Historický backtest</h2>
            <p className={s.backtestSub}>
              Jak by si vaše investice {fmt(monthly)}&nbsp;Kč/měs. vedla od roku {startYear}
              v různých třídách aktiv?
            </p>
          </div>
          <div className={s.startYearControl}>
            <label className={s.startYearLabel}>Začátek od roku</label>
            <Slider id="startYearRange" value={startYear} min={1995} max={2020} step={1}
              onChange={setStartYear} limitLeft="1995" limitRight="2020" />
            <span className={s.startYearVal}>{startYear}</span>
          </div>
        </div>

        {/* Annotation labels (krize) */}
        <div className={s.crisisLabels}>
          {CRISIS_ANNOTATIONS.map((a) => (
            <span key={a.x} className={s.crisisChip}>{a.label}</span>
          ))}
        </div>

        <div className={s.backtestChartWrap}>
          <canvas ref={backtestCanvasRef} />
        </div>
        <p className={s.backtestDisclaimer}>
          * Historická výkonnost nezaručuje budoucí výsledky. Data jsou ilustrativní. Hodnoty v CZK (přepočet není proveden).
        </p>
      </div>

      {/* ====== FAQ ====== */}
      <div className={s.faqSection}>
        <div className={s.faqHeader}>
          <h2 className={s.faqTitle}>Časté dotazy</h2>
          <p className={s.faqSub}>Vše, co potřebujete vědět o investiční kalkulačce</p>
        </div>
        <div className={s.faqList}>
          {FAQ_DATA.map((item, i) => (
            <FaqItem key={i} question={item.q} answer={item.a} />
          ))}
        </div>
      </div>

    </div>
  );
}
