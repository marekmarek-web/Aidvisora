#!/usr/bin/env node
/**
 * benchmark-claude-review.mjs
 *
 * Standalone RAW PDF benchmark pro Claude API mimo hlavní Aidvisora app flow.
 * Pošle PDF přímo přes Anthropic Messages API (base64 document block) a uloží výstup.
 *
 * Použití:
 *   node --env-file=apps/web/.env.local scripts/benchmark-claude-review.mjs <PDF_PATH> [<PDF_PATH2> ...]
 *
 * Nebo s výchozím benchmarkovým listem (viz BENCHMARK_PDF_PATHS níže):
 *   node --env-file=apps/web/.env.local scripts/benchmark-claude-review.mjs
 *
 * Výsledky:
 *   scripts/benchmark-outputs/<filename>_<timestamp>.json
 *
 * Env:
 *   ANTHROPIC_API_KEY  — povinný
 *   ANTHROPIC_MODEL    — default: claude-sonnet-4-20250514
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";

// ─── Config ──────────────────────────────────────────────────────────────────

const MODEL = process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-20250514";
const API_KEY = process.env.ANTHROPIC_API_KEY?.trim();
const MAX_TOKENS = 8192;
const TIMEOUT_MS = 120_000;

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const OUTPUTS_DIR = resolve(__dirname, "benchmark-outputs");

// ─── Default benchmark PDFs (relative to repo root) ──────────────────────────

const REPO_ROOT = resolve(__dirname, "..");

const BENCHMARK_PDF_PATHS = [
  resolve(REPO_ROOT, "Test AI/Hanna Havdan GČP.pdf"),
  resolve(REPO_ROOT, "Test AI/AMUNDI PLATFORMA - účet CZ KLASIK - DIP (4).pdf"),
  resolve(REPO_ROOT, "Test AI/Pojistna_smlouva.pdf"),
];

// ─── Extraction prompt ───────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Jsi AI Review extrakční engine pro finanční dokumenty.
Tvůj úkol: přečti přiložený dokument a vrať POUZE validní JSON objekt — žádný markdown, žádný komentář.

Povinné klíče (vrať vždy, doplň null / [] / false pokud chybí):
{
  "document_family": "<life_insurance | investment | pension | loan | mortgage | non_life_insurance | dip | building_savings | termination | supporting | unknown>",
  "document_type": "<final_contract | proposal_modelation | amendment | payment_instruction | supporting_document | unknown>",
  "lifecycle_status": "<active | inactive | proposal | modelation | cancelled | unknown>",
  "document_intent": "<new_product | modifies_existing_product | cancels_product | provides_information | unknown>",
  "publishability": {
    "contract_publishable": "<boolean — true pouze pokud jde o finální podepsanou smlouvu>",
    "publish_blocked_reasons": ["<string array>"]
  },
  "document_meta": {
    "insurer": "<string | null>",
    "product_name": "<string | null>",
    "contract_number": "<string | null>",
    "proposal_number": "<string | null>",
    "policy_start_date": "<YYYY-MM-DD | null>",
    "policy_end_date": "<YYYY-MM-DD | null>"
  },
  "client": {
    "full_name": "<string | null>",
    "birth_date": "<YYYY-MM-DD | null>",
    "personal_id": "<string | null>",
    "address": "<string | null>",
    "email": "<string | null>",
    "phone": "<string | null>"
  },
  "participants": [
    {
      "role": "<policyholder | insured | legal_representative | beneficiary | child_insured | investor | advisor | other>",
      "full_name": "<string | null>",
      "birth_date": "<YYYY-MM-DD | null>",
      "personal_id": "<string | null>"
    }
  ],
  "product": {
    "total_monthly_premium": "<number | null>",
    "annual_premium": "<number | null>",
    "payment_frequency": "<monthly | quarterly | semi_annual | annual | single | unknown | null>",
    "currency": "<CZK | EUR | USD | null>"
  },
  "payments": {
    "bank_account": "<string | null>",
    "variable_symbol": "<string | null>",
    "iban": "<string | null>"
  },
  "investment": {
    "investment_strategy": "<string | null>",
    "investment_funds": [
      { "fund_name": "<string>", "allocation_pct": "<number | null>" }
    ],
    "total_investment_amount": "<number | null>"
  },
  "insured_risks": [
    {
      "risk_type": "<string>",
      "insured_amount": "<number | null>",
      "premium": "<number | null>",
      "insured_person": "<string | null>"
    }
  ],
  "content_flags": {
    "is_final_contract": "<boolean>",
    "is_proposal_only": "<boolean>",
    "contains_multiple_document_sections": "<boolean>",
    "contains_health_questionnaire": "<boolean>",
    "contains_aml_or_fatca": "<boolean>",
    "contains_attachment_only_section": "<boolean>",
    "contains_payment_instructions": "<boolean>"
  },
  "warnings": ["<string array — cokoliv podezřelého nebo chybějícího>"],
  "confidence": "<high | medium | low>",
  "confidence_reason": "<1–2 věty proč jsi zvolil tuto úroveň jistoty>"
}

PRAVIDLA:
- Vrať POUZE JSON, nic jiného.
- Pokud dokument je modelace / návrh smlouvy, nastav contract_publishable = false.
- DIP (Dlouhodobý investiční produkt) je document_family = "dip", NENÍ životní pojištění.
- Pokud dokument obsahuje pouze zdravotní dotazník nebo AML formulář, nastav contains_attachment_only_section = true a contract_publishable = false.
- Pokud nemůžeš přečíst text dokumentu (nečitelné skenování), nastav confidence = "low" a přidej warning "unreadable_scan".`;

const USER_PROMPT = "Extrahuj strukturovaná data z přiloženého dokumentu. Vrať POUZE JSON.";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fail(msg) {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

function slugify(filename) {
  return basename(filename)
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_\-]/g, "_")
    .slice(0, 60);
}

function saveOutput(filename, data) {
  mkdirSync(OUTPUTS_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outPath = resolve(OUTPUTS_DIR, `${slugify(filename)}_${ts}.json`);
  writeFileSync(outPath, JSON.stringify(data, null, 2), "utf-8");
  return outPath;
}

// ─── Rate limit retry ─────────────────────────────────────────────────────────

/** Wait ms before retrying on 429 */
const RATE_LIMIT_RETRY_DELAY_MS = 65_000;
const RATE_LIMIT_MAX_RETRIES = 2;

