"use client";

/**
 * ================================================================
 * ZivotniKalkulacka — Standalone React modul
 * ================================================================
 * Závislosti: žádné (bez Chart.js — graf je čistý SVG/CSS)
 *
 * Fonty (layout.jsx):
 *   Inter + Plus Jakarta Sans (Google Fonts)
 *
 * Použití:
 *   import ZivotniKalkulacka from "@/components/ZivotniKalkulacka";
 *   <ZivotniKalkulacka />
 * ================================================================
 */

import { useState, useMemo } from "react";
import s from "./zivotni.module.css";

// ================================================================
// CONSTANTS
// ================================================================
const GRAD_START = "#2563EB";
const GRAD_END   = "#38BDF8";
const TRACK_COL  = "#E2E8F0";

const FAQ_DATA = [
  { q: "Co kalkulačka počítá?",
    a: "Orientační doporučení minimálního krytí čtyř klíčových rizik: smrt, invalidita III. stupně, pracovní neschopnost a trvalé následky úrazu. Výpočet vychází z metodiky EFPA a principu 6% rentiéra." },
  { q: "Co je 6% Rentiér?",
    a: "Pojistná částka se zainvestuje s výnosem 6 % p.a., čímž generuje rentu nahrazující výpadek příjmu. Například 1 mil. Kč = 60 000 Kč/rok = 5 000 Kč/měs. na dobu neurčitou." },
  { q: "Jak se počítá nemocenská od státu?",
    a: "Nemocenská se počítá ze tří redukčních hranic denního vyměřovacího základu — 90 %, 60 % a 30 %. Výsledná denní dávka pak tvoří přibližně 60–70 % z redukovaného základu. Kalkulačka toto počítá automaticky." },
  { q: "Proč je doporučení klesající do 65 let?",
    a: "S přibývajícím věkem klesá počet ekonomicky aktivních let, závazky se splácejí a děti jsou samostatné. Klesající pojistná částka odpovídá skutečné potřebě ochrany v čase." },
  { q: "Jsou výsledky závazné?",
    a: "Ne, jde o orientační výpočet. Finální nastavení pojistky závisí na zdravotním stavu, profesních rizicích a individuálních preferencích — to vše se řeší při osobní konzultaci." },
  { q: "Co je EUCS?",
    a: "Právní ochrana EUCS zajišťuje, že vám pojišťovna vyplatí maximální plnění při pojistné události. Doporučuje se jako doplněk ke každé smlouvě za 49 Kč/os. nebo 149 Kč/rodina měsíčně." },
];

// ================================================================
// MATH HELPERS
// ================================================================
const fmt    = (n) => Math.round(n).toLocaleString("cs-CZ").replace(/[\u202F\u00A0]/g, "\u00A0");
const parseCz = (s) => parseInt(String(s).replace(/\s/g, "").replace(/[^\d]/g, "")) || 0;
const round10k = (n) => Math.round(n / 10000) * 10000;

function sliderBg(value, min, max) {
  const pct = (((value - min) / (max - min)) * 100).toFixed(1);
  return `linear-gradient(90deg, ${GRAD_START} 0%, ${GRAD_END} ${pct}%, ${TRACK_COL} ${pct}%)`;
}

/** Nemocenská od státu (měsíčně) z čistého příjmu */
function calcSicknessBenefit(netIncome) {
  const grossIncome = Math.round(netIncome / 0.74);
  const rh1 = 1466, rh2 = 2199, rh3 = 4397;
  const dailyGross = (grossIncome * 12) / 365;
  let reduced = 0;
  if (dailyGross <= rh1)      reduced = dailyGross * 0.9;
  else if (dailyGross <= rh2) reduced = rh1 * 0.9 + (dailyGross - rh1) * 0.6;
  else if (dailyGross <= rh3) reduced = rh1 * 0.9 + (rh2 - rh1) * 0.6 + (dailyGross - rh2) * 0.3;
  else                        reduced = rh1 * 0.9 + (rh2 - rh1) * 0.6 + (rh3 - rh2) * 0.3;
  return Math.round(reduced * 0.66 * 30);
}

