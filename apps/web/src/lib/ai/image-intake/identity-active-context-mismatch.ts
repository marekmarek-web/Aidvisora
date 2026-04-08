/**
 * Compare identity extracted from a document vs. the display name of the CRM contact
 * open in context (route/session). Conservative: mismatch only when both sides have
 * enough signal and tokens clearly disagree.
 */

export function normalizePersonNameForCompare(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, " ")
    .trim();
}

function tokenSet(label: string | null | undefined): Set<string> {
  if (!label?.trim()) return new Set();
  const norm = normalizePersonNameForCompare(label);
  return new Set(norm.split(/\s+/).filter((t) => t.length >= 2));
}

export type IdentityActiveContextCompareResult =
  | { verdict: "match" }
  | { verdict: "mismatch"; reason: string }
  | { verdict: "inconclusive"; reason: string };

/**
 * Returns `mismatch` when extracted first+last name clearly do not match the active contact label.
 */
export function identityDocumentLikelyMatchesActiveContact(params: {
  extractedFirstName: string | null | undefined;
  extractedLastName: string | null | undefined;
  activeContactDisplayLabel: string | null | undefined;
}): IdentityActiveContextCompareResult {
  const fn = params.extractedFirstName?.trim() ?? "";
  const ln = params.extractedLastName?.trim() ?? "";
  const active = params.activeContactDisplayLabel?.trim() ?? "";

  if (!fn || !ln) {
    return { verdict: "inconclusive", reason: "missing_extracted_name" };
  }
  if (!active || active.length < 3) {
    return { verdict: "inconclusive", reason: "missing_active_label" };
  }

  const docTokens = tokenSet(`${fn} ${ln}`);
  const activeTokens = tokenSet(active);
  if (docTokens.size === 0 || activeTokens.size === 0) {
    return { verdict: "inconclusive", reason: "empty_tokens" };
  }

  let shared = 0;
  for (const t of docTokens) {
    if (activeTokens.has(t)) shared++;
  }

  if (shared >= 2) {
    return { verdict: "match" };
  }

  if (shared === 1) {
    const sharedToken = [...docTokens].find((t) => activeTokens.has(t));
    if (sharedToken && sharedToken.length >= 5) {
      return { verdict: "match" };
    }
  }

  if (docTokens.size >= 2 && activeTokens.size >= 2 && shared === 0) {
    return { verdict: "mismatch", reason: "no_token_overlap" };
  }

  return { verdict: "inconclusive", reason: "weak_signal" };
}
