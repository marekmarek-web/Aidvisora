"use client";

/**
 * ================================================================
 * PenzijniKalkulacka — Standalone React modul
 * ================================================================
 * Závislosti: žádné
 *
 * Fonty (layout.jsx): Inter + Plus Jakarta Sans
 *
 * Použití:
 *   import PenzijniKalkulacka from "@/components/PenzijniKalkulacka";
 *   <PenzijniKalkulacka />
 * ================================================================
 */

import { useState, useMemo } from "react";
import s from "./penzijni.module.css";

// ================================================================
// CONSTANTS
// ================================================================
const GRAD_START = "#2563EB";
const GRAD_END   = "#38BDF8";
const TRACK_COL  = "#E2E8F0";

const FAQ_DATA = [
  { q: "Jak kalkulačka odhaduje státní důchod?",
    a: "Výpočet vychází z náhradového poměru (replacement rate) — hrubé mzdy krát koeficient klesající s výší příjmu (solidarity). Realistický scénář navíc aplikuje demografický malus 0,8 % za každý rok do důchodu, protože systém bude kvůli stárnutí populace chudší." },
  { q: "Co je demografický malus?",
    a: "Dříve na jednoho důchodce vydělávali 4 pracující, dnes jsou to pouze 2 a trend klesá. Udržení současné výše důchodů bez reformy je matematicky nemožné — proto realistický scénář počítá s postupným poklesem." },
  { q: "Proč 7 % výnos a 2 % inflace?",
    a: "Kalkulačka počítá s reálným (inflačně očištěným) výnosem akciových ETF fondů. Historický průměr globálních akcií je cca 9–10 % nominálně, po odečtení 2% inflace dostaneme ~7 % reálně. Jde o konzervativní dlouhodobý odhad." },
  { q: "Co jsou DPS a DIP?",
    a: "DPS (Doplňkové penzijní spoření) a DIP (Dlouhodobý investiční produkt) jsou státem podporované nástroje s daňovým odpočtem až 48 000 Kč ročně. Ideální základ pro důchodovou strategii." },
  { q: "Jak mám interpretovat cílový majetek?",
    a: "Je to kapitál, který v okamžiku odchodu do důchodu potřebujete mít naakumulovaný, aby vám při bezpečném výběru (SWR) dokryl mezeru mezi státním důchodem a cílovou rentou po dobu 20 let v důchodu." },
  { q: "Mohu výsledky konzultovat?",
    a: "Výsledek kalkulačky je ideální výchozí bod pro individuální konzultaci — kde ladíme mix DPS/DIP/ETF, daňové optimalizace a konkrétní portfolio na míru vaší situaci." },
];

// ================================================================
// HELPERS
// ================================================================
const fmt    = (n) => Math.round(n).toLocaleString("cs-CZ").replace(/[\u202F\u00A0]/g, "\u00A0");
const parseCz = (str) => parseInt(String(str).replace(/\s/g, "").replace(/[^\d]/g, "")) || 0;

function sliderBg(value, min, max) {
  const pct = (((value - min) / (max - min)) * 100).toFixed(1);
  return `linear-gradient(90deg, ${GRAD_START} 0%, ${GRAD_END} ${pct}%, ${TRACK_COL} ${pct}%)`;
}

