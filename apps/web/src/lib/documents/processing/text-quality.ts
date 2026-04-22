/**
 * Text-layer quality heuristic for AI Review.
 *
 * A PDF may return non-empty text from `pdf-parse` but the content is actually
 * broken OCR noise ("Jt-fekta", "ObchOdnfk", "Kontoktnfodr", "cennyml paptry"),
 * because the original scanner embedded a garbled text layer. Length-only
 * heuristics cannot tell the difference and force the pipeline down the
 * `text_pdf` branch, where the LLM gets garbage as `documentText` and fails to
 * extract anything.
 *
 * This module scores the likelihood that a text blob is real, readable
 * document text (Czech or English) vs. OCR/encoding garbage. The score is used
 * by the scan gate and the AI Review pipeline to force the vision / file /
 * page-image path when the text layer is unreliable.
 *
 * Pure, synchronous, no I/O, no imports — safe to call from anywhere.
 */

export type TextQualityResult = {
  /** 0 = pure garbage, 1 = clean text. */
  score: number;
  /** True when `score < minGarbageScore` (default 0.4). */
  isLikelyGarbage: boolean;
  /** Human-readable reason codes for trace / debug. */
  reasons: string[];
  /** Derived metrics, kept for telemetry and debugging. */
  metrics: {
    totalWords: number;
    suspiciousCaseWordRatio: number;
    noVowelWordRatio: number;
    stopwordRatio: number;
    nonAlphaRatio: number;
    weirdCharRatio: number;
    singleCharRunMax: number;
    avgWordLength: number;
    /** Ratio of words with a digit surrounded by letters ("Brn6", "Jm6no", "t11k6"). */
    digitInWordRatio: number;
    /** Ratio of words that contain at least one letter and at least one digit in non-numeric form. */
    mixedAlnumWordRatio: number;
  };
};

const DEFAULT_GARBAGE_THRESHOLD = 0.4;

/** Czech + English stopwords — presence in normal text is extremely high. */
const STOPWORDS = new Set([
  // Czech
  "a",
  "i",
  "v",
  "ve",
  "s",
  "se",
  "z",
  "ze",
  "k",
  "ku",
  "o",
  "u",
  "na",
  "do",
  "od",
  "po",
  "za",
  "pro",
  "je",
  "jsou",
  "byl",
  "byla",
  "bylo",
  "byli",
  "byly",
  "byt",
  "být",
  "ale",
  "nebo",
  "jak",
  "jako",
  "co",
  "ze",
  "že",
  "aby",
  "který",
  "ktera",
  "která",
  "kteří",
  "které",
  "tento",
  "tato",
  "toto",
  "ten",
  "ta",
  "to",
  "tyto",
  "tato",
  "tohoto",
  "této",
  "tomto",
  "jeho",
  "její",
  "jejich",
  "pokud",
  "pak",
  "tak",
  "také",
  "než",
  "při",
  "mezi",
  "bez",
  "vůči",
  "nad",
  "pod",
  "před",
  "dle",
  "podle",
  "včetně",
  "č",
  "čl",
  "čís",
  "strana",
  "stran",
  "smlouva",
  "smlouvy",
  "článek",
  "body",
  // English
  "the",
  "and",
  "of",
  "to",
  "in",
  "is",
  "for",
  "on",
  "with",
  "by",
  "as",
  "at",
  "this",
  "that",
  "from",
  "or",
  "an",
  "be",
  "are",
  "was",
  "were",
  "not",
  "will",
  "shall",
  "may",
]);