async function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

// ─── Anthropic call ───────────────────────────────────────────────────────────

async function callClaudeWithPdf(pdfPath) {
  if (!existsSync(pdfPath)) {
    throw new Error(`PDF nenalezeno: ${pdfPath}`);
  }

  const pdfBytes = readFileSync(pdfPath);
  const base64 = pdfBytes.toString("base64");
  const filename = basename(pdfPath);

  const body = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: base64,
            },
          },
          {
            type: "text",
            text: USER_PROMPT,
          },
        ],
      },
    ],
  };

  let response;
  for (let attempt = 0; attempt <= RATE_LIMIT_MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-beta": "pdfs-2024-09-25",
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (response.ok) break;

    if (response.status === 429 && attempt < RATE_LIMIT_MAX_RETRIES) {
      const retryAfter = parseInt(response.headers.get("retry-after") ?? "0", 10);
      const waitMs = retryAfter > 0 ? retryAfter * 1000 + 1000 : RATE_LIMIT_RETRY_DELAY_MS;
      console.log(`   ⏳ Rate limit (429) — čekám ${Math.round(waitMs / 1000)}s (pokus ${attempt + 1}/${RATE_LIMIT_MAX_RETRIES})...`);
      await sleep(waitMs);
      continue;
    }

    const errText = await response.text().catch(() => "unknown");
    throw new Error(`Anthropic API chyba ${response.status}: ${errText.slice(0, 300)}`);
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "unknown");
    throw new Error(`Anthropic API chyba ${response.status} (po retry): ${errText.slice(0, 300)}`);
  }

  const json = await response.json();
  const rawText = json.content
    ?.filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim() ?? "";

  return {
    rawText,
    inputTokens: json.usage?.input_tokens ?? null,
    outputTokens: json.usage?.output_tokens ?? null,
    stopReason: json.stop_reason ?? null,
  };
}

// ─── JSON parse with fallback ─────────────────────────────────────────────────

