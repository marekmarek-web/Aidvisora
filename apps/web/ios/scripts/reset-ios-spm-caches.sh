#!/usr/bin/env bash
# Clears Swift PM caches that commonly cause:
#   failed extracting '.../grpc/1.69.1/rc0/grpc.zip' (binary target 'grpc' / CapApp-SPM)
# From repo root:  bash apps/web/ios/scripts/reset-ios-spm-caches.sh
# From apps/web:    pnpm run ios:reset-spm
# From monorepo root: pnpm --filter web run ios:reset-spm
set -euo pipefail

SWIFT_PM_CACHE="${HOME}/Library/Caches/org.swift.swiftpm"
XCODE_DERIVED_ROOT="${HOME}/Library/Developer/Xcode/DerivedData"

echo "== Aidvisora iOS: reset Swift PM artifact caches =="
if [[ -d "${SWIFT_PM_CACHE}/artifacts" ]]; then
  echo "Removing: ${SWIFT_PM_CACHE}/artifacts"
  rm -rf "${SWIFT_PM_CACHE}/artifacts"
else
  echo "No ${SWIFT_PM_CACHE}/artifacts (already clean or first run)."
fi

# Stale per-project build state; safe to let Xcode recreate.
echo "If problems persist, remove all Aidvisora entries under DerivedData in Xcode (Settings → Locations),"
echo "or run:  rm -rf \"${XCODE_DERIVED_ROOT}\"/*aidvisora* 2>/dev/null || true"
echo ""
echo "Next:"
echo "  1) From apps/web:  pnpm install && pnpm cap:sync"
echo "  2) Xcode: File → Packages → Reset Package Caches, then Resolve Package Versions"
echo "  3) Product → Clean Build Folder, then build"
echo ""
echo "Optional (aggressive, clears SPM cache for all projects on this Mac):"
echo "  rm -rf \"${SWIFT_PM_CACHE}\""
