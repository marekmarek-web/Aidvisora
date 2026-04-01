import { LIMITS } from "./mortgage.config";
import type { MortgageState, ProductType } from "./mortgage.types";

export const MORTGAGE_CALCULATOR_SESSION_KEY = "aidvisora-portal-calculator-mortgage-loan-v1";

export function defaultMortgageFormState(): MortgageState {
  return {
    product: "mortgage",
    mortgageType: "standard",
    loanType: "consumer",
    loan: LIMITS.mortgage.default,
    own: 600_000,
    extra: 0,
    term: 30,
    fix: 5,
    type: "new",
    ltvLock: 90,
  };
}

export function defaultLoanFormState(): MortgageState {
  return {
    product: "loan",
    mortgageType: "standard",
    loanType: "consumer",
    loan: LIMITS.loan.default,
    own: 0,
    extra: 0,
    term: 12,
    fix: 5,
    type: "new",
    ltvLock: null,
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function coerceMortgageState(raw: unknown, product: ProductType): MortgageState | null {
  if (!isRecord(raw)) return null;
  if (raw.product !== product) return null;
  const num = (k: string) => (typeof raw[k] === "number" && Number.isFinite(raw[k] as number) ? (raw[k] as number) : null);
  const loan = num("loan");
  const own = num("own");
  const extra = num("extra");
  const term = num("term");
  const fix = num("fix");
  if (loan == null || own == null || extra == null || term == null || fix == null) return null;
  const mortgageType = raw.mortgageType;
  const loanType = raw.loanType;
  const type = raw.type;
  if (type !== "new" && type !== "refi") return null;
  if (product === "mortgage") {
    if (mortgageType !== "standard" && mortgageType !== "investment" && mortgageType !== "american") return null;
  } else {
    if (loanType !== "consumer" && loanType !== "auto" && loanType !== "consolidation") return null;
  }
  let ltvLock: number | null = null;
  if (raw.ltvLock === null) ltvLock = null;
  else if (typeof raw.ltvLock === "number" && Number.isFinite(raw.ltvLock)) ltvLock = raw.ltvLock;

  return {
    product,
    mortgageType: mortgageType as MortgageState["mortgageType"],
    loanType: loanType as MortgageState["loanType"],
    loan,
    own,
    extra,
    term,
    fix,
    type,
    ltvLock: product === "mortgage" ? ltvLock : null,
  };
}

export type MortgageCalculatorSessionPayload = {
  mortgage: MortgageState;
  loan: MortgageState;
  lastActive: ProductType;
};

export function parseMortgageCalculatorSession(raw: string): MortgageCalculatorSessionPayload | null {
  try {
    const o = JSON.parse(raw) as unknown;
    if (!isRecord(o)) return null;
    if (o.lastActive !== "mortgage" && o.lastActive !== "loan") return null;
    const mortgage = coerceMortgageState(o.mortgage, "mortgage");
    const loan = coerceMortgageState(o.loan, "loan");
    if (!mortgage || !loan) return null;
    return { mortgage, loan, lastActive: o.lastActive };
  } catch {
    return null;
  }
}
