#!/usr/bin/env node
/**
 * CLI: local AI Review batch regression lab.
 * Usage: pnpm ai-review:batch -- --input "<dir>" --output "<dir>"
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { register } from "tsconfig-paths";
import { loadEnvLocal } from "./load-env-local";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");

register({
  baseUrl: projectRoot,
  paths: {
    "@/*": ["./src/*"],
    db: ["./src/lib/db.ts"],
    "server-only": ["./src/lib/test-shims/server-only.ts"],
  },
});

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      input: { type: "string", short: "i" },
      output: { type: "string", short: "o" },
      tenant: { type: "string" },
      delay: { type: "string" },
    },
    allowPositionals: false,
  });

  const input = values.input?.trim();
  const output = values.output?.trim();
  if (!input || !output) {
    console.error(
      "Usage: pnpm ai-review:batch -- --input <pdf-folder> --output <report-folder> [--tenant <uuid>] [--delay <ms>]"
    );
    process.exit(1);
  }

  process.chdir(projectRoot);
  loadEnvLocal(projectRoot);

  const { runAiReviewBatchLab } = await import("../src/lib/ai/tools/ai-review-batch-lab");

  const delayMs = values.delay != null ? Math.max(0, Number(values.delay) || 0) : undefined;
  const tenantId = values.tenant?.trim() || undefined;

  const summary = await runAiReviewBatchLab({
    inputRoot: path.resolve(input),
    outputDir: path.resolve(output),
    tenantId: tenantId ?? null,
    delayMs,
  });

  console.info(
    `[ai-review:batch] Done. files=${summary.fileCount} GREEN=${summary.traffic.GREEN} YELLOW=${summary.traffic.YELLOW} RED=${summary.traffic.RED}`
  );
  console.info(`[ai-review:batch] JSON: ${path.join(summary.outputDir, "results.json")}`);
  console.info(`[ai-review:batch] MD:   ${path.join(summary.outputDir, "report.md")}`);
  console.info(`[ai-review:batch] HTML: ${path.join(summary.outputDir, "report.html")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
