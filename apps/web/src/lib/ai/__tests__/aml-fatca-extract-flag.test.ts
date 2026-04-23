import { describe, it, expect, afterEach } from "vitest";

import { isAmlFatcaExtractEnabled } from "../subdocument-extraction-orchestrator";

describe("isAmlFatcaExtractEnabled (Wave 4.A flag)", () => {
  const original = process.env.AI_REVIEW_AML_FATCA_EXTRACT;

  afterEach(() => {
    if (original === undefined) delete process.env.AI_REVIEW_AML_FATCA_EXTRACT;
    else process.env.AI_REVIEW_AML_FATCA_EXTRACT = original;
  });

  it("is OFF by default (undefined env)", () => {
    delete process.env.AI_REVIEW_AML_FATCA_EXTRACT;
    expect(isAmlFatcaExtractEnabled()).toBe(false);
  });

  it("is OFF when env is literal 'false'", () => {
    process.env.AI_REVIEW_AML_FATCA_EXTRACT = "false";
    expect(isAmlFatcaExtractEnabled()).toBe(false);
  });

  it("is OFF when env is anything other than 'true'", () => {
    process.env.AI_REVIEW_AML_FATCA_EXTRACT = "1";
    expect(isAmlFatcaExtractEnabled()).toBe(false);
    process.env.AI_REVIEW_AML_FATCA_EXTRACT = "on";
    expect(isAmlFatcaExtractEnabled()).toBe(false);
  });

  it("is ON only when env is exactly 'true'", () => {
    process.env.AI_REVIEW_AML_FATCA_EXTRACT = "true";
    expect(isAmlFatcaExtractEnabled()).toBe(true);
  });
});
