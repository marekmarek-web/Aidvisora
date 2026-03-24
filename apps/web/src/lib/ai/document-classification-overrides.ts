/**
 * Plan 3 §7.3 — rule-based classification overrides from short OCR/markdown text.
 * Does not replace the model; only adjusts type when markers are very strong.
 */

import type { PrimaryDocumentType } from "./document-review-types";
import type { ClassificationResult } from "./document-classification";

export type ClassificationOverrideResult = {
  classification: ClassificationResult;
  overrideApplied: boolean;
  classificationOverrideReason?: string;
};

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

type Rule = {
  id: string;
  /** Minimum number of marker groups that must match */
  minHits: number;
  markers: RegExp[];
  targetType: PrimaryDocumentType;
};

const RULES: Rule[] = [
  {
    id: "payment_iban_vs",
    minHits: 2,
    markers: [
      /platebn[ií]\s+instruk/i,
      /\biban\b/i,
      /variabiln[ií]\s+symbol|vs[\s:.]*[0-9]/i,
    ],
    targetType: "payment_instruction",
  },
  {
    id: "loan_rpsn",
    minHits: 2,
    markers: [/smlouva\s+o\s+úvěru|uveru|spotřebitelský\s+úvěr/i, /\brpsn\b/i, /výše\s+úvěru|vyse\s+uveru/i],
    targetType: "consumer_loan_contract",
  },
  {
    id: "bank_statement",
    minHits: 2,
    markers: [/výpis\s+z\s+účtu|vypis\s+z\s+uctu|bankovní\s+výpis/i, /počáteční\s+zůstatek|pocatecni\s+zustatek/i, /konečný\s+zůstatek|konecny\s+zustatek/i],
    targetType: "bank_statement",
  },
  {
    id: "modelace_disclaimer",
    minHits: 2,
    markers: [/detailn[ií]\s+nabídka|detailni\s+nabidka/i, /nejedná\s+se\s+o\s+nabídku|modelace|ilustrace/i],
    targetType: "life_insurance_modelation",
  },
  {
    id: "insurance_contract_headers",
    minHits: 2,
    markers: [/pojistn[aá]\s+smlouva/i, /pojistitel/i, /číslo\s+pojistné\s+smlouvy|cislo\s+pojistne\s+smlouvy/i],
    targetType: "life_insurance_contract",
  },
];

export function applyRuleBasedClassificationOverride(
  classification: ClassificationResult,
  textSnippet: string | null | undefined
): ClassificationOverrideResult {
  if (!textSnippet || textSnippet.trim().length < 40) {
    return { classification, overrideApplied: false };
  }

  const haystack = norm(textSnippet.slice(0, 24_000));

  for (const rule of RULES) {
    let hits = 0;
    for (const re of rule.markers) {
      if (re.test(haystack)) hits++;
    }
    if (hits >= rule.minHits) {
      if (classification.primaryType === rule.targetType) {
        return { classification, overrideApplied: false };
      }
      return {
        classification: {
          ...classification,
          primaryType: rule.targetType,
          reasons: [
            `rule_override:${rule.id}`,
            ...classification.reasons.filter((r) => !r.startsWith("rule_override:")),
          ],
          confidence: Math.max(classification.confidence, 0.72),
        },
        overrideApplied: true,
        classificationOverrideReason: rule.id,
      };
    }
  }

  return { classification, overrideApplied: false };
}
