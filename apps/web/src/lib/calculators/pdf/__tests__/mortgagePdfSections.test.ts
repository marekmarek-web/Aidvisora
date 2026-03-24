import { describe, expect, it } from "vitest";
import { buildMortgagePdfSections } from "../mortgagePdfSections";
import type { BankOffer, MortgageResult, MortgageState } from "../../mortgage/mortgage.types";

const baseState: MortgageState = {
  product: "mortgage",
  mortgageType: "standard",
  loanType: "consumer",
  loan: 6_000_000,
  own: 600_000,
  extra: 0,
  term: 30,
  fix: 5,
  type: "new",
  ltvLock: 90,
};

const baseResult: MortgageResult = {
  monthlyPayment: 28_000,
  finalRate: 5.2,
  totalPaid: 10_000_000,
  borrowingAmount: 6_000_000,
  displayLtv: 90,
  propertyValue: 6_600_000,
  showLtvRow: true,
  ltvLabel: "LTV",
  showLtvWarning: false,
  ltvWarningValue: 0,
};

const mockOffer: BankOffer = {
  bank: {
    id: "kb",
    name: "Komerční banka",
    baseRate: 4.5,
    loanRate: 6.5,
    logoUrl: "",
  },
  rate: 5.1,
  monthlyPayment: 27_500,
};

describe("buildMortgagePdfSections", () => {
  it("includes product, subtype and main result rows", () => {
    const sections = buildMortgagePdfSections(baseState, baseResult, [mockOffer], {
      fetchedAt: "2026-01-01",
      source: "kurzy.cz",
    });
    const flat = sections.flatMap((s) => s.rows.map((r) => `${r.label}: ${r.value}`)).join("\n");
    expect(flat).toContain("Produkt: Hypotéka");
    expect(flat).toContain("Podtyp: Klasická");
    expect(flat).toContain("Režim: Nový úvěr / hypotéka");
    expect(flat).toContain("Měsíční splátka:");
    expect(flat).toContain("Komerční banka:");
  });

  it("lists bank offers section when offers provided", () => {
    const sections = buildMortgagePdfSections(baseState, baseResult, [mockOffer], null);
    const offersSection = sections.find((s) => s.title === "Orientační srovnání bank");
    expect(offersSection?.rows).toHaveLength(1);
    expect(offersSection?.rows[0]?.label).toBe("Komerční banka");
  });
});
