/**
 * Validation layer for extracted contract data.
 * Rules for contract number, amounts, payment frequency, dates, email, phone, identifiers.
 */

export type ValidationWarning = {
  code: string;
  message: string;
  field?: string;
};

export type ValidationResult = {
  valid: boolean;
  warnings: ValidationWarning[];
  reasonsForReview: string[];
};

/** Allowed payment frequency values (normalized). */
const PAYMENT_FREQUENCY_VALUES = new Set([
  "monthly",
  "quarterly",
  "yearly",
  "annual",
  "one-time",
  "jednorázově",
  "měsíčně",
  "čtvrtletně",
  "ročně",
  "yearly",
  "quarterly",
  "monthly",
]);

function addWarning(
  warnings: ValidationWarning[],
  reasons: string[],
  code: string,
  message: string,
  field?: string,
  reasonPhrase?: string
) {
  warnings.push({ code, message, field });
  if (reasonPhrase) reasons.push(reasonPhrase);
}

export function validateExtractedContract(payload: {
  contractNumber?: string | null;
  institutionName?: string | null;
  client?: {
    email?: string | null;
    phone?: string | null;
    personalId?: string | null;
    companyId?: string | null;
  } | null;
  paymentDetails?: {
    amount?: number | string | null;
    currency?: string | null;
    frequency?: string | null;
  } | null;
  effectiveDate?: string | null;
  expirationDate?: string | null;
  [key: string]: unknown;
}): ValidationResult {
  const warnings: ValidationWarning[] = [];
  const reasonsForReview: string[] = [];

  // Contract number: if present, basic format (alphanumeric, dashes, spaces)
  if (payload.contractNumber != null && String(payload.contractNumber).trim() !== "") {
    const cn = String(payload.contractNumber).trim();
    if (!/^[\dA-Za-z\s\-/\.]{3,50}$/.test(cn)) {
      addWarning(
        warnings,
        reasonsForReview,
        "CONTRACT_NUMBER_FORMAT",
        "Číslo smlouvy nemá očekávaný formát",
        "contractNumber",
        "contract_number_format"
      );
    }
  }

  // Amount: non-negative, sane range
  const amount = payload.paymentDetails?.amount;
  if (amount != null && amount !== "") {
    const n = typeof amount === "number" ? amount : parseFloat(String(amount).replace(/\s/g, "").replace(",", "."));
    if (Number.isNaN(n)) {
      addWarning(
        warnings,
        reasonsForReview,
        "AMOUNT_INVALID",
        "Částka není platné číslo",
        "paymentDetails.amount",
        "amount_invalid"
      );
    } else if (n < 0) {
      addWarning(
        warnings,
        reasonsForReview,
        "AMOUNT_NEGATIVE",
        "Částka je záporná",
        "paymentDetails.amount",
        "amount_negative"
      );
    } else if (n > 1e12) {
      addWarning(
        warnings,
        reasonsForReview,
        "AMOUNT_SUSPICIOUS",
        "Částka je mimo očekávané rozmezí",
        "paymentDetails.amount",
        "amount_suspicious"
      );
    }
  }

  // Payment frequency: allowed values
  const freq = payload.paymentDetails?.frequency;
  if (freq != null && String(freq).trim() !== "") {
    const normalized = String(freq).trim().toLowerCase();
    if (!PAYMENT_FREQUENCY_VALUES.has(normalized) && !/^(monthly|yearly|quarterly|annual|one-time)/i.test(normalized)) {
      addWarning(
        warnings,
        reasonsForReview,
        "PAYMENT_FREQUENCY",
        "Neplatná nebo neobvyklá frekvence platby",
        "paymentDetails.frequency",
        "payment_frequency"
      );
    }
  }

  // Dates: parseable
  const parseDate = (s: string | null | undefined): Date | null => {
    if (s == null || String(s).trim() === "") return null;
    const str = String(s).trim();
    const iso = /^\d{4}-\d{2}-\d{2}/.test(str) ? str : str.split(".").reverse().join("-");
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const effective = parseDate(payload.effectiveDate);
  const expiration = parseDate(payload.expirationDate);
  if (payload.effectiveDate != null && String(payload.effectiveDate).trim() !== "" && effective == null) {
    addWarning(
      warnings,
      reasonsForReview,
      "DATE_EFFECTIVE",
      "Datum účinnosti nelze přečíst",
      "effectiveDate",
      "date_effective"
    );
  }
  if (payload.expirationDate != null && String(payload.expirationDate).trim() !== "" && expiration == null) {
    addWarning(
      warnings,
      reasonsForReview,
      "DATE_EXPIRATION",
      "Datum konce nelze přečíst",
      "expirationDate",
      "date_expiration"
    );
  }
  if (effective != null && expiration != null && effective > expiration) {
    addWarning(
      warnings,
      reasonsForReview,
      "DATE_RANGE",
      "Datum účinnosti je po datu konce",
      undefined,
      "date_range"
    );
  }

  // Email
  const email = payload.client?.email;
  if (email != null && String(email).trim() !== "") {
    const e = String(email).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      addWarning(
        warnings,
        reasonsForReview,
        "EMAIL_FORMAT",
        "E-mail nemá platný formát",
        "client.email",
        "email_format"
      );
    }
  }

  // Phone: basic (digits, +, spaces)
  const phone = payload.client?.phone;
  if (phone != null && String(phone).trim() !== "") {
    const p = String(phone).trim();
    if (!/^[\d\s+\-()]{6,30}$/.test(p)) {
      addWarning(
        warnings,
        reasonsForReview,
        "PHONE_FORMAT",
        "Telefon nemá platný formát",
        "client.phone",
        "phone_format"
      );
    }
  }

  // Personal ID (Czech: 9 or 10 digits, optional slash)
  const personalId = payload.client?.personalId;
  if (personalId != null && String(personalId).trim() !== "") {
    const id = String(personalId).trim().replace(/\s/g, "");
    if (!/^\d{9}$|^\d{9}\/\d{1}$|^\d{6}\/\d{3,4}$/.test(id) && id.length < 8) {
      addWarning(
        warnings,
        reasonsForReview,
        "PERSONAL_ID_FORMAT",
        "Rodné číslo nemá očekávaný formát",
        "client.personalId",
        "personal_id_format"
      );
    }
  }

  // Company ID (Czech ICO: 8 digits)
  const companyId = payload.client?.companyId;
  if (companyId != null && String(companyId).trim() !== "") {
    const id = String(companyId).trim().replace(/\s/g, "");
    if (!/^\d{8}$/.test(id)) {
      addWarning(
        warnings,
        reasonsForReview,
        "COMPANY_ID_FORMAT",
        "IČO nemá očekávaný formát (8 číslic)",
        "client.companyId",
        "company_id_format"
      );
    }
  }

  const valid = warnings.filter((w) =>
    ["AMOUNT_INVALID", "AMOUNT_NEGATIVE", "DATE_EFFECTIVE", "DATE_EXPIRATION", "DATE_RANGE"].includes(w.code)
  ).length === 0;

  return {
    valid,
    warnings,
    reasonsForReview: [...new Set(reasonsForReview)],
  };
}
