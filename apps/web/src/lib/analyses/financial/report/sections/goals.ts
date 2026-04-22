import type { SectionCtx } from '../types';
import { nextSection, fmtMonthly, fmtBigCzk, fmtPct } from '../helpers';
import { investmentFv } from '../../calculations';

export function renderGoals(ctx: SectionCtx): string {
  const { data } = ctx;
  const num = nextSection(ctx.sectionCounter);

  const goals = data.goals ?? [];
  const investments = (data.investments ?? []).filter(
    (inv) => inv.amount > 0,
  );

  const conservativeMode = data.strategy?.conservativeMode ?? false;

  const totalMonthlyInvestment = investments
    .filter((inv) => inv.type === 'monthly')
    .reduce((s, i) => s + i.amount, 0);

  const totalGoalTarget = goals.reduce((s, g) => s + (g.computed?.fvTarget ?? 0), 0);

  const totalPortfolioFV = investments.reduce(
    (s, inv) => s + investmentFv(inv, conservativeMode),
    0,
  );

  const coveragePct = totalGoalTarget > 0 ? Math.min(100, (totalPortfolioFV / totalGoalTarget) * 100) : 0;

  const goalRows = goals.map((g) => {
    const target = g.computed?.fvTarget ?? 0;
    const pmt = g.computed?.pmt ?? 0;
    const coverage = target > 0 ? Math.min(100, (totalPortfolioFV / target) * 100) : 0;
    const horizonYears = g.years ?? g.horizon ?? 20;

    return `<div class="goal-row">
      <div class="goal-row-head">
        <div>
          <div class="goal-name">${g.name ?? 'Cíl'}</div>
          <div class="goal-horizon">Horizont: ${horizonYears} let</div>
        </div>
        <div style="text-align:right">
          <div class="goal-amt-val">${fmtBigCzk(target)}</div>
          <div class="goal-monthly">${pmt > 0 ? `měsíčně ${fmtMonthly(pmt)}` : ''}</div>
        </div>
      </div>
      <div class="goal-track"><div class="goal-fill" style="width:${coverage}%"></div></div>
      <div class="goal-meta"><span>0 Kč</span><span class="goal-covered">${fmtPct(coverage, 0)} pokryto</span><span>${fmtBigCzk(target)}</span></div>
    </div>`;
  }).join('');

  return `<section class="page" id="cile">
  <div class="page-bar"></div>
  <div class="page-inner">
    <div class="sec-header">
      <div class="sec-number">${num} — Finanční cíle</div>
      <div class="sec-title">Cíle &amp; plánování</div>
      <div class="sec-desc">Přehled vašich finančních cílů, potřebných úspor a aktuální míry pokrytí investičním portfoliem.</div>
    </div>

    <div class="kpi-row kpi-row-3">
      <div class="kpi-cell"><div class="kpi-label">Celkem cílová částka</div><div class="kpi-value">${fmtBigCzk(totalGoalTarget)}</div></div>
      <div class="kpi-cell green-cell"><div class="kpi-label">Projekce portfolia</div><div class="kpi-value">${fmtBigCzk(totalPortfolioFV)}</div></div>
      <div class="kpi-cell gold-cell"><div class="kpi-label">Pokrytí cílů</div><div class="kpi-value">${fmtPct(coveragePct, 0)}</div></div>
    </div>

    ${goalRows}

    ${goals.some((g) => g.name?.toLowerCase().includes('rent')) ? `
    <div class="formula-box">
      <div class="formula-title">Jak se počítá renta</div>
      <div class="formula-expr">Renta za rok = Naspořená částka × 4 %</div>
      <div class="formula-desc">Pravidlo vychází z předpokladu, že pokud si každý rok vezmete z investic 4 % hodnoty, majetek vydrží pokrývat vaše výdaje 25 let i déle. Počítá se s tím, že inflace bude v průměru kolem 3 % ročně a portfolio poroste kolem 7 % ročně.</div>
    </div>` : ''}

    ${totalMonthlyInvestment > 0 ? `
    <div class="callout success" style="margin-top:var(--s5,20px)">
      <span class="callout-icon">✓</span>
      <div><strong>Aktuální měsíční investice: ${fmtMonthly(totalMonthlyInvestment)}</strong>
      Vaše pravidelné investice směřují k pokrytí stanovených cílů.</div>
    </div>` : ''}
  </div>
</section>`;
}
