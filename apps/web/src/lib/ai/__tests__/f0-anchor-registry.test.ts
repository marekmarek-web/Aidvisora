/**
 * F0 — fixture integrity: registry + golden expectations + PDF paths exist.
 * Bez LLM, bez sítě. Běží v běžném `pnpm test` (apps/web).
 */
import { describe, expect, it } from "vitest";
import {
  anchorPdfExists,
  loadAnchorGoldenExpectations,
  loadAnchorRegistry,
  F0_REPO_ROOT,
} from "./f0-anchor-registry";

describe("F0 — anchor registry + golden expectations fixtures", () => {
  it("loads anchor-registry.json", () => {
    const reg = loadAnchorRegistry();
    expect(reg.version).toBe(1);
    expect(reg.anchors.length).toBeGreaterThanOrEqual(6);
    const ids = new Set(reg.anchors.map((a) => a.id));
    expect(ids.has("MAXIMA")).toBe(true);
    expect(ids.has("AMUNDI")).toBe(true);
  });

  it("every registry anchor has a PDF on disk (or test env is incomplete)", () => {
    const reg = loadAnchorRegistry();
    const missing: string[] = [];
    for (const a of reg.anchors) {
      if (!anchorPdfExists(a.file)) missing.push(`${a.id}: ${a.file}`);
    }
    expect(missing, `Missing PDFs under ${F0_REPO_ROOT}:\n${missing.join("\n")}`).toEqual([]);
  });

  it("loads anchor-golden-expectations.json and ids match registry", () => {
    const reg = loadAnchorRegistry();
    const exp = loadAnchorGoldenExpectations();
    expect(exp.version).toBeGreaterThanOrEqual(1);
    const regIds = new Set(reg.anchors.map((a) => a.id));
    for (const e of exp.expectations) {
      expect(regIds.has(e.id), `expectation id ${e.id} not in anchor-registry`).toBe(true);
      expect(e.expectedPrimaryTypes.length).toBeGreaterThan(0);
      expect(e.mustHaveAnyOf.length).toBeGreaterThan(0);
    }
    expect(exp.expectations.length).toBe(reg.anchors.length);
  });

  // FL-3.4 — release gate: nové povinné fieldy v optionalFields (OP, lékař,
  // fundResolution) musí mít aspoň min. coverage napříč anchor setem, jinak je
  // golden fixture set v regresi a nezachytává AI extrakci nových polí.
  it("release-gate v2: optionalFields coverage for new fields (OP, doctor, fundResolution)", () => {
    const exp = loadAnchorGoldenExpectations();
    if (exp.version < 2) return; // zpětná kompatibilita — v1 fixtures test nepotřebují.

    const KNOWN_OPTIONAL_FIELDS = new Set([
      "idCardNumber",
      "doctorName",
      "fundResolution",
    ]);

    const coverage: Record<string, number> = {
      idCardNumber: 0,
      doctorName: 0,
      fundResolution: 0,
    };

    for (const e of exp.expectations) {
      for (const f of e.optionalFields ?? []) {
        expect(
          KNOWN_OPTIONAL_FIELDS.has(f),
          `unknown optionalField '${f}' in anchor ${e.id}`,
        ).toBe(true);
        coverage[f] = (coverage[f] ?? 0) + 1;
      }
    }

    // Každé nové pole je označené jako očekávané alespoň ve 3 anchor scenářích —
    // mimo tento baseline AI extrakce na novém poli nebude mít golden test.
    expect(coverage.idCardNumber, "idCardNumber coverage").toBeGreaterThanOrEqual(3);
    expect(coverage.doctorName, "doctorName coverage").toBeGreaterThanOrEqual(3);
    expect(coverage.fundResolution, "fundResolution coverage").toBeGreaterThanOrEqual(3);
  });
});
