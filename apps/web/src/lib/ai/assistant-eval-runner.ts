/**
 * Phase 2E: eval runner for assistant golden scenarios.
 * Runs offline (in Vitest). No live LLM calls — works on deterministic
 * fixtures by calling extractCanonicalIntent / buildExecutionPlan / verifyWriteContextSafety.
 */

import { randomUUID } from "crypto";
import type {
  GoldenScenario,
  ScenarioEvalResult,
  EvalStepResult,
  AssistantEvalRunSummary,
  ExpectedIntentAssertion,
  ExpectedPlanAssertion,
  ExpectedSafetyAssertion,
} from "./assistant-eval-types";
import { emptyDomainStats } from "./assistant-eval-types";
import type { CanonicalIntent, ExecutionPlan } from "./assistant-domain-model";
import type { ContextSafetyVerdict } from "./assistant-context-safety";

export function evaluateIntent(
  actual: CanonicalIntent,
  expected: ExpectedIntentAssertion,
): EvalStepResult[] {
  const results: EvalStepResult[] = [];

  results.push({
    stepName: "intent_type",
    passed: actual.intentType === expected.intentType,
    expected: expected.intentType,
    actual: actual.intentType,
    message: actual.intentType === expected.intentType
      ? "Intent type matches"
      : `Expected ${expected.intentType}, got ${actual.intentType}`,
  });

  if (expected.productDomain !== undefined) {
    results.push({
      stepName: "product_domain",
      passed: actual.productDomain === expected.productDomain,
      expected: expected.productDomain,
      actual: actual.productDomain,
      message: actual.productDomain === expected.productDomain
        ? "Product domain matches"
        : `Expected ${expected.productDomain}, got ${actual.productDomain}`,
    });
  }

  if (expected.requiresConfirmation !== undefined) {
    results.push({
      stepName: "requires_confirmation",
      passed: actual.requiresConfirmation === expected.requiresConfirmation,
      expected: expected.requiresConfirmation,
      actual: actual.requiresConfirmation,
      message: `requiresConfirmation: expected=${expected.requiresConfirmation}, actual=${actual.requiresConfirmation}`,
    });
  }

  if (expected.switchClient !== undefined) {
    results.push({
      stepName: "switch_client",
      passed: actual.switchClient === expected.switchClient,
      expected: expected.switchClient,
      actual: actual.switchClient,
      message: `switchClient: expected=${expected.switchClient}, actual=${actual.switchClient}`,
    });
  }

  return results;
}

export function evaluatePlan(
  actual: ExecutionPlan,
  expected: ExpectedPlanAssertion,
): EvalStepResult[] {
  const results: EvalStepResult[] = [];

  results.push({
    stepName: "step_count_min",
    passed: actual.steps.length >= expected.minSteps,
    expected: `>= ${expected.minSteps}`,
    actual: actual.steps.length,
    message: `Step count: ${actual.steps.length} (min ${expected.minSteps})`,
  });

  results.push({
    stepName: "step_count_max",
    passed: actual.steps.length <= expected.maxSteps,
    expected: `<= ${expected.maxSteps}`,
    actual: actual.steps.length,
    message: `Step count: ${actual.steps.length} (max ${expected.maxSteps})`,
  });

  for (const expectedAction of expected.expectedActions) {
    const found = actual.steps.some(s => s.action === expectedAction);
    results.push({
      stepName: `has_action_${expectedAction}`,
      passed: found,
      expected: expectedAction,
      actual: found ? expectedAction : "missing",
      message: found
        ? `Action ${expectedAction} present`
        : `Expected action ${expectedAction} not found`,
    });
  }

  if (expected.forbiddenActions) {
    for (const forbidden of expected.forbiddenActions) {
      const found = actual.steps.some(s => s.action === forbidden);
      results.push({
        stepName: `no_action_${forbidden}`,
        passed: !found,
        expected: `absent: ${forbidden}`,
        actual: found ? "present" : "absent",
        message: found
          ? `Forbidden action ${forbidden} is present!`
          : `Action ${forbidden} correctly absent`,
      });
    }
  }

  if (expected.expectedContactIdPresent !== undefined) {
    const hasContact = actual.contactId != null;
    results.push({
      stepName: "contact_id_present",
      passed: hasContact === expected.expectedContactIdPresent,
      expected: expected.expectedContactIdPresent,
      actual: hasContact,
      message: `contactId present: expected=${expected.expectedContactIdPresent}, actual=${hasContact}`,
    });
  }

  if (expected.expectedStatus) {
    results.push({
      stepName: "plan_status",
      passed: actual.status === expected.expectedStatus,
      expected: expected.expectedStatus,
      actual: actual.status,
      message: `Plan status: expected=${expected.expectedStatus}, actual=${actual.status}`,
    });
  }

  return results;
}

export function evaluateSafety(
  actual: ContextSafetyVerdict,
  expected: ExpectedSafetyAssertion,
): EvalStepResult[] {
  const results: EvalStepResult[] = [];

  if (expected.mustBlock !== undefined) {
    results.push({
      stepName: "safety_blocked",
      passed: !actual.safe === expected.mustBlock,
      expected: expected.mustBlock,
      actual: !actual.safe,
      message: `Blocked: expected=${expected.mustBlock}, actual=${!actual.safe}`,
    });
  }

  if (expected.mustWarnCrossClient) {
    const hasCrossWarn = actual.warnings.some(w => w.includes("jiný klient") || w.includes("cross"));
    results.push({
      stepName: "safety_cross_client_warning",
      passed: hasCrossWarn,
      expected: true,
      actual: hasCrossWarn,
      message: hasCrossWarn ? "Cross-client warning present" : "Missing cross-client warning",
    });
  }

  if (expected.mustWarnAmbiguous) {
    const hasAmbig = actual.warnings.some(w => w.includes("nejednoznačný") || w.includes("ambiguous"));
    results.push({
      stepName: "safety_ambiguous_warning",
      passed: hasAmbig,
      expected: true,
      actual: hasAmbig,
      message: hasAmbig ? "Ambiguous warning present" : "Missing ambiguous warning",
    });
  }

  return results;
}

export function aggregateEvalRun(results: ScenarioEvalResult[]): AssistantEvalRunSummary {
  const byDomain = emptyDomainStats();
  let passed = 0;
  let failed = 0;

  for (const r of results) {
    const d = byDomain[r.domain];
    d.total++;
    if (r.passed) { d.passed++; passed++; }
    else { d.failed++; failed++; }
  }

  return {
    runId: `eval-${randomUUID().slice(0, 8)}`,
    runAt: new Date().toISOString(),
    totalScenarios: results.length,
    passed,
    failed,
    byDomain,
    results,
  };
}
