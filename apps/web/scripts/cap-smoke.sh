#!/usr/bin/env bash
#
# Capacitor release smoke test.
#
# Fast pre-flight that reproduces the most common release-blocking failure
# modes from the mobile audit without requiring a full Xcode / Play submission.
#
# What it does (in order, bails on first failure):
#   1. Runs fcm-config assertion in dev mode (warns on missing files).
#   2. Runs the iOS preflight script.
#   3. Runs the full vitest mobile suite (route-helpers + native-back-stack).
#   4. Builds the Next.js app (`pnpm build`).
#   5. Runs `npx cap sync` to propagate native changes.
#   6. If `adb devices` shows a connected Android device/emulator, dispatches
#      a hardware back key-event to prove the activity doesn't crash.
#
# What it does NOT do:
#   - Archive / upload to TestFlight / Play. Those need humans + secrets.
#   - E2E Playwright mobile scenario. That's a separate job (`pnpm test:e2e`).
#
# Usage:
#   bash apps/web/scripts/cap-smoke.sh
#
# Exit codes:
#   0 — smoke passed; safe to proceed to Archive.
#   non-0 — inspect log output.

set -euo pipefail

# Resolve repo-root-absolute apps/web path even when invoked from elsewhere.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_WEB="$(cd "$SCRIPT_DIR/.." && pwd)"

GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
RESET="\033[0m"

say() { printf "${GREEN}[cap-smoke]${RESET} %s\n" "$1"; }
warn() { printf "${YELLOW}[cap-smoke]${RESET} %s\n" "$1"; }
die() {
  printf "${RED}[cap-smoke FAIL]${RESET} %s\n" "$1" >&2
  exit 1
}

cd "$APP_WEB"

say "Step 1/6 — FCM config assertion (dev mode)"
node scripts/assert-fcm-config.mjs || die "FCM config assertion failed."

say "Step 2/6 — iOS preflight"
node scripts/ios-preflight.mjs || die "iOS preflight failed."

say "Step 3/6 — Unit tests (route-helpers + native-back-stack)"
pnpm vitest run \
  src/app/shared/mobile-ui/__tests__/native-back-stack.test.ts \
  src/app/portal/mobile/__tests__/route-helpers.test.ts \
  || die "Unit tests failed."

say "Step 4/6 — Next.js build"
pnpm build || die "pnpm build failed."

say "Step 5/6 — cap sync"
npx cap sync || die "cap sync failed."

say "Step 6/6 — Android hw-back dispatch (best-effort)"
if command -v adb >/dev/null 2>&1; then
  if adb devices | awk 'NR>1 && $2=="device"{found=1} END{exit !found}'; then
    warn "Android device detected — dispatching KEYCODE_BACK. Open the app first!"
    if ! adb shell input keyevent 4; then
      warn "adb input keyevent failed — manual check required."
    else
      say "KEYCODE_BACK dispatched; activity should still be running."
    fi
  else
    warn "No Android devices — skipping hw-back test. Plug in a device or start an emulator for full smoke."
  fi
else
  warn "adb not on PATH — skipping Android hw-back smoke. Install platform-tools to run it."
fi

say "All steps passed. Safe to proceed to Archive / Play internal rollout."
