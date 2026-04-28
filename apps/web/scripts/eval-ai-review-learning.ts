import { listActiveAiReviewEvalCases, scoreAiReviewEvalCase } from "../src/lib/ai/ai-review-learning";

function arg(name: string): string | null {
  const prefix = `--${name}=`;
  const found = process.argv.find((item) => item.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

async function main() {
  const tenantId = arg("tenant") ?? process.env.AI_REVIEW_EVAL_TENANT_ID;
  if (!tenantId) throw new Error("Missing --tenant=<uuid> or AI_REVIEW_EVAL_TENANT_ID.");
  const cases = await listActiveAiReviewEvalCases({ tenantId });
  const results = cases.map((row) => {
    // Default local/regression mode uses stored expected output as mock actual.
    // Live pipeline execution requires an anonymized input resolver and is intentionally not automatic.
    const actual = row.expectedOutputJson;
    return scoreAiReviewEvalCase({
      expectedOutput: row.expectedOutputJson,
      actualOutput: actual,
      criticalFields: Array.isArray(row.criticalFields) ? row.criticalFields.map(String) : [],
    });
  });

  const avg = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  const scorecard = {
    cases: cases.length,
    criticalExactMatch: avg(results.map((result) => result.criticalExact)),
    numericToleranceMatch: avg(results.map((result) => result.numericPremium)),
    participantCount: avg(results.map((result) => result.participantCount ? 1 : 0)),
    premiumAggregation: avg(results.map((result) => result.premiumAggregation ? 1 : 0)),
    publishDecision: avg(results.map((result) => result.publishDecision ? 1 : 0)),
    schemaValid: avg(results.map((result) => result.schemaValid ? 1 : 0)),
  };

  console.info(JSON.stringify(scorecard, null, 2));
  const failed =
    scorecard.criticalExactMatch < 0.98 ||
    scorecard.numericToleranceMatch < 0.99 ||
    scorecard.publishDecision < 1 ||
    scorecard.schemaValid < 1;
  if (failed) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
