#!/usr/bin/env node
// @ts-check
/*
 * iOS build pre-flight validator.
 *
 * Must pass before Xcode → Archive → TestFlight upload. Checks only things we CAN
 * verify without Xcode running; anything manual (certificates, provisioning profiles)
 * is still the human's job and documented in apps/web/ios/APP_STORE.md.
 *
 * Run from apps/web:   pnpm ios:preflight
 * Or directly:         node scripts/ios-preflight.mjs
 */

import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_WEB = join(__dirname, "..");
const IOS_DIR = join(APP_WEB, "ios");
const INFO_PLIST = join(IOS_DIR, "App", "App", "Info.plist");
const CAP_CONFIG = join(APP_WEB, "capacitor.config.ts");
const PACKAGE_SWIFT = join(IOS_DIR, "App", "CapApp-SPM", "Package.swift");
const CAP_SETTINGS_GRADLE = join(APP_WEB, "android", "capacitor.settings.gradle");

const EXPECTED_BUNDLE_ID = "cz.aidvisora.app";
const EXPECTED_SHARE_BUNDLE_ID = "cz.aidvisora.app.share";
const EXPECTED_URL_SCHEMES = ["aidvisor", "aidvisora"];
const REQUIRED_USAGE_DESCRIPTIONS = [
  "NSCameraUsageDescription",
  "NSPhotoLibraryUsageDescription",
  "NSFaceIDUsageDescription",
];
const MIN_USAGE_DESCRIPTION_LENGTH = 30;
const REQUIRED_PLUGINS = [
  "@capgo/capacitor-document-scanner",
  "@capacitor/camera",
];

/** @type {{ok:boolean,msg:string,level:"pass"|"warn"|"fail"}[]} */
const results = [];

function pass(msg) {
  results.push({ ok: true, level: "pass", msg });
}
function warn(msg) {
  results.push({ ok: true, level: "warn", msg });
}
function fail(msg) {
  results.push({ ok: false, level: "fail", msg });
}

function checkFileExists(path, label) {
  if (existsSync(path)) {
    pass(`${label} exists (${relative(APP_WEB, path)})`);
    return true;
  }
  fail(`${label} MISSING: ${path}`);
  return false;
}

function extractPlistString(plist, key) {
  const re = new RegExp(
    `<key>${key}</key>\\s*<string>([\\s\\S]*?)</string>`,
    "m"
  );
  const m = plist.match(re);
  return m ? m[1].trim() : null;
}

function extractUrlSchemes(plist) {
  // Capture the first CFBundleURLSchemes array content; we only have one URL type.
  const m = plist.match(
    /<key>CFBundleURLSchemes<\/key>\s*<array>([\s\S]*?)<\/array>/
  );
  if (!m) return [];
  return [...m[1].matchAll(/<string>(.*?)<\/string>/g)].map((x) => x[1].trim());
}

function hasPlistBool(plist, key, expected) {
  const re = new RegExp(
    `<key>${key}</key>\\s*<(true|false)\\s*/>`,
    "m"
  );
  const m = plist.match(re);
  if (!m) return null;
  return m[1] === "true" ? true : false;
}

// ---------- checks ----------

function checkInfoPlist() {
  if (!checkFileExists(INFO_PLIST, "Info.plist")) return;
  const plist = readFileSync(INFO_PLIST, "utf8");

  for (const key of REQUIRED_USAGE_DESCRIPTIONS) {
    const val = extractPlistString(plist, key);
    if (!val) {
      fail(`Info.plist: missing ${key}`);
    } else if (val.length < MIN_USAGE_DESCRIPTION_LENGTH) {
      warn(
        `Info.plist: ${key} is suspiciously short (${val.length} chars). Apple rejects placeholder strings.`
      );
    } else {
      pass(`Info.plist: ${key} set (${val.length} chars).`);
    }
  }

  const encryption = hasPlistBool(plist, "ITSAppUsesNonExemptEncryption");
  if (encryption === null) {
    warn(
      "Info.plist: ITSAppUsesNonExemptEncryption missing. App Store will prompt about encryption at submit time."
    );
  } else if (encryption === true) {
    warn(
      "Info.plist: ITSAppUsesNonExemptEncryption=true — you'll need an export compliance declaration."
    );
  } else {
    pass("Info.plist: ITSAppUsesNonExemptEncryption=false.");
  }

  const urlSchemes = extractUrlSchemes(plist);
  for (const scheme of EXPECTED_URL_SCHEMES) {
    if (urlSchemes.includes(scheme)) {
      pass(`Info.plist: URL scheme "${scheme}://" registered.`);
    } else {
      warn(
        `Info.plist: URL scheme "${scheme}://" NOT registered — deeplinks may fail.`
      );
    }
  }

  const remoteNotif = plist.includes("<string>remote-notification</string>");
  if (remoteNotif) {
    pass("Info.plist: UIBackgroundModes includes remote-notification.");
  } else {
    warn("Info.plist: remote-notification background mode missing — push won't wake the app in background.");
  }
}

