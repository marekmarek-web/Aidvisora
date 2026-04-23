/**
 * Golden SCAN subset — schema + (optional) live pipeline baseline eval.
 *
 * Wave 1.2 of the Premium Scan Closeout plan.
 *
 * Two modes:
 *
 *  1. Default (always on in CI): validates `fixtures/golden-ai-review/scan-subset.manifest.json`
 *     + each `scan-expectations/<expectationFile>` for structural integrity. No network, no PDFs.
 *     This is the regression gate for the fixture authoring itself.
 *
 *  2. Live baseline (opt-in): set `GOLDEN_SCAN_EVAL=1` to also invoke
 *     `runContractUnderstandingPipeline` against each `status: "live"` anchor and write a
 *     markdown + JSON baseline report into `fixtures/golden-ai-review/eval-outputs/scan-subset-<ts>/`.
 *     Live-mode assertions stay SOFT in Wave 1 — we need the pinned baseline first so W3/W4/W5 have
 *     something to diff against. Wave 5 flips these into hard asserts.
 *
 * Run (schema only — fast):
 *   pnpm --filter web exec vitest run src/lib/ai/__tests__/golden-scan-subset.eval.test.ts
 *
 * Run (live baseline — requires OpenAI creds + local PDFs in Test AI/):
 *   GOLDEN_SCAN_EVAL=1 pnpm --filter web exec vitest run \
 *     src/lib/ai/__tests__/golden-scan-subset.eval.test.ts --testTimeout=600000
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
/** __tests__ → ai → lib → src → apps/web */
const appsWebRoot = join(__dirname, "../../../..");
const repoRoot = join(appsWebRoot, "..", "..");
const fixturesDir = join(repoRoot, "fixtures/golden-ai-review");
const subsetManifestPath = join(fixturesDir, "scan-subset.manifest.json");
const expectationsDir = join(fixturesDir, "scan-expectations");
const evalOutDir = join(fixturesDir, "eval-outputs");

type SubsetEntry = {
  id: string;
  anchor: string;
  failureMode: string;
  expectationFile: string;
  status: "live" | "pending_fixture";
  maxLatencyMs?: number;
  corpusNote?: string;
};

type SubsetManifest = {
  version: number;
  description: string;
  consumers: string[];
  expectationFilesDir: string;
  liveEvalEnvFlag: string;
  entries: SubsetEntry[];
};

type ScanExpectation = {
  id: string;
  anchor: string;
  documentTypeHint: string;
  description: string;
  requiredFieldsMustRecover: string[];
  fieldsThatMustNOTHallucinate: string[];
  maxRecoveredFromImageRatio: number;
  minOverallConfidence: number;
  expectedEvidenceTiersAllowed: string[];
  expectedReviewWarningCodes: string[];
  expectedFlags?: Record<string, unknown>;
  notes?: string[];
};

const ALLOWED_EVIDENCE_TIERS = new Set([
  "explicit_labeled_field",
  "explicit_table_field",
  "explicit_section_block",
  "normalized_alias_match",
  "local_inference",
  "cross_section_inference",
  "classifier_fallback",
  "model_inference_only",
  "recovered_from_image",
  "recovered_from_full_vision",
  "missing",
]);

function loadManifest(): SubsetManifest {
  const raw = readFileSync(subsetManifestPath, "utf-8");
  return JSON.parse(raw) as SubsetManifest;
}

function loadExpectation(file: string): ScanExpectation {
  const p = join(expectationsDir, file);
  const raw = readFileSync(p, "utf-8");
  return JSON.parse(raw) as ScanExpectation;
}

describe("golden scan subset — manifest shape", () => {
  const manifest = loadManifest();

  it("manifest has a supported version and non-empty entries", () => {
    expect(manifest.version).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(manifest.entries)).toBe(true);
    expect(manifest.entries.length).toBeGreaterThan(0);
  });

  it("each entry has a stable id + required keys", () => {
    const ids = new Set<string>();
    for (const entry of manifest.entries) {
      expect(entry.id).toMatch(/^S\d{2,}$/);
      expect(ids.has(entry.id)).toBe(false);
      ids.add(entry.id);
      expect(typeof entry.anchor).toBe("string");
      expect(entry.anchor.length).toBeGreaterThan(0);
      expect(typeof entry.failureMode).toBe("string");
      expect(typeof entry.expectationFile).toBe("string");
      expect(entry.status === "live" || entry.status === "pending_fixture").toBe(true);
    }
  });

  it("pending_fixture entries have NO expectation JSON yet — keeps the live eval honest", () => {
    for (const entry of manifest.entries) {
      if (entry.status !== "pending_fixture") continue;
      const p = join(expectationsDir, entry.expectationFile);
      expect(existsSync(p)).toBe(false);
    }
  });

  it("expectations folder only contains files referenced by the manifest (plus README)", () => {
    const referenced = new Set(
      manifest.entries
        .filter((e) => e.status === "live")
        .map((e) => e.expectationFile)
    );
    const actual = readdirSync(expectationsDir).filter((f) => f.endsWith(".json"));
    for (const name of actual) {
      expect(referenced.has(name)).toBe(true);
    }
  });
});

