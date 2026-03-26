import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const args = process.argv.slice(2);
const dirMode = args[0] === "--dir";
const dirs = dirMode ? args.slice(1) : [];
const files = dirMode ? [] : args;

function walkTsx(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkTsx(p, out);
    else if (/\.(tsx|ts)$/.test(e.name)) out.push(p);
  }
  return out;
}

const needPattern = /\bbg-white\b|slate-/;

let targets = [];
if (dirMode) {
  if (dirs.length === 0) {
    console.error("Usage: node theme-bulk-replace.mjs --dir <dir> ...");
    process.exit(1);
  }
  for (const d of dirs) {
    const abs = path.isAbsolute(d) ? d : path.join(root, d);
    for (const f of walkTsx(abs)) {
      const s = fs.readFileSync(f, "utf8");
      if (needPattern.test(s)) targets.push(f);
    }
  }
} else {
  if (files.length === 0) {
    console.error("Usage: node theme-bulk-replace.mjs <file> ... | --dir <dir> ...");
    process.exit(1);
  }
  targets = files.map((rel) => (path.isAbsolute(rel) ? rel : path.join(root, rel)));
}

const pairs = [
  [/bg-slate-900\/40/g, "bg-[color:var(--wp-overlay-scrim)]"],
  [/bg-slate-50\/80/g, "bg-[color:var(--wp-surface-muted)]/80"],
  [/bg-slate-50\/50/g, "bg-[color:var(--wp-surface-muted)]/50"],
  [/text-slate-900/g, "text-[color:var(--wp-text)]"],
  [/text-slate-800/g, "text-[color:var(--wp-text)]"],
  [/text-slate-700/g, "text-[color:var(--wp-text-secondary)]"],
  [/text-slate-600/g, "text-[color:var(--wp-text-secondary)]"],
  [/text-slate-500/g, "text-[color:var(--wp-text-secondary)]"],
  [/text-slate-400/g, "text-[color:var(--wp-text-tertiary)]"],
  [/text-slate-300/g, "text-[color:var(--wp-text-tertiary)]"],
  [/divide-slate-100/g, "divide-[color:var(--wp-surface-card-border)]"],
  [/border-slate-50/g, "border-[color:var(--wp-surface-card-border)]/50"],
  [/border-l-slate-300/g, "border-l-[color:var(--wp-border-strong)]"],
  [/border-slate-100/g, "border-[color:var(--wp-surface-card-border)]"],
  [/ring-slate-400/g, "ring-[color:var(--wp-text-tertiary)]"],
  [/border-slate-200/g, "border-[color:var(--wp-surface-card-border)]"],
  [/border-slate-400/g, "border-[color:var(--wp-border-strong)]"],
  [/border-slate-300/g, "border-[color:var(--wp-border-strong)]"],
  [/hover:border-slate-300/g, "hover:border-[color:var(--wp-border-strong)]"],
  [/bg-slate-50/g, "bg-[color:var(--wp-surface-muted)]"],
  [/hover:bg-slate-50/g, "hover:bg-[color:var(--wp-surface-muted)]"],
  [/hover:bg-slate-100/g, "hover:bg-[color:var(--wp-surface-muted)]"],
  [/bg-slate-100/g, "bg-[color:var(--wp-surface-muted)]"],
  [/bg-slate-200/g, "bg-[color:var(--wp-surface-card-border)]"],
  [/focus:bg-white/g, "focus:bg-[color:var(--wp-surface-card)]"],
  [/\bbg-white\b/g, "bg-[color:var(--wp-surface-card)]"],
  [/disabled:bg-slate-300/g, "disabled:bg-[color:var(--wp-surface-card-border)]"],
];

for (const p of targets) {
  if (!fs.existsSync(p)) {
    console.log("skip missing", p);
    continue;
  }
  let s = fs.readFileSync(p, "utf8");
  const orig = s;
  for (const [re, to] of pairs) s = s.replace(re, to);
  if (s !== orig) {
    fs.writeFileSync(p, s);
    console.log("updated", path.relative(root, p));
  }
}