/** Současná hodnota anuity: kapitál potřebný ke krytí měsíční mezery */
function calcCapitalNeeded(monthlyGap, years) {
  if (monthlyGap <= 0 || years <= 0) return 0;
  const rate = 0.06;
  const pv = (monthlyGap * 12) * ((1 - Math.pow(1 + rate, -years)) / rate);
  return Math.round(pv);
}

/** Hlavní výpočet — všechna čtyři rizika */
function runCalculations({ age, netIncome, expenses, liabilities, reserves, children, hasSpouse }) {
  const yearsToRetirement  = Math.max(0, 65 - age);
  const targetIncome = Math.max(expenses, netIncome);
  const grossIncome  = Math.round(netIncome / 0.74);

  // --- PN (Pracovní neschopnost) ---
  const stateSickMonthly = calcSicknessBenefit(netIncome);
  const pnGapMonthly     = Math.max(0, netIncome - stateSickMonthly);
  const pnDailyNeed      = Math.ceil((pnGapMonthly / 30) / 100) * 100;

  // --- Invalidita D3 ---
  let pensionD3 = 0;
  if      (netIncome < 20_000) pensionD3 = netIncome * 0.85;
  else if (netIncome < 40_000) pensionD3 = netIncome * 0.55;
  else if (netIncome < 80_000) pensionD3 = 22_000 + (netIncome - 40_000) * 0.15;
  else                         pensionD3 = 25_000 + (netIncome - 100_000) * 0.1;

  const gapD3      = Math.max(0, targetIncome - pensionD3);
  const capitalD3  = round10k(Math.max(0, calcCapitalNeeded(gapD3, yearsToRetirement) - reserves));

  // --- Smrt ---
  const survivorState = (hasSpouse || children > 0) ? 10_000 : 0;
  let capitalDeathIncome = 0;
  if (hasSpouse || children > 0) {
    const deathGap = Math.max(0, targetIncome - survivorState);
    capitalDeathIncome = calcCapitalNeeded(deathGap, yearsToRetirement);
  }
  let spouseLump   = 0;
  if (hasSpouse) spouseLump = age < 40 ? 4_000_000 : age < 50 ? 2_000_000 : 1_000_000;
  let childrenLump = 0;
  if (children > 0) {
    const perChild = age < 50 ? 1_000_000 : age < 60 ? 500_000 : 0;
    childrenLump   = children * perChild;
  }
  const familyProtection = Math.max(capitalDeathIncome, spouseLump + childrenLump);
  let deathCoverageRaw   = Math.max(0, liabilities + familyProtection - reserves);
  if (children === 0 && !hasSpouse && liabilities === 0) deathCoverageRaw = 0;
  const deathCoverage    = round10k(deathCoverageRaw);

  // --- Trvalé následky ---
  const tnBase        = netIncome > 100_000 ? 3_000_000 : netIncome > 30_000 ? 2_000_000 : 1_000_000;
  const tnProgression = tnBase * 10;

  return {
    deathCoverage, capitalD3, pnDailyNeed, tnBase, tnProgression,
    // Pro graf
    stateSickMonthly, pnGapMonthly, pensionD3,
    gapD3, targetIncome, netIncome,
  };
}

// ================================================================
// SUB-COMPONENTS
// ================================================================

