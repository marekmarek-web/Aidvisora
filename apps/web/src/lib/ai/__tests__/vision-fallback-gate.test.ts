import { describe, it, expect, vi } from "vitest";

const addBreadcrumbMock = vi.hoisted(() => vi.fn());
vi.mock("@sentry/nextjs", () => ({
  addBreadcrumb: addBreadcrumbMock,
  withScope: (fn: (scope: unknown) => void) => fn({ setTag: () => {}, setContext: () => {}, setLevel: () => {} }),
  captureMessage: vi.fn(),
}));

import {
  evaluateVisionFallbackGate,
  CRITICAL_PUBLISH_FIELDS,
  LOW_CONFIDENCE_SCAN_THRESHOLD,
  RECOVERED_RATIO_FLAG_THRESHOLD,
  type VisionFallbackGateInput,
} from "../vision-fallback-gate";
import { breadcrumbVisionFallbackGateDecision } from "@/lib/observability/scan-sentry";
import type { DocumentReviewEnvelope, ExtractedField } from "../document-review-types";

function field(
  value: unknown,
  tier?: ExtractedField["evidenceTier"]
): ExtractedField {
  return {
    value,
    status: "extracted",
    ...(tier ? { evidenceTier: tier } : {}),
  };
}

function envelopeWith(
  fields: Record<string, ExtractedField>
): Pick<DocumentReviewEnvelope, "extractedFields"> {
  return { extractedFields: fields };
}

function baseInput(
  overrides: Partial<VisionFallbackGateInput> = {}
): VisionFallbackGateInput {
  return {
    scanVisionFallbackActivated: false,
    pageImageFallbackEnabled: true,
    hasPdfFileForVisionFallback: true,
    pageCount: 3,
    envelope: envelopeWith({}),
    recoveredFieldKeys: [],
    fullVisionMergedFieldKeys: [],
    overallConfidence: 0.85,
    enforceMode: false,
    ...overrides,
  };
}

