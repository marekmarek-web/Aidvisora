/**
 * L9: lightweight prompt-injection heuristics for advisor assistant text.
 *
 * This is an ADVISORY signal only — we never drop requests, but we log
 * telemetry so ops can review attempts. A more robust check (scanning
 * OCR'd image text and attached documents) is planned once the assistant
 * moves beyond text-only advisor chat.
 *
 * Patterns are intentionally conservative: they must be phrased as explicit
 * instructions to the model. Plain mentions of "system prompt" or "role" in
 * normal advisor speech should NOT match.
 */

export type PromptInjectionHeuristicHit = {
  pattern: string;
  preview: string;
};

/**
 * Known adversarial patterns. Kept Czech + English because the assistant
 * ships in cs-CZ but advisors frequently paste bilingual content.
 */
const INJECTION_PATTERNS: Array<{ id: string; re: RegExp }> = [
  { id: "ignore_previous", re: /\bignore\s+(all\s+)?previous\s+(instructions|prompts?)\b/i },
  { id: "ignore_all_above", re: /\bignore\s+everything\s+above\b/i },
  { id: "reveal_system_prompt", re: /\b(reveal|show|print|dump)\s+(the\s+)?(system|developer)\s+prompt\b/i },
  { id: "act_as_jailbreak", re: /\b(act\s+as|role-?play\s+as)\s+(dan|a\s+developer|an\s+unrestricted)\b/i },
  { id: "cs_ignore_prev", re: /\bignoruj\s+(všechny\s+)?předchozí\s+(pokyny|instrukce)\b/i },
  { id: "cs_reveal_system", re: /\b(ukaž|odhal|vypiš)\s+(systémový|developer)\s+prompt\b/i },
  { id: "begin_new_instructions", re: /#{2,}\s*begin\s+new\s+instructions/i },
  { id: "pretend_you_are", re: /\bpretend\s+you\s+are\s+(a\s+different|another)\s+(ai|assistant|model)\b/i },
];

export function detectPromptInjectionHeuristics(
  text: string | null | undefined,
): PromptInjectionHeuristicHit[] {
  if (!text) return [];
  const sample = text.slice(0, 16_384);
  const hits: PromptInjectionHeuristicHit[] = [];
  for (const { id, re } of INJECTION_PATTERNS) {
    const m = re.exec(sample);
    if (m) {
      const start = Math.max(0, m.index - 20);
      const end = Math.min(sample.length, m.index + m[0].length + 20);
      hits.push({
        pattern: id,
        preview: sample.slice(start, end).replace(/\s+/g, " ").trim(),
      });
    }
  }
  return hits;
}
