/* eslint-disable no-console */
"use strict";
/**
 * Updates `gitTracked` for every corpus path under `Test AI/` in the existing
 * scenarios.manifest.json. Preserves manifest version (v3), phase2/3 scenario
 * fields, and all corpus metadata — does NOT rebuild the file from scratch.
 *
 * From repo root: node fixtures/golden-ai-review/regenerate-manifest.cjs
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const manifestPath = path.join(__dirname, "scenarios.manifest.json");
const repoRoot = path.join(__dirname, "..", "..");

const tracked = new Set(
  execFileSync("git", ["ls-files", "-z", "--", "Test AI/"], {
    cwd: repoRoot,
    encoding: "buffer",
    maxBuffer: 10 * 1024 * 1024,
  })
    .toString("utf8")
    .split("\0")
    .filter(Boolean),
);

/** @param {string} ref */
function gitTracked(ref) {
  return tracked.has(ref);
}

const raw = fs.readFileSync(manifestPath, "utf8");
const manifest = JSON.parse(raw);

if (!Array.isArray(manifest.corpusDocuments)) {
  console.error("Invalid manifest: missing corpusDocuments[]");
  process.exit(1);
}

let updated = 0;
for (const doc of manifest.corpusDocuments) {
  if (typeof doc.referenceFile === "string" && doc.referenceFile.startsWith("Test AI/")) {
    const next = gitTracked(doc.referenceFile);
    if (doc.gitTracked !== next) {
      doc.gitTracked = next;
      updated++;
    }
  }
  if (Array.isArray(doc.aliasFileNames)) {
    for (const alias of doc.aliasFileNames) {
      if (typeof alias === "string" && alias.startsWith("Test AI/")) {
        /* alias presence does not set gitTracked on main row; optional future */
      }
    }
  }
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log("Wrote", manifestPath, "| corpus rows:", manifest.corpusDocuments.length, "| gitTracked flips:", updated);
