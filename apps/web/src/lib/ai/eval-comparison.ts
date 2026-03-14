/**
 * Comparison helper: extracted vs corrected payload for eval and feedback loop.
 */

import type { ExtractionComparisonResult } from "./eval-types";

function getLeafPaths(obj: unknown, prefix = ""): string[] {
  if (obj == null) return prefix ? [prefix] : [];
  if (Array.isArray(obj)) {
    return obj.flatMap((item, i) => getLeafPaths(item, `${prefix}[${i}]`));
  }
  if (typeof obj === "object") {
    return Object.entries(obj).flatMap(([k, v]) =>
      getLeafPaths(v, prefix ? `${prefix}.${k}` : k)
    );
  }
  return prefix ? [prefix] : [];
}

function getByPath(obj: unknown, path: string): unknown {
  const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
  let current: unknown = obj;
  for (const p of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[p];
  }
  return current;
}

/**
 * Compare extracted payload to corrected payload.
 * Returns list of changed field paths and a delta map.
 */
export function compareExtractedToCorrected(
  extracted: Record<string, unknown>,
  corrected: Record<string, unknown>
): ExtractionComparisonResult {
  const allPaths = new Set([
    ...getLeafPaths(extracted),
    ...getLeafPaths(corrected),
  ]);
  const changedFields: string[] = [];
  const delta: Record<string, { from: unknown; to: unknown }> = {};
  const addedInCorrection: string[] = [];
  const removedInCorrection: string[] = [];

  for (const path of allPaths) {
    const fromVal = getByPath(extracted, path);
    const toVal = getByPath(corrected, path);
    const fromEmpty = fromVal === undefined || fromVal === null || fromVal === "";
    const toEmpty = toVal === undefined || toVal === null || toVal === "";
    if (fromEmpty && !toEmpty) {
      addedInCorrection.push(path);
      changedFields.push(path);
      delta[path] = { from: fromVal, to: toVal };
    } else if (!fromEmpty && toEmpty) {
      removedInCorrection.push(path);
      changedFields.push(path);
      delta[path] = { from: fromVal, to: toVal };
    } else if (JSON.stringify(fromVal) !== JSON.stringify(toVal)) {
      changedFields.push(path);
      delta[path] = { from: fromVal, to: toVal };
    }
  }

  return {
    changedFields,
    delta,
    addedInCorrection,
    removedInCorrection,
  };
}
