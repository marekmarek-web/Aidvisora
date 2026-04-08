/**
 * Odvodí výroční den (stejný měsíc/den jako počátek smlouvy) pro nejbližší
 * kalendářní výskyt v aktuálním nebo následujícím roce — lokální datum jako v rules-engine.
 */

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function parseIsoYmd(iso: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

function toIsoLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Vrátí YYYY-MM-DD prvního výročí (MD z počátku) splňujícího `candidate >= today` (local midnight).
 * 29. 2. na nepřestupní rok → 28. 2.
 */
export function suggestedAnniversaryFromContractStart(contractStartIso: string, now: Date = new Date()): string | null {
  const p = parseIsoYmd(contractStartIso);
  if (!p) return null;

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  for (let add = 0; add <= 2; add++) {
    const year = today.getFullYear() + add;
    let cand = new Date(year, p.m - 1, p.d);
    if (cand.getMonth() !== p.m - 1 || cand.getDate() !== p.d) {
      if (p.m === 2 && p.d === 29) {
        cand = new Date(year, 1, 28);
      } else {
        continue;
      }
    }
    cand.setHours(0, 0, 0, 0);
    if (cand >= today) {
      return toIsoLocal(cand);
    }
  }
  return null;
}
