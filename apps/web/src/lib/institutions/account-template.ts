/**
 * Helper pro renderování dynamického čísla účtu ze šablony institucionálního defaultu.
 *
 * Motivace: Conseq (a potenciálně další banky/PS) používá pro příchozí platby
 * vzorec `{contractPrefix}-{contractNumber}/{bankCode}`, kde předčíslí je
 * identifikátor fondu a číslo účtu je přímo číslo smlouvy klienta. VS se v tomto
 * scénáři neuvádí, identifikátor fondu plní jeho funkci.
 *
 * Tato funkce je čistá, browser-safe (bez DB/auth) a má unit testy.
 */

export type AccountTemplateContext = {
  /** Předčíslí účtu (u Consequ identifikátor fondu, např. „107"). */
  contractPrefix?: string | null;
  /** Hlavní číslo účtu — typicky `contracts.contractNumber`. */
  contractNumber?: string | null;
  /** Kód banky (např. „0100" pro KB). Fallback pro {bankCode} placeholder. */
  bankCode?: string | null;
};

/**
 * Vrátí `{ accountNumber, missingPlaceholders }`:
 *   - `accountNumber` — vyrenderovaný řetězec, nebo `null` pokud některý
 *     povinný placeholder chybí (nelze ho vyřešit z contextu).
 *   - `missingPlaceholders` — seznam placeholderů, které šablona obsahuje,
 *     ale context pro ně neměl hodnotu. Umožňuje UI zobrazit přesnou nápovědu
 *     advisorovi („doplňte číslo smlouvy").
 *
 * Placeholder syntax: `{key}` (např. `{contractNumber}`). Kompletní seznam
 * podporovaných klíčů je `contractPrefix`, `contractNumber`, `bankCode`.
 * Nepodporovaný placeholder zůstane ve výstupu doslovně (ale bude nahlášen
 * jako chyba v `missingPlaceholders`).
 */
export function renderInstitutionalAccountTemplate(
  template: string,
  ctx: AccountTemplateContext,
): { accountNumber: string | null; missingPlaceholders: string[] } {
  if (!template) return { accountNumber: null, missingPlaceholders: [] };

  const placeholderRegex = /\{(contractPrefix|contractNumber|bankCode|[a-zA-Z]+)\}/g;
  const missing: string[] = [];
  const resolved = template.replace(placeholderRegex, (_match, key) => {
    const normalizedKey = String(key);
    const value = resolvePlaceholderValue(normalizedKey, ctx);
    if (value == null || value === "") {
      missing.push(normalizedKey);
      return `{${normalizedKey}}`;
    }
    return value;
  });

  if (missing.length > 0) {
    return { accountNumber: null, missingPlaceholders: missing };
  }
  return { accountNumber: resolved, missingPlaceholders: [] };
}

function resolvePlaceholderValue(
  key: string,
  ctx: AccountTemplateContext,
): string | null {
  switch (key) {
    case "contractPrefix":
      return (ctx.contractPrefix ?? "").trim() || null;
    case "contractNumber":
      return (ctx.contractNumber ?? "").trim() || null;
    case "bankCode":
      return (ctx.bankCode ?? "").trim() || null;
    default:
      return null;
  }
}

/**
 * Vytáhne z čísla smlouvy případné předčíslí oddělené pomlčkou nebo dvojtečkou.
 * U Consequ klient často uvádí jen „107-123456" nebo „107:123456" — advisor
 * tak nemusí zadávat předčíslí zvlášť, když už je ve smlouvě vidět.
 */
export function splitContractNumberAndPrefix(
  raw: string | null | undefined,
): { contractPrefix: string | null; contractNumber: string | null } {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { contractPrefix: null, contractNumber: null };

  const dashMatch = trimmed.match(/^(\d{1,6})[-:](.+)$/);
  if (dashMatch) {
    return {
      contractPrefix: dashMatch[1] ?? null,
      contractNumber: (dashMatch[2] ?? "").trim() || null,
    };
  }
  return { contractPrefix: null, contractNumber: trimmed };
}
