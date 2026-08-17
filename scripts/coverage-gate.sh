#!/usr/bin/env bash
# WHY: coverage floor gate — bun's --coverage flag does not accept thresholds, so this
# script parses the "All files" summary line and exits 1 when line coverage is below
# the floor. Kept as a script so both CI and local runs share the exact same logic.
set -euo pipefail
FLOOR="${1:-95}"
LINE=$(grep -E '^All files' coverage.txt | head -n 1 | awk -F'|' '{ gsub(/[ %]/, "", $2); print $2 }')
if [ -z "$LINE" ]; then
  echo "Coverage gate: could not parse 'All files' summary from coverage.txt"
  exit 1
fi
awk -v cov="$LINE" -v floor="$FLOOR" 'BEGIN {
  if (cov + 0 < floor + 0) { printf "Coverage floor missed: %.2f%% < %s%%\n", cov + 0, floor; exit 1 }
  printf "Coverage OK: %.2f%% >= %s%%\n", cov + 0, floor
}'