// ================================================================
// CORE CALCULATION — 1:1 port z originálu
// ================================================================
function calculate({ age, retireAge, salary, rent, scenario }) {
  // Krok A: Náhradový poměr → odhad státního důchodu
  let baseRate =
    salary < 20_000 ? 0.55 :
    salary < 40_000 ? 0.48 :
    salary < 60_000 ? 0.42 :
    salary < 80_000 ? 0.35 : 0.28;

  let estimatedPension = salary * baseRate;

  // Krok B: Demografický malus (realistický scénář)
  const yearsToRetirement = Math.max(0, retireAge - age);
  if (scenario === "realistic") {
    const malus = yearsToRetirement * 0.008;
    estimatedPension *= (1 - malus);
  }

  // Krok C: Bonus/malus za věk odchodu vs. standard 65
  if (retireAge > 65) {
    estimatedPension *= (1 + (retireAge - 65) * 0.015);
  } else if (retireAge < 65) {
    estimatedPension *= (1 - (65 - retireAge) * 0.05);
  }

  estimatedPension = Math.max(0, Math.round(estimatedPension));

  // Krok D: Mezera, cílový kapitál, nutná investice
  const monthlyGap = Math.max(0, rent - estimatedPension);

  let monthlyInvestment = 0;
  let targetCapital     = 0;

  if (yearsToRetirement > 0 && monthlyGap > 0) {
    const expectedReturn    = 0.07;
    const inflation         = 0.02;
    const realRate          = (1 + expectedReturn) / (1 + inflation) - 1;
    const yearsInRetirement = 20;
    const monthsRetirement  = yearsInRetirement * 12;
    const rRetMonthly       = 0.015 / 12;

    // Cílový kapitál: PV anuity (mezera × 12 let v důchodu)
    targetCapital = monthlyGap *
      (1 - Math.pow(1 + rRetMonthly, -monthsRetirement)) / rRetMonthly;

    // Nutná měsíční investice: PMT k akumulaci kapitálu
    const rAccMonthly      = realRate / 12;
    const monthsAccumulate = yearsToRetirement * 12;
    monthlyInvestment =
      (targetCapital * rAccMonthly) /
      (Math.pow(1 + rAccMonthly, monthsAccumulate) - 1);
  }

  return {
    estimatedPension,
    monthlyGap,
    monthlyInvestment: Math.round(monthlyInvestment),
    targetCapital:     Math.round(targetCapital),
    yearsToRetirement,
  };
}

// ================================================================
// SUB-COMPONENTS
// ================================================================

/** Slider — identický design s ostatními kalkulačkami */
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