function checkCapacitorConfig() {
  if (!checkFileExists(CAP_CONFIG, "capacitor.config.ts")) return;
  const cfg = readFileSync(CAP_CONFIG, "utf8");
  if (cfg.includes(`"${EXPECTED_BUNDLE_ID}"`) || cfg.includes(`'${EXPECTED_BUNDLE_ID}'`)) {
    pass(`capacitor.config.ts: appId = ${EXPECTED_BUNDLE_ID}.`);
  } else {
    fail(
      `capacitor.config.ts: appId does not match ${EXPECTED_BUNDLE_ID}. Xcode archive will reject.`
    );
  }
}

function checkPackageSwiftPlugins() {
  if (!checkFileExists(PACKAGE_SWIFT, "iOS Package.swift")) return;
  const pkg = readFileSync(PACKAGE_SWIFT, "utf8");
  for (const name of REQUIRED_PLUGINS) {
    if (pkg.includes(name)) {
      pass(`Package.swift: ${name} linked.`);
    } else {
      fail(
        `Package.swift: ${name} NOT linked — did you run \`pnpm cap:sync\`?`
      );
    }
  }
}

function checkAndroidGradlePlugins() {
  if (!checkFileExists(CAP_SETTINGS_GRADLE, "android/capacitor.settings.gradle")) return;
  const gradle = readFileSync(CAP_SETTINGS_GRADLE, "utf8");
  for (const name of REQUIRED_PLUGINS) {
    if (gradle.includes(name)) {
      pass(`android settings.gradle: ${name} linked.`);
    } else {
      warn(
        `android settings.gradle: ${name} not listed (OK if you're only building iOS today).`
      );
    }
  }
}

function checkGitClean() {
  try {
    const out = execSync("git status --porcelain", {
      cwd: APP_WEB,
      encoding: "utf8",
    }).trim();
    if (!out) {
      pass("git status: clean.");
    } else {
      warn(
        `git status: ${out.split("\n").length} uncommitted change(s) — archive will include WIP code.`
      );
    }
  } catch {
    warn("git status: could not run `git` (not a git repo or git missing).");
  }
}

function checkCapSyncFreshness() {
  const capAppDir = join(APP_WEB, "capacitor-app");
  if (!existsSync(capAppDir)) {
    fail(
      "capacitor-app/ build output missing — run `pnpm build && pnpm cap:sync` first."
    );
    return;
  }
  const capMtime = statSync(capAppDir).mtimeMs;

  const srcDir = join(APP_WEB, "src");
  let latestSrcMtime = 0;
  function walk(p) {
    const stat = statSync(p);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(p)) {
        if (entry === "node_modules" || entry.startsWith(".")) continue;
        walk(join(p, entry));
      }
    } else {
      if (stat.mtimeMs > latestSrcMtime) latestSrcMtime = stat.mtimeMs;
    }
  }
  try {
    walk(srcDir);
  } catch {
    /* ignore */
  }
  if (latestSrcMtime > capMtime) {
    warn(
      `capacitor-app/ is older than src/ (by ${Math.round(
        (latestSrcMtime - capMtime) / 1000
      )} s) — run \`pnpm build && pnpm cap:sync\` before Archive.`
    );
  } else {
    pass("capacitor-app/ is fresh relative to src/.");
  }
}

function checkNodeAndPnpm() {
  try {
    const v = execSync("node --version", { encoding: "utf8" }).trim();
    pass(`node ${v}`);
  } catch {
    fail("node not on PATH");
  }
  try {
    const v = execSync("pnpm --version", { encoding: "utf8" }).trim();
    pass(`pnpm ${v}`);
  } catch {
    fail("pnpm not on PATH — required for `cap:sync`.");
  }
}

// ---------- run ----------

console.log("iOS pre-flight validation");
console.log("============================\n");

checkNodeAndPnpm();
checkInfoPlist();
checkCapacitorConfig();
checkPackageSwiftPlugins();
checkAndroidGradlePlugins();
checkCapSyncFreshness();
checkGitClean();

const colors = {
  pass: "\x1b[32m",
  warn: "\x1b[33m",
  fail: "\x1b[31m",
  reset: "\x1b[0m",
};

let failures = 0;
let warnings = 0;
for (const r of results) {
  const icon = r.level === "pass" ? "OK " : r.level === "warn" ? "WARN" : "FAIL";
  const color = colors[r.level];
  console.log(`${color}[${icon}]${colors.reset} ${r.msg}`);
  if (r.level === "fail") failures++;
  if (r.level === "warn") warnings++;
}

console.log(
  `\n${results.length - failures - warnings} passed · ${warnings} warning(s) · ${failures} failure(s)`
);

if (failures > 0) {
  console.log(
    "\nFix failures before running Xcode → Archive. See apps/web/ios/APP_STORE.md §10."
  );
  process.exit(1);
}
if (warnings > 0) {
  console.log(
    "\nWarnings won't block Archive but review them. Expected bundle id: " +
      EXPECTED_BUNDLE_ID +
      (EXPECTED_SHARE_BUNDLE_ID
        ? ` + share extension: ${EXPECTED_SHARE_BUNDLE_ID}`
        : "")
  );
}
process.exit(0);
