import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildFineTuneDatasetRows } from "../src/lib/ai/ai-review-learning";

function arg(name: string): string | null {
  const prefix = `--${name}=`;
  const found = process.argv.find((item) => item.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

async function main() {
  const tenantId = arg("tenant") ?? process.env.AI_REVIEW_EXPORT_TENANT_ID;
  const outputDir = arg("output") ?? "../../fixtures/golden-ai-review/eval-outputs/learning-export";
  const consent = process.env.AI_REVIEW_FINETUNE_EXPORT_CONSENT === "1";
  if (!tenantId) throw new Error("Missing --tenant=<uuid> or AI_REVIEW_EXPORT_TENANT_ID.");
  const rows = await buildFineTuneDatasetRows({ tenantId, requireConsent: consent });
  const train = rows.filter((row) => row.split === "train");
  const holdout = rows.filter((row) => row.split === "holdout");
  const absOutput = path.resolve(process.cwd(), outputDir);
  await mkdir(absOutput, { recursive: true });
  await writeFile(path.join(absOutput, "train.jsonl"), train.map((row) => JSON.stringify(row)).join("\n") + "\n");
  await writeFile(path.join(absOutput, "holdout.jsonl"), holdout.map((row) => JSON.stringify(row)).join("\n") + "\n");
  console.info(JSON.stringify({ outputDir: absOutput, train: train.length, holdout: holdout.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
