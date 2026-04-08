import { describe, it, expect, vi, beforeEach } from "vitest";
import { evaluateTerminationRules } from "../rules-engine";
import type { InsurerRegistryRow, ReasonCatalogRow } from "../types";

vi.mock("../catalog", () => ({
  findInsurerByName: vi.fn(),
  findReasonByCode: vi.fn(),
}));

import { findInsurerByName, findReasonByCode } from "../catalog";

const baseInsurer: InsurerRegistryRow = {
  id: "ir-1",
  catalogKey: "cz:TEST",
  insurerName: "Test PV",
  aliases: [],
  supportedSegments: ["ZP"],
  mailingAddress: null,
  email: null,
  dataBox: null,
  webFormUrl: null,
  clientPortalUrl: null,
  freeformLetterAllowed: true,
  requiresOfficialForm: false,
  officialFormName: null,
  officialFormStoragePath: null,
  officialFormNotes: null,
  allowedChannels: ["postal_mail"],
  ruleOverrides: {},
  attachmentRules: {},
  registryNeedsVerification: false,
};

const baseReason: ReasonCatalogRow = {
  id: "rc-1",
  reasonCode: "fixed_date_if_contractually_allowed",
  labelCs: "K datu",
  supportedSegments: ["ZP"],
  defaultDateComputation: "fixed_user_date",
  requiredFields: ["requested_effective_date"],
  attachmentRequired: false,
  alwaysReview: false,
  instructions: null,
  sortOrder: 10,
};

describe("evaluateTerminationRules", () => {
  beforeEach(() => {
    vi.mocked(findInsurerByName).mockReset();
    vi.mocked(findReasonByCode).mockReset();
  });

  it("returns hard_fail when reason code is unknown", async () => {
    vi.mocked(findInsurerByName).mockResolvedValue({ ...baseInsurer });
    vi.mocked(findReasonByCode).mockResolvedValue(null);

    const r = await evaluateTerminationRules("tenant-1", {
      source: "manual_intake",
      contactId: null,
      advisorId: "u1",
      contractNumber: null,
      productSegment: "ZP",
      insurerName: "Test PV",
      contractStartDate: null,
      contractAnniversaryDate: null,
      requestedEffectiveDate: "2099-01-01",
      terminationMode: "fixed_calendar_date",
      terminationReasonCode: "nonexistent_reason",
    });

    expect(r.outcome).toBe("hard_fail");
    expect(r.reasonCatalogId).toBeNull();
    expect(r.missingFields.length).toBeGreaterThan(0);
  });

  it("requires review when insurer is missing from registry", async () => {
    vi.mocked(findInsurerByName).mockResolvedValue(null);
    vi.mocked(findReasonByCode).mockResolvedValue({ ...baseReason });

    const r = await evaluateTerminationRules("tenant-1", {
      source: "manual_intake",
      contactId: null,
      advisorId: "u1",
      contractNumber: null,
      productSegment: "ZP",
      insurerName: "Neznámá pojišťovna XY",
      contractStartDate: null,
      contractAnniversaryDate: null,
      requestedEffectiveDate: "2099-06-01",
      terminationMode: "fixed_calendar_date",
      terminationReasonCode: "fixed_date_if_contractually_allowed",
    });

    expect(r.outcome).toBe("review_required");
    expect(r.reviewRequiredReason).toMatch(/registru/i);
  });

  it("computes fixed date when data is complete", async () => {
    vi.mocked(findInsurerByName).mockResolvedValue({ ...baseInsurer });
    vi.mocked(findReasonByCode).mockResolvedValue({ ...baseReason });

    const r = await evaluateTerminationRules("tenant-1", {
      source: "manual_intake",
      contactId: null,
      advisorId: "u1",
      contractNumber: null,
      productSegment: "ZP",
      insurerName: "Test PV",
      contractStartDate: null,
      contractAnniversaryDate: null,
      requestedEffectiveDate: "2099-09-15",
      terminationMode: "fixed_calendar_date",
      terminationReasonCode: "fixed_date_if_contractually_allowed",
    });

    expect(r.outcome).toBe("ready");
    expect(r.computedEffectiveDate).toBe("2099-09-15");
    expect(r.reasonCatalogId).toBe("rc-1");
  });

  it("two_months: uses requestedSubmissionDate for computed effective inside window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));
    vi.mocked(findInsurerByName).mockResolvedValue({ ...baseInsurer });
    vi.mocked(findReasonByCode).mockResolvedValue({
      ...baseReason,
      reasonCode: "within_2_months_from_inception",
      defaultDateComputation: "two_months_from_inception",
      requiredFields: ["contract_start_date"],
    });

    const r = await evaluateTerminationRules("tenant-1", {
      source: "manual_intake",
      contactId: null,
      advisorId: "u1",
      contractNumber: null,
      productSegment: "ZP",
      insurerName: "Test PV",
      contractStartDate: "2026-01-01",
      contractAnniversaryDate: null,
      requestedEffectiveDate: null,
      requestedSubmissionDate: "2026-01-20",
      terminationMode: "within_two_months_from_inception",
      terminationReasonCode: "within_2_months_from_inception",
    });

    expect(r.outcome).toBe("ready");
    expect(r.computedEffectiveDate).toBe("2026-01-20");
    vi.useRealTimers();
  });

  it("two_months: legacy fallback uses requestedEffectiveDate when submission missing", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));
    vi.mocked(findInsurerByName).mockResolvedValue({ ...baseInsurer });
    vi.mocked(findReasonByCode).mockResolvedValue({
      ...baseReason,
      reasonCode: "within_2_months_from_inception",
      defaultDateComputation: "two_months_from_inception",
      requiredFields: ["contract_start_date"],
    });

    const r = await evaluateTerminationRules("tenant-1", {
      source: "manual_intake",
      contactId: null,
      advisorId: "u1",
      contractNumber: null,
      productSegment: "ZP",
      insurerName: "Test PV",
      contractStartDate: "2026-01-01",
      contractAnniversaryDate: null,
      requestedEffectiveDate: "2026-01-18",
      requestedSubmissionDate: null,
      terminationMode: "within_two_months_from_inception",
      terminationReasonCode: "within_2_months_from_inception",
    });

    expect(r.computedEffectiveDate).toBe("2026-01-18");
    vi.useRealTimers();
  });

  it("golden: registryNeedsVerification forces review when otherwise ready", async () => {
    vi.mocked(findInsurerByName).mockResolvedValue({ ...baseInsurer, registryNeedsVerification: true });
    vi.mocked(findReasonByCode).mockResolvedValue({ ...baseReason });

    const r = await evaluateTerminationRules("tenant-1", {
      source: "manual_intake",
      contactId: null,
      advisorId: "u1",
      contractNumber: null,
      productSegment: "ZP",
      insurerName: "Test PV",
      contractStartDate: null,
      contractAnniversaryDate: null,
      requestedEffectiveDate: "2099-09-15",
      terminationMode: "fixed_calendar_date",
      terminationReasonCode: "fixed_date_if_contractually_allowed",
    });

    expect(r.outcome).toBe("review_required");
    expect(r.reviewRequiredReason).toMatch(/ověřen/i);
  });
});