const WEIRD_CHAR_RE = /[~£§ø¶¤¢¥©®™|°¨´`ˇˆ˚˝˛˙¸•]/g;
const NON_ALPHA_RE = /[^\p{L}\p{N}\s.,;:!?()[\]{}"'/@#%&+\-=*\\]/gu;
/** Word characters for tokenisation: unicode letters + digits. */
const WORD_TOKEN_RE = /[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)*/gu;
const VOWEL_RE = /[aeiouyáéíóúůýěžščřďťňaeiouyAEIOUY]/i;
/** Letter followed by digit followed by letter inside a word — "Brn6", "Komision6fsk6". */
const LETTER_DIGIT_LETTER_RE = /\p{L}\p{N}\p{L}/u;
/** Digits inside a word with length >= 4 and at least one letter on each side. */
const MIXED_ALNUM_WORD_RE = /\p{L}\p{N}+\p{L}|\p{L}+\p{N}\p{L}+/u;

/**
 * Detects words with abnormal case transitions (camelCase-like) in the middle
 * of a word that are not legitimate (e.g. "ObchOdnfk", "Kontoktnfodr",
 * "pNpadnE"). Returns the number of suspicious transitions.
 */
function countSuspiciousCaseTransitions(word: string): number {
  if (word.length < 4) return 0;
  let transitions = 0;
  for (let i = 1; i < word.length - 1; i++) {
    const prev = word[i - 1];
    const cur = word[i];
    const next = word[i + 1];
    const prevLower = prev === prev.toLowerCase() && prev !== prev.toUpperCase();
    const curUpper = cur === cur.toUpperCase() && cur !== cur.toLowerCase();
    const nextLower = next === next.toLowerCase() && next !== next.toUpperCase();
    if (prevLower && curUpper && nextLower) {
      transitions += 1;
    }
  }
  return transitions;
}

/**
 * A word is "no-vowel suspicious" if it has >=4 letters and contains 0 vowels.
 * Tight constraint so that legitimate Czech abbreviations (č.j., IČO, DIČ,
 * FATCA) don't trigger it.
 */
function isNoVowelSuspicious(word: string): boolean {
  const letters = word.replace(/[\p{N}\-_'.]/gu, "");
  if (letters.length < 4) return false;
  return !VOWEL_RE.test(letters);
}

/**
 * Longest run of single-character "words" (a, b, c separated by whitespace).
 * Scan OCR often produces outputs like: "s m l o u v a".
 */
function longestSingleCharRun(tokens: string[]): number {
  let max = 0;
  let cur = 0;
  for (const t of tokens) {
    if (t.length === 1) {
      cur += 1;
      if (cur > max) max = cur;
    } else {
      cur = 0;
    }
  }
  return max;
}

export type ScoreOptions = {
  /** Garbage threshold for `isLikelyGarbage`. Default 0.4. */
  garbageThreshold?: number;
};

/**
 * Score the likelihood that `text` is readable document content.
 *
 * Returns a score in [0..1]:
 *   - >= 0.75 — clean native text
 *   - 0.4..0.75 — mixed / suspicious (proceed with caution)
 *   - < 0.4 — almost certainly garbage / scan OCR noise
 */
export function scoreTextLayerQuality(
  text: string | null | undefined,
  options: ScoreOptions = {}
): TextQualityResult {
  const threshold = options.garbageThreshold ?? DEFAULT_GARBAGE_THRESHOLD;
  const reasons: string[] = [];

  const normalized = (text ?? "").replace(/\s+/g, " ").trim();
  const metrics: TextQualityResult["metrics"] = {
    totalWords: 0,
    suspiciousCaseWordRatio: 0,
    noVowelWordRatio: 0,
    stopwordRatio: 0,
    nonAlphaRatio: 0,
    weirdCharRatio: 0,
    singleCharRunMax: 0,
    avgWordLength: 0,
    digitInWordRatio: 0,
    mixedAlnumWordRatio: 0,
  };

  if (!normalized) {
    return { score: 0, isLikelyGarbage: true, reasons: ["empty_text"], metrics };
  }
  if (normalized.length < 40) {
    reasons.push("too_short");
    return { score: 0.1, isLikelyGarbage: true, reasons, metrics };
  }

  const totalChars = normalized.length;
  const weirdMatches = normalized.match(WEIRD_CHAR_RE);
  const nonAlphaMatches = normalized.match(NON_ALPHA_RE);
  metrics.weirdCharRatio = (weirdMatches?.length ?? 0) / totalChars;
  metrics.nonAlphaRatio = (nonAlphaMatches?.length ?? 0) / totalChars;

  const tokens = normalized.match(WORD_TOKEN_RE) ?? [];
  metrics.totalWords = tokens.length;
  if (tokens.length < 20) {
    reasons.push("too_few_words");
    return { score: 0.2, isLikelyGarbage: true, reasons, metrics };
  }

  let totalWordLen = 0;
  let suspiciousCaseWords = 0;
  let noVowelWords = 0;
  let stopwordHits = 0;
  let digitInWordCount = 0;
  let mixedAlnumCount = 0;
  for (const token of tokens) {
    totalWordLen += token.length;
    if (countSuspiciousCaseTransitions(token) >= 1) {
      suspiciousCaseWords += 1;
    }
    if (isNoVowelSuspicious(token)) {
      noVowelWords += 1;
    }
    if (STOPWORDS.has(token.toLowerCase())) {
      stopwordHits += 1;
    }
    if (LETTER_DIGIT_LETTER_RE.test(token)) {
      digitInWordCount += 1;
    }
    // Word is "mixed" if it has letters and digits and isn't a pure-numeric id or
    // a trailing-digit token (e.g. "Praha1", "article4"). We only flag patterns
    // with digits appearing between letters (real text rarely has that).
    if (MIXED_ALNUM_WORD_RE.test(token) && token.length >= 4) {
      mixedAlnumCount += 1;
    }
  }
  metrics.avgWordLength = totalWordLen / tokens.length;
  metrics.suspiciousCaseWordRatio = suspiciousCaseWords / tokens.length;
  metrics.noVowelWordRatio = noVowelWords / tokens.length;
  metrics.stopwordRatio = stopwordHits / tokens.length;
  metrics.digitInWordRatio = digitInWordCount / tokens.length;
  metrics.mixedAlnumWordRatio = mixedAlnumCount / tokens.length;

  const rawTokens = normalized.split(/\s+/).filter(Boolean);
  metrics.singleCharRunMax = longestSingleCharRun(rawTokens);

  let score = 1.0;

  if (metrics.weirdCharRatio > 0.01) {
    score -= Math.min(0.25, metrics.weirdCharRatio * 8);
    reasons.push(`weird_chars_${metrics.weirdCharRatio.toFixed(3)}`);
  }

  if (metrics.nonAlphaRatio > 0.05) {
    score -= Math.min(0.2, (metrics.nonAlphaRatio - 0.05) * 4);
    reasons.push(`non_alpha_${metrics.nonAlphaRatio.toFixed(3)}`);
  }

  if (metrics.suspiciousCaseWordRatio > 0.02) {
    const penalty = Math.min(0.45, metrics.suspiciousCaseWordRatio * 5);
    score -= penalty;
    reasons.push(`camelcase_${metrics.suspiciousCaseWordRatio.toFixed(3)}`);
  }

  if (metrics.noVowelWordRatio > 0.08) {
    const penalty = Math.min(0.3, (metrics.noVowelWordRatio - 0.05) * 2);
    score -= penalty;
    reasons.push(`no_vowel_${metrics.noVowelWordRatio.toFixed(3)}`);
  }

  if (metrics.stopwordRatio < 0.03) {
    const missing = 0.03 - metrics.stopwordRatio;
    score -= Math.min(0.4, missing * 12);
    reasons.push(`low_stopwords_${metrics.stopwordRatio.toFixed(3)}`);
  } else if (metrics.stopwordRatio >= 0.06) {
    reasons.push(`ok_stopwords_${metrics.stopwordRatio.toFixed(3)}`);
  }

  if (metrics.singleCharRunMax >= 5) {
    score -= Math.min(0.2, (metrics.singleCharRunMax - 4) * 0.04);
    reasons.push(`single_char_run_${metrics.singleCharRunMax}`);
  }

  if (metrics.avgWordLength < 2.2 || metrics.avgWordLength > 14) {
    score -= 0.1;
    reasons.push(`avg_word_len_${metrics.avgWordLength.toFixed(2)}`);
  }

  // Digits inside words — strong OCR-garbage signal. Normal text has <1%.
  if (metrics.digitInWordRatio > 0.01) {
    const penalty = Math.min(0.5, metrics.digitInWordRatio * 10);
    score -= penalty;
    reasons.push(`digit_in_word_${metrics.digitInWordRatio.toFixed(3)}`);
  }

  // Mixed alnum words — additional signal for garbled text.
  if (metrics.mixedAlnumWordRatio > 0.02) {
    const penalty = Math.min(0.3, (metrics.mixedAlnumWordRatio - 0.02) * 6);
    score -= penalty;
    reasons.push(`mixed_alnum_${metrics.mixedAlnumWordRatio.toFixed(3)}`);
  }

  const clamped = Math.max(0, Math.min(1, score));
  const isLikelyGarbage = clamped < threshold;

  if (!isLikelyGarbage && reasons.length === 0) {
    reasons.push("clean");
  }

  return {
    score: clamped,
    isLikelyGarbage,
    reasons,
    metrics,
  };
}

/**
 * Env-tunable threshold so operators can dial sensitivity without a redeploy.
 * `AI_REVIEW_TEXT_QUALITY_MIN_SCORE` — default 0.4.
 */
export function getTextQualityGarbageThreshold(): number {
  const raw = process.env.AI_REVIEW_TEXT_QUALITY_MIN_SCORE;
  if (!raw) return DEFAULT_GARBAGE_THRESHOLD;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= 1) {
    return DEFAULT_GARBAGE_THRESHOLD;
  }
  return parsed;
}
