import "server-only";

/**
 * PII redakce (skeleton pro WS-2 Batch 1).
 *
 * Cíl: konzistentní maskování citlivých hodnot pro:
 *   - interní CRM logy / Sentry breadcrumbs,
 *   - interní AI podklady pro poradce (prompt kontext), kde nechceme posílat raw PII,
 *   - debug výpisy v dev toolech.
 *
 * Toto **není** anonymizace pro export klientovi a **není** právní záruka.
 * Je to defense-in-depth vrstva pro interní Aidvisora kontext.
 *
 * Žádná funkce zde nesmí odvozovat doporučení pro klienta.
 */

const DEFAULT_MASK = "***";

/** Nahradí prostředek řetězce maskou, zachová délku kontextu. */
export function maskMiddle(value: string, keepStart = 2, keepEnd = 2, mask = DEFAULT_MASK): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (trimmed.length <= keepStart + keepEnd) return mask;
  return `${trimmed.slice(0, keepStart)}${mask}${trimmed.slice(-keepEnd)}`;
}

/** E-mail: `a***@domain.cz`. Pro neplatné vstupy vrací `***`. */
export function redactEmail(value: string | null | undefined): string {
  if (!value) return "";
  const s = String(value).trim();
  const at = s.indexOf("@");
  if (at <= 0) return DEFAULT_MASK;
  const local = s.slice(0, at);
  const domain = s.slice(at + 1);
  const firstChar = local.slice(0, 1);
  return `${firstChar}${DEFAULT_MASK}@${domain}`;
}

/** Telefonní číslo: zachová posledních 3 číslic, zbytek `*`. */
export function redactPhone(value: string | null | undefined): string {
  if (!value) return "";
  const digits = String(value).replace(/\D/g, "");
  if (digits.length <= 3) return DEFAULT_MASK;
  const tail = digits.slice(-3);
  return `${"*".repeat(digits.length - 3)}${tail}`;
}

/** České rodné číslo (RČ): `YYMMDD/****`. */
export function redactCzechPersonalId(value: string | null | undefined): string {
  if (!value) return "";
  const digits = String(value).replace(/\D/g, "");
  if (digits.length < 9) return DEFAULT_MASK;
  const head = digits.slice(0, 6);
  return `${head}/****`;
}

/** IBAN: `CZxx****XXXX` — zachová zemi a posledních 4 znaků. */
export function redactIban(value: string | null | undefined): string {
  if (!value) return "";
  const s = String(value).replace(/\s/g, "").toUpperCase();
  if (s.length < 8) return DEFAULT_MASK;
  return `${s.slice(0, 2)}**${DEFAULT_MASK}${s.slice(-4)}`;
}

/** Čísla OP / pasu: zachová posledních 2 znaků. */
export function redactIdCardNumber(value: string | null | undefined): string {
  if (!value) return "";
  const s = String(value).trim();
  if (s.length <= 2) return DEFAULT_MASK;
  return `${DEFAULT_MASK}${s.slice(-2)}`;
}

/** Datum narození: zachová rok, maskuje den a měsíc → `**.**.YYYY`. */
export function redactBirthDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  const s = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).trim();
  // ISO `YYYY-MM-DD`
  const iso = s.match(/^(\d{4})-\d{2}-\d{2}/);
  if (iso) return `**.**.${iso[1]}`;
  // CZ `DD.MM.YYYY`
  const cz = s.match(/^\d{2}\.\d{2}\.(\d{4})/);
  if (cz) return `**.**.${cz[1]}`;
  return DEFAULT_MASK;
}

/** Celé jméno: `Jan N.` (zachová křestní, maskuje příjmení). */
export function redactFullName(value: string | null | undefined): string {
  if (!value) return "";
  const parts = String(value).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return `${parts[0]}`;
  const first = parts[0];
  const last = parts[parts.length - 1];
  const lastInitial = last.slice(0, 1).toUpperCase();
  return `${first} ${lastInitial}.`;
}

/**
 * Vzory pro scanning volného textu (logy, chat kontext).
 * Každý pattern má scope, bez backreferencí, záměrně konzervativní.
 */
const PATTERNS: Array<{ name: string; regex: RegExp; replace: (match: string) => string }> = [
  {
    name: "email",
    regex: /[\w.+-]+@[\w-]+\.[\w.-]+/g,
    replace: (m) => redactEmail(m),
  },
  {
    name: "iban-cz",
    regex: /\bCZ\d{2}[\s\d]{10,30}\b/g,
    replace: (m) => redactIban(m),
  },
  {
    name: "czech-personal-id",
    regex: /\b\d{6}\s?\/\s?\d{3,4}\b/g,
    replace: (m) => redactCzechPersonalId(m),
  },
  {
    name: "phone-cz",
    regex: /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{3}/g,
    replace: (m) => redactPhone(m),
  },
];

/**
 * Projede volný text a maskuje známé PII vzorce.
 * Pořadí pravidel je stabilní (e-mail > IBAN > RČ > telefon), aby se např. e-mail
 * nezaměnil za telefonní sekvenci.
 */
export function redactFreeText(input: string | null | undefined): string {
  if (!input) return "";
  let out = String(input);
  for (const { regex, replace } of PATTERNS) {
    out = out.replace(regex, (match) => replace(match));
  }
  return out;
}

/**
 * Shallow redakce objektu podle známých klíčů. Nerekurzivní (úmyslně — konzumenti
 * si mají sami zvolit hloubku, aby se minimalizovala náhodná ztráta dat v auditu).
 */
export type RedactableContactLike = {
  email?: string | null;
  phone?: string | null;
  personalId?: string | null;
  personal_id?: string | null;
  birthDate?: string | Date | null;
  birth_date?: string | Date | null;
  iban?: string | null;
  idCardNumber?: string | null;
  id_card_number?: string | null;
  fullName?: string | null;
  full_name?: string | null;
  firstName?: string | null;
  first_name?: string | null;
  lastName?: string | null;
  last_name?: string | null;
};

export function redactContactLike<T extends RedactableContactLike>(row: T): T {
  const out: RedactableContactLike = { ...row };
  if (out.email) out.email = redactEmail(out.email);
  if (out.phone) out.phone = redactPhone(out.phone);
  if (out.personalId) out.personalId = redactCzechPersonalId(out.personalId);
  if (out.personal_id) out.personal_id = redactCzechPersonalId(out.personal_id);
  if (out.birthDate) out.birthDate = redactBirthDate(out.birthDate);
  if (out.birth_date) out.birth_date = redactBirthDate(out.birth_date);
  if (out.iban) out.iban = redactIban(out.iban);
  if (out.idCardNumber) out.idCardNumber = redactIdCardNumber(out.idCardNumber);
  if (out.id_card_number) out.id_card_number = redactIdCardNumber(out.id_card_number);
  if (out.fullName) out.fullName = redactFullName(out.fullName);
  if (out.full_name) out.full_name = redactFullName(out.full_name);
  // Pozn.: first_name/last_name necháváme beze změny, protože samotné křestní jméno
  // mimo kontext se typicky za přímé PII nepovažuje; pokud je potřeba, konzument
  // si zavolá `redactFullName` explicitně.
  return out as T;
}
