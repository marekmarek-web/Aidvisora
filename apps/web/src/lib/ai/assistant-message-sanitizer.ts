/**
 * Sanitizes assistant response text before it reaches the advisor UI.
 * Strips internal debug tokens, raw JSON tool results, orchestration markers,
 * and technical identifiers that must never be visible to the end user.
 */

/**
 * Strips `[RESULT:toolName] { ... JSON ... }` blocks (with balanced braces)
 * including an optional trailing `Warnings:` line.
 */
function stripToolResultBlocks(text: string): string {
  const marker = "[RESULT:";
  let result = "";
  let i = 0;

  while (i < text.length) {
    const start = text.indexOf(marker, i);
    if (start === -1) {
      result += text.slice(i);
      break;
    }
    result += text.slice(i, start);

    const jsonStart = text.indexOf("{", start);
    const lineEnd = text.indexOf("\n", start);

    if (jsonStart === -1 || (lineEnd !== -1 && lineEnd < jsonStart)) {
      i = lineEnd === -1 ? text.length : lineEnd + 1;
      continue;
    }

    let depth = 0;
    let j = jsonStart;
    for (; j < text.length; j++) {
      if (text[j] === "{") depth++;
      else if (text[j] === "}") {
        depth--;
        if (depth === 0) {
          j++;
          break;
        }
      }
    }

    i = j;
    if (i < text.length && text[i] === "\n") i++;
    if (i < text.length && text.startsWith("Warnings:", i)) {
      const wEnd = text.indexOf("\n", i);
      i = wEnd === -1 ? text.length : wEnd + 1;
    }
  }

  return result;
}

const TOOL_CALL_RE = /\[TOOL:\w+[^\]]*\]/g;
const TOOL_ERROR_RE = /\[Nástroj \w+ selhal\]/g;
const ENTITY_REF_RE = /\[(review|task|client|payment|contact|opportunity):[a-f0-9-]+\]/gi;
const STATUS_BRACKET_RE =
  /\[(requires_confirmation|confirmed|executing|skipped|succeeded|failed|completed|awaiting_confirmation|draft)\]/gi;
const RAW_ID_LINE_RE =
  /^(dealId|taskId|contactId|opportunityId|entityId|reviewId|sourceId)\s*:\s*\S+\s*$/gm;
const INTERNAL_DIAGNOSTIC_RE =
  /^(Volám|Hledám|Načítám|Spouštím|Kontroluji)\s[^\n]*\.{3}\s*$/gm;
const MULTI_BLANK_RE = /\n{3,}/g;

export function sanitizeAssistantMessageForAdvisor(raw: string): string {
  if (!raw) return raw;

  let text = raw;

  text = stripToolResultBlocks(text);
  text = text.replace(/\[RESULT:\w+\][^\n]*/g, "");
  text = text.replace(TOOL_CALL_RE, "");
  text = text.replace(TOOL_ERROR_RE, "");
  text = text.replace(ENTITY_REF_RE, "");
  text = text.replace(STATUS_BRACKET_RE, "");
  text = text.replace(RAW_ID_LINE_RE, "");
  text = text.replace(INTERNAL_DIAGNOSTIC_RE, "");
  text = text.replace(MULTI_BLANK_RE, "\n\n");

  return text.trim();
}
