/**
 * Anthropic adapter for AI Review extraction pipeline.
 *
 * Used exclusively when AI_REVIEW_PROVIDER=anthropic.
 * Mirrors the interface of the relevant functions in @/lib/openai
 * so the provider layer can swap them transparently.
 *
 * For prompt-based calls (originally OpenAI Prompt Builder pmpt_*),
 * the adapter renders the locally-defined template content from
 * `ai-review-prompt-templates-content.ts` and substitutes {{variable}} placeholders.
 * This avoids any dependency on OpenAI Prompt Builder when using Anthropic.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { CreateResponseResult } from "@/lib/openai";
import type { AiReviewPromptKey } from "./prompt-model-registry";
import { getPromptTemplateContent } from "./ai-review-prompt-templates-content";

// ─── Config ──────────────────────────────────────────────────────────────────

const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-20250514";
const ANTHROPIC_TIMEOUT_MS = 120_000;
const ANTHROPIC_MAX_TOKENS = 16_000;

export function resolveAnthropicModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL;
}

// ─── Client singleton ─────────────────────────────────────────────────────────

let _client: Anthropic | null = null;

function getAnthropicClient(): Anthropic | null {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;
  _client = new Anthropic({ apiKey, timeout: ANTHROPIC_TIMEOUT_MS });
  return _client;
}

export function hasAnthropicKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

// ─── Logging ─────────────────────────────────────────────────────────────────

export function logAnthropicCall(params: {
  endpoint: string;
  model: string;
  latencyMs: number;
  success: boolean;
  inputTokens?: number;
  outputTokens?: number;
  error?: string;
}): void {
  console.info("[Anthropic]", JSON.stringify({
    endpoint: params.endpoint,
    model: params.model,
    latencyMs: params.latencyMs,
    success: params.success,
    ...(params.inputTokens != null ? { inputTokens: params.inputTokens } : {}),
    ...(params.outputTokens != null ? { outputTokens: params.outputTokens } : {}),
    ...(params.error ? { error: params.error.slice(0, 200) } : {}),
  }));
}

// ─── Template rendering ───────────────────────────────────────────────────────

/**
 * Substitute {{variable}} placeholders with values from the variables map.
 * Unknown placeholders are replaced with "(not available)".
 */
function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
    const val = variables[name];
    return typeof val === "string" && val.trim() ? val : "(not available)";
  });
}

// ─── Core call ───────────────────────────────────────────────────────────────

/**
 * Send a system+user message to Claude and return text.
 * Throws on hard failure; logs latency.
 */
async function callClaude(
  systemPrompt: string,
  userContent: string,
  endpoint: string,
): Promise<string> {
  const client = getAnthropicClient();
  if (!client) {
    throw new Error("ANTHROPIC_API_KEY není nastaven. Nastavte ho v .env.local.");
  }
  const model = resolveAnthropicModel();
  const start = Date.now();
  try {
    const message = await client.messages.create({
      model,
      max_tokens: ANTHROPIC_MAX_TOKENS,
      system: systemPrompt,
      messages: [
        { role: "user", content: userContent },
      ],
    });
    const latencyMs = Date.now() - start;
    const usage = message.usage;
    logAnthropicCall({
      endpoint,
      model,
      latencyMs,
      success: true,
      inputTokens: usage?.input_tokens,
      outputTokens: usage?.output_tokens,
    });
    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n")
      .trim();
    if (!text) throw new Error("Prázdná odpověď od Claude.");
    return text;
  } catch (err) {
    const latencyMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    logAnthropicCall({ endpoint, model, latencyMs, success: false, error: message });
    throw err instanceof Error ? err : new Error(message);
  }
}

// ─── Public interface (matches @/lib/openai shapes) ──────────────────────────

/**
 * Drop-in replacement for `createResponse` with `routing.category === "ai_review"`.
 * Sends the full prompt as the user message with a minimal system role.
 */
export async function anthropicCreateResponse(
  input: string,
): Promise<string> {
  return callClaude(
    "Jsi AI Review systém pro extrakci dat z finančních dokumentů. Odpovídej výhradně ve formátu JSON.",
    input,
    "anthropic.createResponse",
  );
}

/**
 * Drop-in replacement for `createResponseSafe` → returns CreateResponseResult.
 */