describe("evaluateVisionFallbackGate", () => {
  it("permissive default: critical field recovered from image flags the reason but does NOT hard-block", () => {
    const decision = evaluateVisionFallbackGate(
      baseInput({
        scanVisionFallbackActivated: true,
        envelope: envelopeWith({
          iban: field("CZ6508000000192000145399", "recovered_from_image"),
          contractNumber: field("12345", "explicit_labeled_field"),
        }),
      })
    );
    expect(decision.hardBlockPublish).toBe(false);
    expect(decision.publishBlockReasons).toContain("critical_field_recovered_from_image");
    expect(decision.criticalFieldsFromVision).toEqual(["iban"]);
  });

  it("enforce mode: same inputs flip hardBlockPublish to true", () => {
    const decision = evaluateVisionFallbackGate(
      baseInput({
        scanVisionFallbackActivated: true,
        enforceMode: true,
        envelope: envelopeWith({
          iban: field("CZ65 0800 0000 1920 0014 5399", "recovered_from_image"),
          contractNumber: field("12345", "explicit_labeled_field"),
        }),
      })
    );
    expect(decision.hardBlockPublish).toBe(true);
    expect(decision.publishBlockReasons).toContain("critical_field_recovered_from_image");
  });

  it("computes recoveredRatio over fields with a value and flags when >50%", () => {
    const decision = evaluateVisionFallbackGate(
      baseInput({
        envelope: envelopeWith({
          a: field("x", "explicit_labeled_field"),
          b: field("y", "recovered_from_image"),
          c: field("z", "recovered_from_full_vision"),
          d: field(null), // no value → excluded from ratio
          e: field("", "explicit_table_field"), // empty string → excluded
        }),
      })
    );
    // total=3 (a,b,c), recovered=2 (b,c) → 2/3 ≈ 0.667
    expect(decision.recoveredRatio).toBeCloseTo(2 / 3, 5);
    expect(decision.recoveredRatio).toBeGreaterThan(RECOVERED_RATIO_FLAG_THRESHOLD);
    expect(decision.publishBlockReasons).toContain("recovered_ratio_above_threshold");
  });

  it("flags low_confidence_scan only when the scan-vision branch was active", () => {
    const scanLow = evaluateVisionFallbackGate(
      baseInput({
        scanVisionFallbackActivated: true,
        overallConfidence: LOW_CONFIDENCE_SCAN_THRESHOLD - 0.1,
      })
    );
    expect(scanLow.publishBlockReasons).toContain("low_confidence_scan");

    const digitalLow = evaluateVisionFallbackGate(
      baseInput({
        scanVisionFallbackActivated: false,
        overallConfidence: LOW_CONFIDENCE_SCAN_THRESHOLD - 0.1,
      })
    );
    expect(digitalLow.publishBlockReasons).not.toContain("low_confidence_scan");
  });

  it("clean digital PDF with all explicit tiers produces no publish-block reasons", () => {
    const decision = evaluateVisionFallbackGate(
      baseInput({
        envelope: envelopeWith({
          iban: field("CZ65...", "explicit_labeled_field"),
          contractNumber: field("42", "explicit_table_field"),
          policyAmount: field(1000, "explicit_section_block"),
        }),
      })
    );
    expect(decision.publishBlockReasons).toEqual([]);
    expect(decision.hardBlockPublish).toBe(false);
    expect(decision.criticalFieldsFromVision).toEqual([]);
  });

  it("rescue + full-vision run-decisions mirror today's boolean conditions", () => {
    // env off → no rescue, no full-vision
    const envOff = evaluateVisionFallbackGate(
      baseInput({ pageImageFallbackEnabled: false, scanVisionFallbackActivated: true })
    );
    expect(envOff.runRescue).toBe(false);
    expect(envOff.runFullVision).toBe(false);
    expect(envOff.reasons).toContain("rescue_disabled_env_flag");

    // No PDF → no rescue regardless of scan branch
    const noPdf = evaluateVisionFallbackGate(
      baseInput({ hasPdfFileForVisionFallback: false, scanVisionFallbackActivated: true })
    );
    expect(noPdf.runRescue).toBe(false);
    expect(noPdf.runFullVision).toBe(false);

    // Digital PDF (rescue yes, full-vision no — not a scan branch)
    const digital = evaluateVisionFallbackGate(baseInput({ scanVisionFallbackActivated: false }));
    expect(digital.runRescue).toBe(true);
    expect(digital.runFullVision).toBe(false);
    expect(digital.reasons).toContain("full_vision_skipped_not_scan_branch");

    // Scan branch — both run
    const scan = evaluateVisionFallbackGate(baseInput({ scanVisionFallbackActivated: true }));
    expect(scan.runRescue).toBe(true);
    expect(scan.runFullVision).toBe(true);
    expect(scan.reasons).toContain("full_vision_enabled_scan_branch");

    // Scan branch with many pages — full-vision still runs but reason notes cap
    const big = evaluateVisionFallbackGate(
      baseInput({ scanVisionFallbackActivated: true, pageCount: 12 })
    );
    expect(big.runFullVision).toBe(true);
    expect(big.reasons).toContain("full_vision_page_count_over_cap");
  });

  it("breadcrumbVisionFallbackGateDecision emits category 'ai_review.vision_fallback_gate' with correct level", () => {
    addBreadcrumbMock.mockClear();
    const decision = evaluateVisionFallbackGate(
      baseInput({
        scanVisionFallbackActivated: true,
        envelope: envelopeWith({
          iban: field("CZ...", "recovered_from_image"),
        }),
      })
    );
    breadcrumbVisionFallbackGateDecision({
      documentType: "commission_contract",
      decision,
      overallConfidence: 0.9,
      pageCount: 3,
    });
    expect(addBreadcrumbMock).toHaveBeenCalledTimes(1);
    const payload = addBreadcrumbMock.mock.calls[0]?.[0] as {
      category: string;
      level: string;
      data: Record<string, unknown>;
    };
    expect(payload.category).toBe("ai_review.vision_fallback_gate");
    // critical field from vision → publishBlockReasons non-empty → warning level
    expect(payload.level).toBe("warning");
    expect(payload.data.criticalFieldsFromVision).toEqual(["iban"]);
    expect(payload.data.runRescue).toBe(true);
  });

  it("is deterministic: same inputs return equal decisions across repeat calls", () => {
    const input = baseInput({
      scanVisionFallbackActivated: true,
      envelope: envelopeWith({
        iban: field("x", "recovered_from_image"),
        personalId: field("y", "recovered_from_full_vision"),
      }),
      tenantId: "tenant-xyz",
    });
    const first = evaluateVisionFallbackGate(input);
    const second = evaluateVisionFallbackGate(input);
    expect(first).toEqual(second);
    expect(first.tenantId).toBe("tenant-xyz");
    expect(new Set(first.criticalFieldsFromVision)).toEqual(
      new Set(["iban", "personalId"])
    );
    // Verify every critical key in output is from the known list.
    for (const key of first.criticalFieldsFromVision) {
      expect(CRITICAL_PUBLISH_FIELDS).toContain(key);
    }
  });
});