describe("golden scan subset — per-entry expectation schema", () => {
  const manifest = loadManifest();
  const liveEntries = manifest.entries.filter((e) => e.status === "live");

  it.each(liveEntries.map((e) => [e.id, e] as const))(
    "expectation file for %s is well-formed",
    (_id, entry) => {
      const expectation = loadExpectation(entry.expectationFile);
      expect(expectation.id).toBe(entry.id);
      expect(expectation.anchor).toBe(entry.anchor);
      expect(typeof expectation.documentTypeHint).toBe("string");
      expect(expectation.documentTypeHint.length).toBeGreaterThan(0);
      expect(Array.isArray(expectation.requiredFieldsMustRecover)).toBe(true);
      expect(expectation.requiredFieldsMustRecover.length).toBeGreaterThan(0);
      expect(Array.isArray(expectation.fieldsThatMustNOTHallucinate)).toBe(true);
      expect(expectation.maxRecoveredFromImageRatio).toBeGreaterThanOrEqual(0);
      expect(expectation.maxRecoveredFromImageRatio).toBeLessThanOrEqual(1);
      expect(expectation.minOverallConfidence).toBeGreaterThanOrEqual(0);
      expect(expectation.minOverallConfidence).toBeLessThanOrEqual(1);
      expect(Array.isArray(expectation.expectedEvidenceTiersAllowed)).toBe(true);
      for (const tier of expectation.expectedEvidenceTiersAllowed) {
        expect(ALLOWED_EVIDENCE_TIERS.has(tier)).toBe(true);
      }
    }
  );
});

// ─── Live baseline eval ──────────────────────────────────────────────────────
//
// Deliberately lightweight in Wave 1 — we only want a pinned "this is what the
// current pipeline produces for each scan anchor" snapshot. No assertions
// against the expectations yet (those land in Wave 5 once the vision-primary
// path exists and the gate is enforced).

const LIVE_EVAL_ENABLED = process.env.GOLDEN_SCAN_EVAL === "1";

describe.runIf(LIVE_EVAL_ENABLED)("golden scan subset — live baseline (GOLDEN_SCAN_EVAL=1)", () => {
  it("runs each live anchor through runContractUnderstandingPipeline and writes a baseline report", async () => {
    const { runContractUnderstandingPipeline } = await import("../contract-understanding-pipeline");

    const manifest = loadManifest();
    const live = manifest.entries.filter((e) => e.status === "live");

    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const outDir = join(evalOutDir, `scan-subset-${ts}`);
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

    type Row = {
      id: string;
      anchor: string;
      ok: boolean;
      elapsedMs: number;
      recoveredFromImage: number;
      recoveredFromFullVision: number;
      totalFieldsWithValue: number;
      skippedReason?: string;
      error?: string;
    };
    const rows: Row[] = [];

    for (const entry of live) {
      const absAnchor = join(repoRoot, entry.anchor);
      if (!existsSync(absAnchor)) {
        rows.push({
          id: entry.id,
          anchor: entry.anchor,
          ok: false,
          elapsedMs: 0,
          recoveredFromImage: 0,
          recoveredFromFullVision: 0,
          totalFieldsWithValue: 0,
          skippedReason: "fixture_file_missing",
        });
        continue;
      }

      const expectation = loadExpectation(entry.expectationFile);
      const t0 = Date.now();
      try {
        // We intentionally pass just the file path; the caller is expected to have a
        // loopback PDF server set up when hitting `runContractUnderstandingPipeline`
        // with network-only providers. Baseline mode tolerates this failing — the
        // point is to capture today's behavior, not to gate merges.
        const result = (await runContractUnderstandingPipeline({
          fileUrl: `file://${absAnchor}`,
          mimeType: "application/pdf",
          sourceFileName: entry.anchor.split("/").pop() ?? entry.anchor,
          documentTypeHint: expectation.documentTypeHint,
        } as never)) as unknown as {
          ok?: boolean;
          extractedPayload?: { extractedFields?: Record<string, { value?: unknown; evidenceTier?: string }> };
        };

        const fields = result?.extractedPayload?.extractedFields ?? {};
        let rfi = 0;
        let rfv = 0;
        let total = 0;
        for (const field of Object.values(fields)) {
          const v = field?.value;
          const has = v !== null && v !== undefined && !(typeof v === "string" && v.trim() === "");
          if (!has) continue;
          total += 1;
          if (field?.evidenceTier === "recovered_from_image") rfi += 1;
          if (field?.evidenceTier === "recovered_from_full_vision") rfv += 1;
        }
        rows.push({
          id: entry.id,
          anchor: entry.anchor,
          ok: result?.ok === true,
          elapsedMs: Date.now() - t0,
          recoveredFromImage: rfi,
          recoveredFromFullVision: rfv,
          totalFieldsWithValue: total,
        });
      } catch (e) {
        rows.push({
          id: entry.id,
          anchor: entry.anchor,
          ok: false,
          elapsedMs: Date.now() - t0,
          recoveredFromImage: 0,
          recoveredFromFullVision: 0,
          totalFieldsWithValue: 0,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    writeFileSync(join(outDir, "baseline.json"), JSON.stringify(rows, null, 2), "utf-8");
    const md = [
      "# Scan subset baseline",
      "",
      `Generated: ${ts}`,
      "",
      "| id | anchor | ok | elapsedMs | recovered_from_image | recovered_from_full_vision | totalFieldsWithValue | skip/error |",
      "|---|---|---|---|---|---|---|---|",
      ...rows.map(
        (r) =>
          `| ${r.id} | ${r.anchor} | ${r.ok ? "✓" : "✗"} | ${r.elapsedMs} | ${r.recoveredFromImage} | ${r.recoveredFromFullVision} | ${r.totalFieldsWithValue} | ${r.skippedReason ?? r.error ?? ""} |`
      ),
      "",
    ].join("\n");
    writeFileSync(join(outDir, "baseline.md"), md, "utf-8");

    expect(rows.length).toBe(live.length);
  }, 600_000);
});