export async function anthropicCreateResponseSafe(
  input: string,
): Promise<CreateResponseResult> {
  try {
    const text = await anthropicCreateResponse(input);
    return { ok: true, text };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/**
 * Drop-in replacement for `createAiReviewResponseFromPrompt`.
 *
 * For Anthropic path, we look up the locally defined prompt template by key,
 * render it with the provided variables, and call Claude.
 * If no local template is found for the key, we send the variables as JSON user content.
 */
export async function anthropicCreateAiReviewResponseFromPrompt(params: {
  promptKey: AiReviewPromptKey;
  promptId: string;
  version?: string | null;
  variables: Record<string, string>;
}): Promise<CreateResponseResult> {
  const { promptKey, variables } = params;
  const template = getPromptTemplateContent(promptKey);

  let systemPrompt: string;
  let userContent: string;

  if (template?.systemPrompt) {
    systemPrompt = template.systemPrompt;
    // Render all {{variable}} placeholders in the system prompt as well as build user content.
    // Primary document text is the main user turn; other vars are embedded in system prompt context.
    systemPrompt = renderTemplate(systemPrompt, variables);
    // User turn: primary content is extracted_text; fall back to serialized variables.
    userContent = variables.extracted_text || variables.text_excerpt || JSON.stringify(variables, null, 2);
  } else {
    // No template available for this key — send everything as structured user message.
    systemPrompt = `Jsi AI Review engine. Zpracuj níže uvedená data a odpověz ve formátu JSON.\nKlíč promptu: ${promptKey}`;
    userContent = JSON.stringify(variables, null, 2);
  }

  const start = Date.now();
  const model = resolveAnthropicModel();
  const client = getAnthropicClient();
  if (!client) {
    return { ok: false, error: "ANTHROPIC_API_KEY není nastaven." };
  }

  try {
    const message = await client.messages.create({
      model,
      max_tokens: ANTHROPIC_MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    });
    const latencyMs = Date.now() - start;
    logAnthropicCall({
      endpoint: `anthropic.promptKey.${promptKey}`,
      model,
      latencyMs,
      success: true,
      inputTokens: message.usage?.input_tokens,
      outputTokens: message.usage?.output_tokens,
    });
    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n")
      .trim();
    if (!text) return { ok: false, error: "Prázdná odpověď od Claude." };
    return { ok: true, text };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const errMsg = err instanceof Error ? err.message : String(err);
    logAnthropicCall({
      endpoint: `anthropic.promptKey.${promptKey}`,
      model,
      latencyMs,
      success: false,
      error: errMsg,
    });
    return { ok: false, error: errMsg };
  }
}

/**
 * Drop-in replacement for `createResponseWithFile`.
 *
 * Downloads the document from `fileUrl` as text (PDF is fetched via signed URL),
 * then sends as text content to Claude alongside the prompt.
 *
 * NOTE: First iteration uses text/markdown path.
 * For direct PDF block support, set AI_REVIEW_ANTHROPIC_PDF_BLOCK=true (experimental).
 */
export async function anthropicCreateResponseWithFile(
  fileUrl: string,
  textPrompt: string,
): Promise<string> {
  const usePdfBlock = process.env.AI_REVIEW_ANTHROPIC_PDF_BLOCK === "true";

  const model = resolveAnthropicModel();
  const client = getAnthropicClient();
  if (!client) {
    throw new Error("ANTHROPIC_API_KEY není nastaven.");
  }

  const start = Date.now();

  try {
    let userContent: Anthropic.MessageParam["content"];

    if (usePdfBlock) {
      // Experimental: fetch PDF bytes and send as base64 document block
      const resp = await fetch(fileUrl);
      if (!resp.ok) throw new Error(`Nepodařilo se stáhnout soubor: ${resp.status}`);
      const buf = await resp.arrayBuffer();
      const base64 = Buffer.from(buf).toString("base64");
      userContent = [
        {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: base64 },
        } as unknown as Anthropic.TextBlockParam,
        { type: "text", text: textPrompt },
      ];
    } else {
      // Text path: fetch URL content as text (works for presigned URLs returning text/markdown)
      const resp = await fetch(fileUrl);
      if (!resp.ok) throw new Error(`Nepodařilo se stáhnout soubor: ${resp.status}`);
      const fileText = await resp.text();
      const truncated = fileText.slice(0, 200_000); // safety cap ~200k chars
      userContent = `${textPrompt}\n\n---\n\n${truncated}`;
    }

    const message = await client.messages.create({
      model,
      max_tokens: ANTHROPIC_MAX_TOKENS,
      system: "Jsi AI Review systém pro extrakci dat z finančních dokumentů. Odpovídej výhradně ve formátu JSON.",
      messages: [{ role: "user", content: userContent }],
    });

    const latencyMs = Date.now() - start;
    logAnthropicCall({
      endpoint: "anthropic.createResponseWithFile",
      model,
      latencyMs,
      success: true,
      inputTokens: message.usage?.input_tokens,
      outputTokens: message.usage?.output_tokens,
    });

    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n")
      .trim();
    if (!text) throw new Error("Prázdná odpověď od Claude.");
    return text;
  } catch (err) {
    const latencyMs = Date.now() - start;
    const errMsg = err instanceof Error ? err.message : String(err);
    logAnthropicCall({
      endpoint: "anthropic.createResponseWithFile",
      model,
      latencyMs,
      success: false,
      error: errMsg,
    });
    throw err instanceof Error ? err : new Error(errMsg);
  }
}

/**
 * Drop-in replacement for `createResponseStructured`.
 * Sends the input to Claude and attempts JSON.parse on the response.
 * The jsonSchema is included in the system prompt as a hint for Claude.
 */
export async function anthropicCreateResponseStructured<T>(
  input: string,
  jsonSchema: Record<string, unknown>,
  options?: { schemaName?: string },
): Promise<{ text: string; parsed: T; model: string }> {
  const schemaName = options?.schemaName || "extraction";
  const model = resolveAnthropicModel();
  const systemPrompt = [
    "Jsi AI Review extrakční engine. Odpovídej VÝHRADNĚ validním JSON objektem.",
    `JSON schema (${schemaName}):`,
    JSON.stringify(jsonSchema, null, 2).slice(0, 4000),
    "Nevysvětluj, nekomentuj. Vrať jen JSON.",
  ].join("\n");

  const text = await callClaude(systemPrompt, input, `anthropic.createResponseStructured.${schemaName}`);

  // Strip markdown code fences if present
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const parsed = JSON.parse(cleaned) as T;
  return { text: cleaned, parsed, model };
}
