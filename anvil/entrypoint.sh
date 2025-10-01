#!/bin/bash
set -euo pipefail

STATE_PATH="${ANVIL_STATE_PATH:-/data/anvil-state.json}"
mkdir -p "$(dirname "$STATE_PATH")"

args=("$@")

if [ -f "$STATE_PATH" ]; then
  args+=("--load-state" "$STATE_PATH")
fi

args+=("--dump-state" "$STATE_PATH")

exec anvil "${args[@]}"