/** Slider — stejný jako v hypoteční a investiční kalkulačce */
function Slider({ id, value, min, max, step, onChange, limitLeft, limitRight }) {
  return (
    <div className={s.sliderOuter}>
      <div className={s.sliderWrap}>
        <input id={id} type="range" min={min} max={max} step={step} value={value}
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

/** Vstupní pole s Kč — slider + kliknutelná hodnota */
function FieldKc({ label, id, value, min, max, step, onChange, limitLeft, limitRight, warning }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw]         = useState("");

  return (
    <div className={s.fieldSection}>
      <div className={s.fieldRow}>
        <span className={s.fieldLabel}>{label}</span>
        <div className={s.fieldValueWrap}>
          {editing ? (
            <input type="text" className={`${s.fieldValueInput} ${s.fieldValueAccent}`}
              value={raw} autoFocus
              onChange={(e) => setRaw(e.target.value)}
              onFocus={(e) => e.target.select()}
              onBlur={() => { onChange(parseCz(raw)); setEditing(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
              aria-label={label}
            />
          ) : (
            <span className={`${s.fieldValueInput} ${s.fieldValueAccent}`}
              onClick={() => { setEditing(true); setRaw(String(value)); }}
              role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter") { setEditing(true); setRaw(String(value)); }}}
              title="Klikněte pro úpravu"
            >{fmt(value)}</span>
          )}
          <span className={s.fieldUnit}>Kč</span>
        </div>
      </div>
      {warning && <div className={s.fieldWarning}>{warning}</div>}
      <Slider id={id} value={value} min={min} max={max} step={step}
        onChange={onChange} limitLeft={limitLeft} limitRight={limitRight} />
    </div>
  );
}

/** Horizontální sloupcový graf PN / Invalidita */
function RiskBarChart({ stateSickMonthly, pnGapMonthly, pensionD3, gapD3, netIncome }) {
  const maxVal = Math.max(netIncome, stateSickMonthly + pnGapMonthly, pensionD3 + gapD3, 1);

  const bars = [
    {
      label: "PN (pracovní neschopnost)",
      state: stateSickMonthly,
      gap:   pnGapMonthly,
      total: netIncome,
    },
    {
      label: "Invalidita III. stupně",
      state: pensionD3,
      gap:   gapD3,
      total: netIncome,
    },
  ];

  return (
    <div className={s.barChart}>
      {bars.map((b, i) => (
        <div key={i} className={s.barGroup}>
          <div className={s.barLabel}>{b.label}</div>
          {/* Příjem referenční čára */}
          <div className={s.barTrack}>
            {/* Státní dávka */}
            <div className={s.barState}
              style={{ width: `${(b.state / maxVal * 100).toFixed(1)}%` }} />
            {/* Mezera */}
            <div className={s.barGap}
              style={{ width: `${(b.gap / maxVal * 100).toFixed(1)}%` }} />
          </div>
          <div className={s.barMeta}>
            <span className={s.barMetaState}>Stát: {fmt(b.state)} Kč/měs.</span>
            {b.gap > 0 && (
              <span className={s.barMetaGap}>Chybí: {fmt(b.gap)} Kč/měs.</span>
            )}
          </div>
        </div>
      ))}
      <div className={s.barLegend}>
        <span className={s.barLegendState}>■ Státní dávka</span>
        <span className={s.barLegendGap}>■ Finanční mezera</span>
      </div>
    </div>
  );
}

/** Výsledkový řádek v dark kartě */
function ResultRow({ icon, title, sub, value, unit, highlight, badge }) {
  return (
    <div className={s.resultRow}>
      <div className={s.resultRowLeft}>
        <div className={s.resultRowIcon}>{icon}</div>
        <div>
          <div className={s.resultRowTitle}>{title}</div>
          {sub && <div className={s.resultRowSub}>{sub}</div>}
        </div>
      </div>
      <div className={s.resultRowRight}>
        <div className={`${s.resultRowVal} ${highlight ? s.resultRowValGold : ""}`}>
          {value}
        </div>
        <div className={s.resultRowUnit}>{unit}</div>
        {badge && <div className={s.resultRowBadge}>{badge}</div>}
      </div>
    </div>
  );
}

/** FAQ accordion */
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
export default function ZivotniKalkulacka() {
  const [age,       setAge]       = useState(30);
  const [netIncome, setNetIncome] = useState(30_000);
  const [expenses,  setExpenses]  = useState(20_000);
  const [liabilities, setLiabilities] = useState(2_000_000);
  const [reserves,  setReserves]  = useState(100_000);
  const [children,  setChildren]  = useState(2);
  const [hasSpouse, setHasSpouse] = useState(true);

  const results = useMemo(() => runCalculations({
    age, netIncome, expenses, liabilities, reserves, children, hasSpouse,
  }), [age, netIncome, expenses, liabilities, reserves, children, hasSpouse]);

  const expensesWarning = expenses > netIncome
    ? "Výdaje přesahují příjem — zkontrolujte hodnoty."
    : null;

  // ================================================================
  // RENDER
  // ================================================================
  return (
    <div className={s.kalkulacka}>

      {/* Header */}
      <div className={s.modulHeader}>
        <p className={s.eyebrow}>Kalkulačka životního pojištění · Metodika EFPA</p>
        <h1 className={s.title}>Zjistěte, jak jste pojistně zajištěni</h1>
        <p className={s.subtitle}>
          Výpočet doporučeného minimálního krytí pro smrt, invaliditu, pracovní neschopnost
          a trvalé následky. Bez registrace, zcela anonymně.
        </p>
      </div>

      {/* Info banner */}
      <div className={s.infoBanner}>
        <span className={s.infoIcon}>ℹ</span>
        <p className={s.infoText}>
          Kalkulačka slouží k orientačnímu výpočtu. Každá situace je individuální —
          finální nastavení pojistky vždy probereme osobně nebo online.
        </p>
      </div>

      {/* ====== HLAVNÍ GRID ====== */}
      <div className={s.mainGrid}>

        {/* -------- VSTUPNÍ PANEL -------- */}
        <div className={s.inputCol}>

          {/* Karta 1: Vaše údaje */}
          <div className={s.inputCard}>
            <p className={s.cardSectionLabel}>Vaše údaje</p>

            {/* Věk */}
            <div className={s.fieldSection}>
              <div className={s.fieldRow}>
                <span className={s.fieldLabel}>Věk</span>
                <div className={s.fieldValueWrap}>
                  <span className={s.fieldValueInput} style={{ color: "var(--navy)" }}>
                    {age}
                  </span>
                  <span className={s.fieldUnit}>let</span>
                </div>
              </div>
              <Slider id="age" value={age} min={18} max={64} step={1}
                onChange={setAge} limitLeft="18 let" limitRight="64 let" />
            </div>

            {/* Čistý příjem */}
            <FieldKc label="Čistý měsíční příjem" id="income"
              value={netIncome} min={15_000} max={250_000} step={1_000}
              onChange={(v) => setNetIncome(Math.min(250_000, Math.max(15_000, v)))}
              limitLeft="15 tis. Kč" limitRight="250 tis. Kč" />

            {/* Výdaje */}
            <FieldKc label="Měsíční výdaje domácnosti" id="expenses"
              value={expenses} min={5_000} max={200_000} step={1_000}
              onChange={(v) => setExpenses(Math.min(200_000, Math.max(5_000, v)))}
              limitLeft="5 tis. Kč" limitRight="200 tis. Kč"
              warning={expensesWarning} />
          </div>

          {/* Karta 2: Majetek a rodina */}
          <div className={s.inputCard}>
            <p className={s.cardSectionLabel}>Majetek a rodina</p>

            {/* Závazky */}
            <FieldKc label="Závazky (hypotéka, půjčky)" id="liabilities"
              value={liabilities} min={0} max={20_000_000} step={100_000}
              onChange={(v) => setLiabilities(Math.min(20_000_000, Math.max(0, v)))}
              limitLeft="0 Kč" limitRight="20 mil. Kč" />

            {/* Rezervy */}
            <FieldKc label="Finanční rezervy" id="reserves"
              value={reserves} min={0} max={5_000_000} step={10_000}
              onChange={(v) => setReserves(Math.min(5_000_000, Math.max(0, v)))}
              limitLeft="0 Kč" limitRight="5 mil. Kč" />

            {/* Děti + Manžel/ka */}
            <div className={`${s.fieldSection} ${s.familyRow}`}>
              <div>
                <label className={s.fieldLabel} htmlFor="children">Počet dětí</label>
                <div className={s.childrenControl}>
                  <button className={s.stepBtn} type="button"
                    onClick={() => setChildren((v) => Math.max(0, v - 1))}>−</button>
                  <span className={s.childrenVal}>{children}</span>
                  <button className={s.stepBtn} type="button"
                    onClick={() => setChildren((v) => Math.min(10, v + 1))}>+</button>
                </div>
              </div>
              <div>
                <p className={s.fieldLabel}>Manžel / partnerka</p>
                <button
                  className={`${s.spouseToggle} ${hasSpouse ? s.spouseToggleOn : ""}`}
                  onClick={() => setHasSpouse((v) => !v)}
                  type="button"
                >
                  {hasSpouse ? "ANO" : "NE"}
                </button>
              </div>
            </div>
          </div>

          {/* Graf analýzy rizika */}
          <div className={s.chartCard}>
            <p className={s.chartCardTitle}>Analýza rizika — měsíční bilance</p>
            <p className={s.chartCardSub}>
              Oranžová část = finanční mezera, kterou stát nepokryje a musí zajistit pojištění.
            </p>
            <RiskBarChart
              stateSickMonthly={results.stateSickMonthly}
              pnGapMonthly={results.pnGapMonthly}
              pensionD3={results.pensionD3}
              gapD3={results.gapD3}
              netIncome={netIncome}
            />
          </div>

        </div>{/* /inputCol */}

        {/* -------- VÝSLEDKOVÝ PANEL -------- */}
        <div className={s.resultPanel}>
          <div className={s.resultCard}>
            <div className={s.rcInner}>

              <div className={s.rcHeader}>
                <p className={s.rcEyebrow}>Doporučené min. pojistné částky</p>
                <span className={s.rcBadge}>Klesající do 65 let</span>
              </div>

              <div className={s.rcRows}>
                <ResultRow
                  icon="✕"
                  title="Smrt / pojistná částka"
                  sub="Závazky + zajištění rodiny − rezervy"
                  value={results.deathCoverage > 0 ? fmt(results.deathCoverage) : "0"}
                  unit="Kč"
                />
                <ResultRow
                  icon="♿"
                  title="Invalidita III. stupně"
                  sub="Kapitál kryjící výpadek příjmu do 65 let"
                  value={fmt(results.capitalD3)}
                  unit="Kč"
                  highlight
                />
                <ResultRow
                  icon="🏥"
                  title="Pracovní neschopnost (PN)"
                  sub="Denní dávka — chybějící příjem od státu"
                  value={fmt(results.pnDailyNeed)}
                  unit="Kč / den"
                />
                <ResultRow
                  icon="⚡"
                  title="Trvalé následky úrazu"
                  sub={`Základní krytí + 10× progrese`}
                  value={fmt(results.tnBase)}
                  unit="Kč"
                  badge={`Až ${fmt(results.tnProgression)} Kč`}
                />
              </div>

              {/* EUCS card */}
              <div className={s.eucsCard}>
                <div className={s.eucsIcon}>⚖</div>
                <div>
                  <p className={s.eucsTitle}>Právní ochrana EUCS</p>
                  <p className={s.eucsSub}>
                    Zajistí maximální plnění od pojišťovny — nutný doplněk ke smlouvě.
                  </p>
                  <div className={s.eucsPrices}>
                    <span className={s.eucsPrice}>49 Kč / os.</span>
                    <span className={s.eucsPrice}>149 Kč / rodina</span>
                  </div>
                </div>
              </div>

              {/* CTA */}
              <div className={s.ctaGroup}>
                <button className={s.ctaPrimary} type="button">
                  Chci řešení na míru →
                </button>
                <button className={s.ctaSecondary} type="button">
                  Mám smlouvu ke kontrole
                </button>
              </div>

              <p className={s.rcDisclaimer}>
                Kliknutím získáte nezávaznou konzultaci. Výsledky jsou orientační.
              </p>

            </div>
          </div>
        </div>

      </div>{/* /mainGrid */}

      {/* ====== FAQ ====== */}
      <div className={s.faqSection}>
        <div className={s.faqHeader}>
          <h2 className={s.faqTitle}>Časté dotazy</h2>
          <p className={s.faqSub}>Vše o kalkulačce životního pojištění</p>
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
