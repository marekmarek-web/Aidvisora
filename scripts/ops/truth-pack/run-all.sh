#!/usr/bin/env bash
# Truth Pack · Run-all executor
#
# Usage:
#   DATABASE_URL_SERVICE=postgres://... \
#   TRUTH_TENANT_ID=<uuid> \
#   TRUTH_ADVISOR_USER_ID=<uuid> \
#   TRUTH_CURRENT_USER_ID=<uuid> \
#   ./scripts/ops/truth-pack/run-all.sh [propagation|kpi|monitoring|all]
#
# Výstup: scripts/ops/truth-pack/.out/<timestamp>-<mode>.log
# READ-ONLY — bezpečné.

set -euo pipefail

MODE="${1:-all}"
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT_DIR="$HERE/.out"
mkdir -p "$OUT_DIR"
TS="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
LOG="$OUT_DIR/${TS}-${MODE}.log"

: "${DATABASE_URL_SERVICE:?DATABASE_URL_SERVICE je povinný (service role, BYPASSRLS)}"

TENANT_ID="${TRUTH_TENANT_ID:-00000000-0000-0000-0000-000000000000}"
ADVISOR_USER_ID="${TRUTH_ADVISOR_USER_ID:-00000000-0000-0000-0000-000000000000}"
CURRENT_USER_ID="${TRUTH_CURRENT_USER_ID:-$ADVISOR_USER_ID}"

run_plain() {
  local f="$1"
  echo ">>> $(basename "$f")" | tee -a "$LOG"
  psql "$DATABASE_URL_SERVICE" --no-psqlrc --set ON_ERROR_STOP=on -f "$f" 2>&1 | tee -a "$LOG"
}

run_kpi() {
  local f="$HERE/01-kpi.sql"
  echo ">>> $(basename "$f") (substituted)" | tee -a "$LOG"
  # Nahradíme placeholdery a nakrmíme psql přes stdin.
  sed \
    -e "s|:TENANT_ID|'${TENANT_ID}'::uuid|g" \
    -e "s|:ADVISOR_USER_ID|'${ADVISOR_USER_ID}'::uuid|g" \
    -e "s|:CURRENT_USER_ID|'${CURRENT_USER_ID}'::uuid|g" \
    "$f" \
  | psql "$DATABASE_URL_SERVICE" --no-psqlrc --set ON_ERROR_STOP=on 2>&1 | tee -a "$LOG"
}

case "$MODE" in
  propagation) run_plain "$HERE/00-propagation.sql" ;;
  kpi)         run_kpi ;;
  monitoring)  run_plain "$HERE/02-monitoring.sql" ;;
  all)
    run_plain "$HERE/00-propagation.sql"
    run_kpi
    run_plain "$HERE/02-monitoring.sql"
    ;;
  *) echo "Unknown mode: $MODE (use propagation|kpi|monitoring|all)"; exit 2 ;;
esac

echo ""
echo "Log uložen: $LOG"
echo "Go/no-go vyhodnocení: docs/launch/truth-pack-runbook-2026-04-23.md §Thresholds"