function parseJsonResponse(rawText) {
  // Strip markdown fences if model wraps output
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/im, "")
    .replace(/\s*```\s*$/im, "")
    .trim();

  // Try direct parse
  try {
    return { ok: true, parsed: JSON.parse(cleaned), cleaned };
  } catch (_) {
    // Try to find the first { ... } block
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return { ok: true, parsed: JSON.parse(match[0]), cleaned: match[0] };
      } catch (e2) {
        return { ok: false, error: e2.message, cleaned };
      }
    }
    return { ok: false, error: "No JSON object found in response", cleaned };
  }
}

// ─── Single file benchmark ────────────────────────────────────────────────────

async function benchmarkPdf(pdfPath) {
  const filename = basename(pdfPath);
  console.log(`\n📄 ${filename}`);
  console.log(`   Model: ${MODEL}`);

  const startMs = Date.now();

  let claudeResult;
  try {
    claudeResult = await callClaudeWithPdf(pdfPath);
  } catch (err) {
    const latencyMs = Date.now() - startMs;
    const result = {
      provider: "anthropic",
      model: MODEL,
      filename,
      pdf_path: pdfPath,
      latency_ms: latencyMs,
      ok: false,
      error: err.message,
      raw_text_response: null,
      parsed_json: null,
      parse_error: null,
      tokens: { input: null, output: null },
      timestamp: new Date().toISOString(),
    };
    const outPath = saveOutput(filename, result);
    console.log(`   ❌ Chyba: ${err.message}`);
    console.log(`   💾 Uloženo: ${outPath}`);
    return result;
  }

  const latencyMs = Date.now() - startMs;
  const parseResult = parseJsonResponse(claudeResult.rawText);

  const result = {
    provider: "anthropic",
    model: MODEL,
    filename,
    pdf_path: pdfPath,
    latency_ms: latencyMs,
    ok: parseResult.ok,
    error: parseResult.ok ? null : parseResult.error,
    raw_text_response: claudeResult.rawText,
    parsed_json: parseResult.ok ? parseResult.parsed : null,
    parse_error: parseResult.ok ? null : parseResult.error,
    tokens: {
      input: claudeResult.inputTokens,
      output: claudeResult.outputTokens,
    },
    stop_reason: claudeResult.stopReason,
    timestamp: new Date().toISOString(),
  };

  const outPath = saveOutput(filename, result);

  if (parseResult.ok) {
    const p = parseResult.parsed;
    console.log(`   ✅ OK — ${latencyMs}ms`);
    console.log(`   📊 document_family:  ${p.document_family ?? "—"}`);
    console.log(`   📊 document_type:    ${p.document_type ?? "—"}`);
    console.log(`   📊 publishable:      ${p.publishability?.contract_publishable ?? "—"}`);
    console.log(`   📊 confidence:       ${p.confidence ?? "—"}`);
    console.log(`   📊 client:           ${p.client?.full_name ?? "—"}`);
    if (p.warnings?.length) {
      console.log(`   ⚠️  warnings:         ${p.warnings.slice(0, 3).join(", ")}`);
    }
    console.log(`   🔢 tokens:           ${claudeResult.inputTokens ?? "?"} in / ${claudeResult.outputTokens ?? "?"} out`);
  } else {
    console.log(`   ⚠️  Parse error: ${parseResult.error}`);
    console.log(`   📝 Raw preview: ${claudeResult.rawText.slice(0, 200)}`);
  }

  console.log(`   💾 Uloženo: ${outPath}`);
  return result;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Guard
  if (!API_KEY) {
    fail(
      "ANTHROPIC_API_KEY není nastaven.\n" +
      "   Nastav ho v apps/web/.env.local a spusť:\n" +
      "   node --env-file=apps/web/.env.local scripts/benchmark-claude-review.mjs"
    );
  }

  // Determine PDF list
  const cliArgs = process.argv.slice(2).filter((a) => a.endsWith(".pdf") || a.endsWith(".PDF"));
  const pdfPaths = cliArgs.length > 0
    ? cliArgs.map((p) => resolve(process.cwd(), p))
    : BENCHMARK_PDF_PATHS;

  if (pdfPaths.length === 0) {
    fail("Žádné PDF soubory nebyly nalezeny. Zadej cestu jako argument nebo doplň BENCHMARK_PDF_PATHS.");
  }

  console.log(`\n🚀 Claude RAW PDF Benchmark`);
  console.log(`   Model:   ${MODEL}`);
  console.log(`   Výstupy: ${OUTPUTS_DIR}`);
  console.log(`   PDFs:    ${pdfPaths.length}\n`);

  const missing = pdfPaths.filter((p) => !existsSync(p));
  if (missing.length) {
    console.warn("⚠️  Nenalezené soubory (budou přeskočeny):");
    missing.forEach((p) => console.warn(`   - ${p}`));
  }
  const existing = pdfPaths.filter((p) => existsSync(p));

  if (existing.length === 0) {
    fail("Žádný z PDF souborů neexistuje.");
  }

  // Delay between PDFs to respect rate limits (configurable via BENCHMARK_DELAY_MS env)
  const delayBetweenMs = parseInt(process.env.BENCHMARK_DELAY_MS ?? "5000", 10);

  const results = [];
  for (let i = 0; i < existing.length; i++) {
    if (i > 0 && delayBetweenMs > 0) {
      console.log(`\n   ⏳ Čekám ${delayBetweenMs / 1000}s před dalším PDF...`);
      await sleep(delayBetweenMs);
    }
    const result = await benchmarkPdf(existing[i]);
    results.push(result);
  }

  // Summary
  console.log("\n" + "─".repeat(60));
  console.log("📋 SUMMARY");
  console.log("─".repeat(60));
  for (const r of results) {
    const status = r.ok ? "✅" : "❌";
    const family = r.parsed_json?.document_family ?? r.error?.slice(0, 40) ?? "—";
    const pub = r.parsed_json?.publishability?.contract_publishable;
    const pubStr = pub === true ? "pub✅" : pub === false ? "pub❌" : "pub?";
    console.log(`  ${status} ${r.filename.slice(0, 45).padEnd(45)} ${family.padEnd(20)} ${pubStr}  ${r.latency_ms}ms`);
  }

  // Save combined summary
  const summaryPath = resolve(OUTPUTS_DIR, `_summary_${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16)}.json`);
  writeFileSync(summaryPath, JSON.stringify({ model: MODEL, results, run_at: new Date().toISOString() }, null, 2));
  console.log(`\n💾 Summary: ${summaryPath}\n`);
}

main().catch((err) => {
  console.error("\n💥 Unhandled error:", err.message);
  process.exit(1);
});
