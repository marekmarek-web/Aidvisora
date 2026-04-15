/**
 * Run: pnpm vitest run src/lib/client-portal/__tests__/portal-payments-read-model.test.ts
 */
import { describe, expect, it } from "vitest";
import type { PaymentInstruction } from "@/app/actions/payment-pdf";
import {
  accountFieldLabel,
  formatPortalPrimaryAmountLine,
  institutionDisplayName,
  isPortalPaymentQrActionEligible,
  isCzechDomesticAccount,
  isCzechOrGeneralIban,
  portalFrequencyLabel,
  portalPaymentsViewKind,
  variableSymbolDisplay,
} from "../portal-payments-read-model";

function baseInstruction(over: Partial<PaymentInstruction>): PaymentInstruction {
  return {
    segment: "ZP",
    partnerName: "Kooperativa",
    productName: "Životní pojištění",
    contractNumber: "123",
    accountNumber: "123456/0100",
    bank: null,
    note: null,
    amount: "1000",
    frequency: "monthly",
    variableSymbol: "777",
    specificSymbol: null,
    constantSymbol: null,
    currency: null,
    paymentSetupId: "ps-1",
    contractId: "c-1",
    linkedContractPortfolioStatus: "active",
    ...over,
  };
}

describe("portal-payments-read-model", () => {
  it("does not surface placeholder dash as institution name", () => {
    expect(institutionDisplayName("—")).toBeNull();
    expect(institutionDisplayName("  ")).toBeNull();
    expect(institutionDisplayName("Allianz")).toBe("Allianz");
  });

  it("formatPortalPrimaryAmountLine avoids fake zero amounts", () => {
    expect(formatPortalPrimaryAmountLine(baseInstruction({ amount: "0", note: null }))).toBe("Dle smlouvy");
    expect(formatPortalPrimaryAmountLine(baseInstruction({ amount: "", note: "   " }))).toBe("Dle smlouvy");
    expect(formatPortalPrimaryAmountLine(baseInstruction({ amount: "1500.5", currency: "EUR" }))).toMatch(/1\s*500,5 EUR/);
  });

  it("portalFrequencyLabel prefers Czech labels from canonical frequency strings", () => {
    expect(portalFrequencyLabel(baseInstruction({ frequency: "monthly" }))).toBe("Měsíčně");
    expect(portalFrequencyLabel(baseInstruction({ frequency: null }))).toBeNull();
  });

  it("variableSymbolDisplay falls back to contract number", () => {
    expect(variableSymbolDisplay(baseInstruction({ variableSymbol: null, contractNumber: "ABC" }))).toBe("ABC");
    expect(variableSymbolDisplay(baseInstruction({ variableSymbol: "VS1", contractNumber: "ABC" }))).toBe("VS1");
  });

  it("isPortalPaymentQrActionEligible requires encodable account", () => {
    expect(isPortalPaymentQrActionEligible(baseInstruction({ accountNumber: "CZ6508000000192000145399" }))).toBe(true);
    expect(isPortalPaymentQrActionEligible(baseInstruction({ accountNumber: "123456789/0800" }))).toBe(true);
    expect(isPortalPaymentQrActionEligible(baseInstruction({ accountNumber: "   " }))).toBe(false);
    expect(isPortalPaymentQrActionEligible(baseInstruction({ accountNumber: "???" }))).toBe(false);
  });

  it("IBAN / domestic detection", () => {
    expect(isCzechOrGeneralIban("CZ65 0800 0000 1920 0014 5399")).toBe(true);
    expect(isCzechDomesticAccount("123456789/0800")).toBe(true);
    expect(accountFieldLabel("CZ6508000000192000145399")).toBe("IBAN");
    expect(accountFieldLabel("12/0100")).toBe("Účet");
  });

  it("portalPaymentsViewKind: empty vs error vs list", () => {
    expect(portalPaymentsViewKind(true, 0)).toBe("load_failed");
    expect(portalPaymentsViewKind(false, 0)).toBe("empty");
    expect(portalPaymentsViewKind(false, 3)).toBe("list");
  });
});
