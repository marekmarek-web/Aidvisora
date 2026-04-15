import { describe, it, expect } from "vitest";
import type { ContractRow } from "@/app/actions/contracts";
import { mapContractToCanonicalProduct } from "@/lib/client-portfolio/canonical-contract-read";
import { advisorPrimaryAmountPresentation } from "../advisor-product-overview-format";

function row(overrides: Partial<ContractRow> = {}): ContractRow {
  return {
    id: "c1",
    contactId: "ct1",
    segment: "INV",
    type: "INV",
    partnerId: null,
    productId: null,
    partnerName: "Portu",
    productName: "Pravidelná investice",
    premiumAmount: "5000",
    premiumAnnual: null,
    contractNumber: null,
    startDate: null,
    anniversaryDate: null,
    note: null,
    visibleToClient: true,
    portfolioStatus: "active",
    sourceKind: "manual",
    sourceDocumentId: null,
    sourceContractReviewId: null,
    advisorConfirmedAt: null,
    confirmedByUserId: null,
    portfolioAttributes: {},
    extractionConfidence: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("advisorPrimaryAmountPresentation", () => {
  it("uses loan principal when present", () => {
    const contract = row({
      segment: "HYPO",
      type: "HYPO",
      premiumAmount: "12500",
      portfolioAttributes: { loanPrincipal: "5 000 000 Kč" },
    });
    const product = mapContractToCanonicalProduct(contract);
    const out = advisorPrimaryAmountPresentation(product, contract);
    expect(out.label).toBe("Jistina");
    expect(out.value).toBe("5 000 000 Kč");
  });

  it("uses pension participant contribution when present", () => {
    const contract = row({
      segment: "DPS",
      type: "DPS",
      premiumAmount: "1700",
      portfolioAttributes: { participantContribution: "1 700 Kč měsíčně" },
    });
    const product = mapContractToCanonicalProduct(contract);
    const out = advisorPrimaryAmountPresentation(product, contract);
    expect(out.label).toBe("Příspěvek účastníka");
    expect(out.value).toBe("1 700 Kč měsíčně");
  });

  it("falls back to portal premium line for generic segments", () => {
    const contract = row({
      segment: "CEST",
      type: "CEST",
      premiumAmount: null,
      premiumAnnual: null,
    });
    const product = mapContractToCanonicalProduct(contract);
    const out = advisorPrimaryAmountPresentation(product, contract);
    expect(out.label).toBe("Částka");
    expect(out.value).toBe("Dle smlouvy");
  });
});
