/**
 * Coerce LLM JSON toward documentReviewEnvelopeSchema before Zod parse.
 * Reduces soft-fail stubs when the model drifts slightly on enums or empty subtype.
 */

import { PRIMARY_DOCUMENT_TYPES, DOCUMENT_LIFECYCLE_STATUSES } from "./document-review-types";

const PRIMARY_SET = new Set<string>(PRIMARY_DOCUMENT_TYPES);
const LIFECYCLE_SET = new Set<string>(DOCUMENT_LIFECYCLE_STATUSES);

/** Lowercase keys; map to canonical lifecycle enum values. */
const LIFECYCLE_ALIASES: Record<string, string> = {
  illustration_phase: "illustration",
  modelace: "modelation",
  návrh: "proposal",
  navrh: "proposal",
  nabidka: "offer",
  nabídka: "offer",
  projekce: "non_binding_projection",
  nezávazná_projekce: "non_binding_projection",
  nezavazna_projekce: "non_binding_projection",
  non_binding: "non_binding_projection",
  nezávazné: "non_binding_projection",
};

export type EnvelopeCoerceMode = "light" | "aggressive";

export type CoerceEnvelopeOptions = {
  mode: EnvelopeCoerceMode;
  /** When set and valid, used to fix or align documentClassification.primaryType. */
  expectedPrimaryType?: string;
};

function deepCloneJson<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/**
 * Returns a cloned object with documentClassification coerced. Non-objects are returned as-is.
 */
export function coerceReviewEnvelopeParsedJson(input: unknown, options: CoerceEnvelopeOptions): unknown {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return input;
  }
  const root = deepCloneJson(input) as Record<string, unknown>;
  const dcIn = root.documentClassification;
  if (!dcIn || typeof dcIn !== "object" || Array.isArray(dcIn)) {
    return root;
  }
  const dc = { ...(dcIn as Record<string, unknown>) };
  const exp = options.expectedPrimaryType;

  if (exp && PRIMARY_SET.has(exp)) {
    if (options.mode === "aggressive") {
      dc.primaryType = exp;
    } else {
      const pt = dc.primaryType;
      if (typeof pt !== "string" || !PRIMARY_SET.has(pt)) {
        dc.primaryType = exp;
      }
    }
  } else if (options.mode === "aggressive") {
    const pt = dc.primaryType;
    if (typeof pt !== "string" || !PRIMARY_SET.has(pt)) {
      dc.primaryType = "unsupported_or_unknown";
    }
  }

  if (dc.subtype === "" || dc.subtype === null) {
    delete dc.subtype;
  }

  const lcRaw = dc.lifecycleStatus;
  if (typeof lcRaw === "string") {
    const trimmed = lcRaw.trim();
    const normKey = trimmed.toLowerCase().replace(/\s+/g, "_");
    const aliased = LIFECYCLE_ALIASES[normKey];
    if (aliased && LIFECYCLE_SET.has(aliased)) {
      dc.lifecycleStatus = aliased;
    } else if (LIFECYCLE_SET.has(trimmed)) {
      dc.lifecycleStatus = trimmed;
    } else if (LIFECYCLE_SET.has(normKey)) {
      dc.lifecycleStatus = normKey;
    } else if (options.mode === "aggressive") {
      dc.lifecycleStatus = "unknown";
    }
  }

  root.documentClassification = dc;
  return root;
}
