import { describe, it, expect } from "vitest";
import { dedupeCzechAccountTrailingBankCode } from "../payment-field-contract";
import { applyExtractedFieldAliasNormalizations } from "../extraction-field-alias-normalize";
import type { DocumentReviewEnvelope } from "../document-review-types";

/**
 * Regression tests pro bug „opakující se kód banky za lomítkem" (AI Review).
 *
 * Viz plán: `/0600/0600` se objevilo v UI i v client_payment_setups při
 * nahrání smlouvy z AI Review. Deduplikace se provádí jak v coerce fázi
 * (combined-extraction → extractedFields), tak při persistenci
 * (apply-contract-review, manual-payment-setup) a pro zobrazení v UI.
 */
describe("dedupeCzechAccountTrailingBankCode", () => {
  it("odstraní duplikát 4místného bank kódu za lomítkem", () => {
    expect(dedupeCzechAccountTrailingBankCode("213038282/0600/0600")).toBe("213038282/0600");
  });

  it("odstraní více opakování ve smyčce (až zůstane jedno)", () => {
    expect(dedupeCzechAccountTrailingBankCode("229875956/0600/0600/0600")).toBe("229875956/0600");
  });

  it("ignoruje bílé znaky", () => {
    expect(dedupeCzechAccountTrailingBankCode("  213038282 / 0600 / 0600 ")).toBe("213038282/0600");
  });

  it("neovlivní korektní účet bez duplicity", () => {
    expect(dedupeCzechAccountTrailingBankCode("123456789/0100")).toBe("123456789/0100");
  });

  it("neovlivní účet s prefixem (předčíslím) a jediným bank kódem", () => {
    expect(dedupeCzechAccountTrailingBankCode("19-123456789/0800")).toBe("19-123456789/0800");
  });

  it("odstraní duplicitu i u účtu s předčíslím", () => {
    expect(dedupeCzechAccountTrailingBankCode("19-123456789/0800/0800")).toBe("19-123456789/0800");
  });

  it("neovlivní IBAN (bez trailing duplicity)", () => {
    expect(dedupeCzechAccountTrailingBankCode("CZ6508000000192000145399")).toBe(
      "CZ6508000000192000145399",
    );
  });

  it("neodstraní dvě různá čísla (žádný duplikát)", () => {
    expect(dedupeCzechAccountTrailingBankCode("123456789/0100/0800")).toBe("123456789/0100/0800");
  });

  it("zachová prázdné vstupy", () => {
    expect(dedupeCzechAccountTrailingBankCode("")).toBe("");
  });
});

/**
 * Happy-path normalizace při extrakci — `applyExtractedFieldAliasNormalizations`
 * musí dedupe aplikovat nejen na `bankAccount`, ale i na `accountNumber`,
 * `recipientAccount`, `paymentAccountNumber`, `accountForRepayment`
 * (typicky investiční / penzijní doklady plní jiný klíč než `bankAccount`).
 */
describe("applyExtractedFieldAliasNormalizations — dedupe account-like fields", () => {
  function buildEnvelope(fields: Record<string, string>): DocumentReviewEnvelope {
    const ef: DocumentReviewEnvelope["extractedFields"] = {};
    for (const [k, v] of Object.entries(fields)) {
      ef[k] = { value: v, status: "extracted", confidence: 0.9 };
    }
    return {
      documentClassification: {
        primaryType: "investment_subscription_document",
        lifecycleStatus: "active",
        documentIntent: "new_contract",
        confidence: 0.9,
        reasons: [],
      },
      documentMeta: { scannedVsDigital: "digital" },
      extractedFields: ef,
      financialTerms: {},
      parties: [],
      evidence: [],
      reviewWarnings: [],
      suggestedActions: [],
    } as unknown as DocumentReviewEnvelope;
  }

  it("dedupuje recipientAccount na investiční smlouvě (happy path)", () => {
    const env = buildEnvelope({ recipientAccount: "213038282/0600/0600" });
    applyExtractedFieldAliasNormalizations(env);
    expect(env.extractedFields.recipientAccount?.value).toBe("213038282/0600");
  });

  it("dedupuje accountNumber i paymentAccountNumber", () => {
    const env = buildEnvelope({
      accountNumber: "123456789/0100/0100",
      paymentAccountNumber: "19-123456789/0800/0800",
    });
    applyExtractedFieldAliasNormalizations(env);
    expect(env.extractedFields.accountNumber?.value).toBe("123456789/0100");
    expect(env.extractedFields.paymentAccountNumber?.value).toBe("19-123456789/0800");
  });

  it("dedupuje accountForRepayment u úvěrových dokumentů", () => {
    const env = buildEnvelope({ accountForRepayment: "229875956/0600/0600" });
    env.documentClassification.primaryType = "consumer_loan_contract";
    applyExtractedFieldAliasNormalizations(env);
    expect(env.extractedFields.accountForRepayment?.value).toBe("229875956/0600");
  });
});
