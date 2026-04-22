#!/usr/bin/env node
// @ts-check
/*
 * FCM / APNs configuration pre-build assertion.
 *
 * Purpose:
 *   Fail-fast before Xcode Archive or `./gradlew assembleRelease` if the native
 *   config files required for push notifications are missing from the build
 *   context. These files are intentionally NOT committed (they contain secrets)
 *   and must be injected by CI from encrypted secrets.
 *
 * CI pipeline (documented in docs/runbook-push.md):
 *   - Decrypt GOOGLE_SERVICES_JSON_B64 → apps/web/android/app/google-services.json
 *   - Decrypt GOOGLE_SERVICE_INFO_PLIST_B64 → apps/web/ios/App/App/GoogleService-Info.plist
 *   - Run: `node apps/web/scripts/assert-fcm-config.mjs --require-release`
 *
 * Locally (dev): run without `--require-release`; missing files become warnings
 * so developers on iOS-only machines aren't blocked.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_WEB = join(__dirname, "..");
const ANDROID_GOOGLE_SERVICES = join(
  APP_WEB,
  "android",
  "app",
  "google-services.json",
);
const IOS_GOOGLE_SERVICE_INFO = join(
  APP_WEB,
  "ios",
  "App",
  "App",
  "GoogleService-Info.plist",
);

const args = process.argv.slice(2);
const requireRelease = args.includes("--require-release");
const platformFilter = args.find((arg) => arg.startsWith("--platform="))
  ?.split("=")[1];

/** @type {{ok:boolean,level:"pass"|"warn"|"fail",msg:string}[]} */
const results = [];
const pass = (msg) => results.push({ ok: true, level: "pass", msg });
const warn = (msg) => results.push({ ok: true, level: "warn", msg });
const fail = (msg) => results.push({ ok: false, level: "fail", msg });

function checkAndroidConfig() {
  if (platformFilter && platformFilter !== "android") return;
  if (!existsSync(ANDROID_GOOGLE_SERVICES)) {
    const msg = `android/app/google-services.json MISSING — FCM push will throw at PushNotifications.register(). Decrypt GOOGLE_SERVICES_JSON_B64 to ${relative(
      APP_WEB,
      ANDROID_GOOGLE_SERVICES,
    )}.`;
    if (requireRelease) fail(msg);
    else warn(msg);
    return;
  }
  const raw = readFileSync(ANDROID_GOOGLE_SERVICES, "utf8");
  try {
    const parsed = JSON.parse(raw);
    const clients = parsed?.client;
    if (!Array.isArray(clients) || clients.length === 0) {
      fail("google-services.json: no client entries — file is malformed.");
      return;
    }
    const pkg = clients[0]?.client_info?.android_client_info?.package_name;
    if (pkg !== "cz.aidvisora.app") {
      fail(
        `google-services.json: first client package_name=${pkg}, expected cz.aidvisora.app. Wrong project?`,
      );
      return;
    }
    const size = statSync(ANDROID_GOOGLE_SERVICES).size;
    pass(`android/app/google-services.json OK (${size} bytes, package=${pkg}).`);
  } catch (err) {
    fail(
      `google-services.json: JSON parse failed (${
        err instanceof Error ? err.message : "unknown"
      }).`,
    );
  }
}

function checkIosConfig() {
  if (platformFilter && platformFilter !== "ios") return;
  if (!existsSync(IOS_GOOGLE_SERVICE_INFO)) {
    const msg = `ios/App/App/GoogleService-Info.plist MISSING — iOS FCM push won't work. Decrypt GOOGLE_SERVICE_INFO_PLIST_B64 to ${relative(
      APP_WEB,
      IOS_GOOGLE_SERVICE_INFO,
    )}.`;
    if (requireRelease) fail(msg);
    else warn(msg);
    return;
  }
  const content = readFileSync(IOS_GOOGLE_SERVICE_INFO, "utf8");
  if (!content.includes("BUNDLE_ID") && !content.includes("cz.aidvisora.app")) {
    warn(
      "GoogleService-Info.plist: no BUNDLE_ID / cz.aidvisora.app found — might be wrong file.",
    );
    return;
  }
  const size = statSync(IOS_GOOGLE_SERVICE_INFO).size;
  pass(`ios/App/App/GoogleService-Info.plist OK (${size} bytes).`);
}

console.log("FCM / APNs config assertion");
console.log("===============================\n");
checkAndroidConfig();
checkIosConfig();

const colors = {
  pass: "\x1b[32m",
  warn: "\x1b[33m",
  fail: "\x1b[31m",
  reset: "\x1b[0m",
};
let failures = 0;
let warnings = 0;
for (const r of results) {
  const icon = r.level === "pass" ? "OK  " : r.level === "warn" ? "WARN" : "FAIL";
  console.log(`${colors[r.level]}[${icon}]${colors.reset} ${r.msg}`);
  if (r.level === "fail") failures++;
  if (r.level === "warn") warnings++;
}
console.log(
  `\n${
    results.length - failures - warnings
  } passed · ${warnings} warning(s) · ${failures} failure(s)`,
);
if (failures > 0) {
  console.log(
    "\nFix failures before release. See docs/runbook-push.md for the CI injection recipe.",
  );
  process.exit(1);
}
process.exit(0);