/** Kliknutelná číslice s inline editací (Kč pole) */
function NumField({ value, onChange, accent, ariaLabel }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw]         = useState("");
  return editing ? (
    <input type="text"
      className={`${s.fieldValueInput} ${accent ? s.fieldValueAccent : ""}`}
      value={raw} autoFocus
      onChange={(e) => setRaw(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={() => { onChange(parseCz(raw)); setEditing(false); }}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
      aria-label={ariaLabel}
    />
  ) : (
    <span className={`${s.fieldValueInput} ${accent ? s.fieldValueAccent : ""}`}
      onClick={() => { setEditing(true); setRaw(String(value)); }}
      role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") { setEditing(true); setRaw(String(value)); }}}
      title="Klikněte pro úpravu"
    >{fmt(value)}</span>
  );
}

/** Vizuální indikátor mezery — jednoduché progress bary */
function GapVisual({ estimatedPension, rent }) {
  const total   = Math.max(rent, estimatedPension, 1);
  const penPct  = Math.min(100, (estimatedPension / total) * 100).toFixed(1);
  const gapPct  = Math.min(100, (Math.max(0, rent - estimatedPension) / total) * 100).toFixed(1);
  return (
    <div className={s.gapVisual}>
      <div className={s.gapVisualTitle}>Vizualizace důchodové mezery</div>
      <div className={s.gapBar}>
        <div className={s.gapBarPension}
          style={{ width: `${penPct}%` }}
          title={`Státní důchod: ${fmt(estimatedPension)} Kč`}
        />
        <div className={s.gapBarGap}
          style={{ width: `${gapPct}%` }}
          title={`Mezera: ${fmt(Math.max(0, rent - estimatedPension))} Kč`}
        />
      </div>
      <div className={s.gapBarLabels}>
        <span className={s.gapBarLabelPension}>Státní důchod: {fmt(estimatedPension)} Kč</span>
        {rent > estimatedPension && (
          <span className={s.gapBarLabelGap}>Chybí: {fmt(rent - estimatedPension)} Kč</span>
        )}
      </div>
      <div className={s.gapBarTarget}>Cílová renta: <strong>{fmt(rent)} Kč</strong> / měs.</div>
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
export default function PenzijniKalkulacka() {
  const [age,       setAge]       = useState(35);
  const [retireAge, setRetireAge] = useState(65);
  const [salary,    setSalary]    = useState(45_000);
  const [rent,      setRent]      = useState(35_000);
  const [scenario,  setScenario]  = useState("realistic");

  // Guard: věk odchodu nesmí být ≤ věku
  const safeRetireAge = Math.max(age + 1, retireAge);

  const result = useMemo(
    () => calculate({ age, retireAge: safeRetireAge, salary, rent, scenario }),
    [age, safeRetireAge, salary, rent, scenario]
  );

  const handleRetireAge = (v) => {
    setRetireAge(Math.max(age + 1, v));
  };

  const handleAge = (v) => {
    setAge(v);
    if (retireAge <= v) setRetireAge(v + 1);
  };

  // ================================================================
  // RENDER
  // ================================================================
  return (
    <div className={s.kalkulacka}>

      {/* Header */}
      <div className={s.modulHeader}>
        <p className={s.eyebrow}>Penzijní kalkulačka · 2026 · Metodika SWR + demografická data</p>
        <h1 className={s.title}>Spočítejte si svou důchodovou mezeru</h1>
        <p className={s.subtitle}>
          Zjistěte, kolik vám bude chybět od státu a kolik musíte dnes začít odkládat do
          DPS&nbsp;/ DIP, abyste si v důchodu udrželi životní úroveň.
        </p>
      </div>

      {/* ====== HLAVNÍ GRID ====== */}
      <div className={s.mainGrid}>

        {/* -------- VSTUPNÍ PANEL -------- */}
        <div className={s.inputCard}>
          <p className={s.cardLabel}>Vaše údaje</p>

          {/* Věk */}
          <div className={s.fieldSection}>
            <div className={s.fieldRow}>
              <span className={s.fieldLabel}>Váš současný věk</span>
              <div className={s.fieldValueWrap}>
                <span className={s.fieldValueDisplay}>{age}</span>
                <span className={s.fieldUnit}>let</span>
              </div>
            </div>
            <Slider id="age" value={age} min={18} max={64} step={1}
              onChange={handleAge} limitLeft="18 let" limitRight="64 let" />
          </div>

          {/* Věk odchodu */}
          <div className={`${s.fieldSection} ${s.fieldBorder}`}>
            <div className={s.fieldRow}>
              <span className={s.fieldLabel}>Věk odchodu do důchodu</span>
              <div className={s.fieldValueWrap}>
                <span className={s.fieldValueDisplay}>{safeRetireAge}</span>
                <span className={s.fieldUnit}>let</span>
              </div>
            </div>
            <Slider id="retireAge" value={safeRetireAge} min={60} max={70} step={1}
              onChange={handleRetireAge} limitLeft="60 let" limitRight="70 let" />
          </div>

          {/* Hrubá mzda */}
          <div className={`${s.fieldSection} ${s.fieldBorder}`}>
            <div className={s.fieldRow}>
              <span className={s.fieldLabel}>Hrubá mzda</span>
              <div className={s.fieldValueWrap}>
                <NumField value={salary} onChange={setSalary} ariaLabel="Hrubá mzda" />
                <span className={s.fieldUnit}>Kč</span>
              </div>
            </div>
            <Slider id="salary" value={salary} min={15_000} max={200_000} step={1_000}
              onChange={setSalary} limitLeft="15 tis." limitRight="200 tis." />
          </div>

          {/* Cílová renta */}
          <div className={`${s.fieldSection} ${s.fieldBorder} ${s.fieldHighlight}`}>
            <div className={s.fieldRow}>
              <div>
                <span className={s.fieldLabel}>Cílová renta v důchodu</span>
                <span className={s.fieldSublabel}>V dnešních cenách</span>
              </div>
              <div className={s.fieldValueWrap}>
                <NumField value={rent} onChange={setRent} accent ariaLabel="Cílová renta" />
                <span className={s.fieldUnit}>Kč</span>
              </div>
            </div>
            <Slider id="rent" value={rent} min={10_000} max={150_000} step={1_000}
              onChange={setRent} limitLeft="10 tis." limitRight="150 tis." />
          </div>

          {/* Scénář */}
          <div className={`${s.fieldSection} ${s.fieldBorder}`}>
            <div className={s.scenarioRow}>
              <div>
                <span className={s.fieldLabel}>Scénář vývoje státu</span>
                <span className={s.fieldSublabel}>Vliv demografiky na výši důchodu</span>
              </div>
              <div className={s.scenarioBtns}>
                <button
                  className={`${s.scenarioBtn} ${scenario === "optimistic" ? s.scenarioBtnActive : ""}`}
                  onClick={() => setScenario("optimistic")} type="button"
                >
                  Optimistický
                </button>
                <button
                  className={`${s.scenarioBtn} ${scenario === "realistic" ? s.scenarioBtnActive : ""}`}
                  onClick={() => setScenario("realistic")} type="button"
                >
                  Realistický
                </button>
              </div>
            </div>
            {scenario === "realistic" && (
              <div className={s.scenarioNote}>
                ⚠ Zohledněno stárnutí populace — malus {result.yearsToRetirement}&nbsp;×&nbsp;0,8&nbsp;%
                = −{(result.yearsToRetirement * 0.8).toFixed(0)}&nbsp;% důchodu
              </div>
            )}
          </div>

          {/* Automatický výpočet státního důchodu */}
          <div className={s.autoPension}>
            <div className={s.autoPensionLeft}>
              <span className={s.autoPensionLabel}>Odhad státního důchodu</span>
              <span className={s.autoPensionSub}>Automatický výpočet</span>
            </div>
            <div className={s.autoPensionValue}>
              {fmt(result.estimatedPension)}&nbsp;<span className={s.autoPensionUnit}>Kč / měs.</span>
            </div>
          </div>

          {/* Vizualizace mezery */}
          <GapVisual
            estimatedPension={result.estimatedPension}
            rent={rent}
          />

          {/* Reality check */}
          <div className={s.realityCheck}>
            <span className={s.realityIcon}>⚠</span>
            <div>
              <p className={s.realityTitle}>Proč mi vychází tak málo?</p>
              <p className={s.realityText}>
                Dříve na jednoho důchodce vydělávali 4 pracující, dnes jsou to pouze 2 a
                trend klesá (slabé ročníky vs. silné Husákovy děti).
                Udržení dnešní výše důchodů je bez reformy matematicky nemožné.
              </p>
            </div>
          </div>

        </div>{/* /inputCard */}

        {/* -------- VÝSLEDKOVÝ PANEL -------- */}
        <div className={s.resultPanel}>
          <div className={s.resultCard}>
            <div className={s.rcInner}>

              <p className={s.rcEyebrow}>⚠ Chybí vám měsíčně</p>
              <div className={s.rcGap}>
                {fmt(result.monthlyGap)}
                <span className={s.rcGapUnit}>Kč</span>
              </div>

              {result.monthlyGap === 0 && (
                <div className={s.rcNoGap}>
                  ✓ Státní důchod pokrývá cílovou rentu — skvělá pozice!
                </div>
              )}

              <div className={s.rcRows}>
                <div className={s.rcRow}>
                  <span className={s.rcRowLabel}>Nutno investovat dnes</span>
                  <span className={`${s.rcRowVal} ${s.rcRowGold}`}>
                    {fmt(result.monthlyInvestment)}&nbsp;Kč / měs.
                  </span>
                </div>
                <div className={`${s.rcRow} ${s.rcRowLast}`}>
                  <span className={s.rcRowLabel}>Cílový majetek v {safeRetireAge} letech</span>
                  <span className={s.rcRowVal}>
                    {(result.targetCapital / 1_000_000).toFixed(1).replace(".", ",")}&nbsp;mil. Kč
                  </span>
                </div>
              </div>

              {/* Komentář k výpočtu */}
              <div className={s.rcMeta}>
                <div className={s.rcMetaRow}>
                  <span className={s.rcMetaDot} style={{ background: "#60A5FA" }} />
                  <span>Do důchodu zbývá <strong>{result.yearsToRetirement}&nbsp;let</strong></span>
                </div>
                <div className={s.rcMetaRow}>
                  <span className={s.rcMetaDot} style={{ background: "#34D399" }} />
                  <span>Výnos 7&nbsp;% p.a., inflace 2&nbsp;%, SWR 20&nbsp;let</span>
                </div>
                <div className={s.rcMetaRow}>
                  <span className={s.rcMetaDot} style={{ background: "#FCD34D" }} />
                  <span>Scénář: <strong>{scenario === "realistic" ? "Realistický" : "Optimistický"}</strong></span>
                </div>
              </div>

              <button className={s.rcCta} type="button">
                Chci tento plán nastavit →
              </button>

              <p className={s.rcDisclaimer}>
                Výpočet předpokládá 7&nbsp;% p.a. (akciové ETF). Orientační výsledek.
              </p>

            </div>
          </div>
        </div>

      </div>{/* /mainGrid */}

      {/* ====== FAQ ====== */}
      <div className={s.faqSection}>
        <div className={s.faqHeader}>
          <h2 className={s.faqTitle}>Časté dotazy</h2>
          <p className={s.faqSub}>Jak výpočet funguje a co s ním dělat dál</p>
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
