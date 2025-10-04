#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONTRACTS_DIR="$ROOT_DIR/contracts"
WEB_ENV_FILE="$ROOT_DIR/web/.env.local"
ABI_TARGET="$ROOT_DIR/web/lib/blockchain/ticket-abi.ts"
ABI_SOURCE="$CONTRACTS_DIR/out/TicketSBT.sol/TicketSBT.json"

if [ ! -d "$CONTRACTS_DIR" ]; then
  echo "contracts directory not found at $CONTRACTS_DIR" >&2
  exit 1
fi

if ! command -v forge >/dev/null 2>&1; then
  echo "forge is not installed. Install Foundry first: https://book.getfoundry.sh/getting-started/installation" >&2
  exit 1
fi

if ! command -v cast >/dev/null 2>&1; then
  echo "cast is not installed. Install Foundry tools (forge/cast)." >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required to parse deployment artifacts. Install it via brew/apt." >&2
  exit 1
fi

RPC_URL="${RPC_URL:-}"
if [ -z "$RPC_URL" ]; then
  RPC_URL="${ALCHEMY_RPC_URL:-}"
fi
if [ -z "$RPC_URL" ]; then
  RPC_URL="${NEXT_PUBLIC_RPC_URL:-}"
fi
if [ -z "$RPC_URL" ]; then
  RPC_URL="${NEXT_PUBLIC_ALCHEMY_RPC_URL:-}"
fi

if [ -z "$RPC_URL" ]; then
  echo "RPC_URL is not set. Provide RPC_URL or ALCHEMY_RPC_URL (Sepolia endpoint)." >&2
  exit 1
fi

DEPLOYER_KEY="${DEPLOYER_PRIVATE_KEY:-}"
if [ -z "$DEPLOYER_KEY" ]; then
  DEPLOYER_KEY="${PRIVATE_KEY:-}"
fi
if [ -z "$DEPLOYER_KEY" ]; then
  DEPLOYER_KEY="${SMART_WALLET_OWNER_PRIVATE_KEY:-}"
fi

if [ -z "$DEPLOYER_KEY" ]; then
  echo "Deployer private key is not set. Export DEPLOYER_PRIVATE_KEY (0x prefix)." >&2
  exit 1
fi

export FOUNDRY_DISABLE_NIGHTLY_WARNING=1

pushd "$CONTRACTS_DIR" >/dev/null

forge build

CHAIN_ID="${CHAIN_ID:-}"
if [ -z "$CHAIN_ID" ]; then
  CHAIN_ID="$(cast chain-id --rpc-url "$RPC_URL")"
fi

forge script script/deploy.s.sol \
  --rpc-url "$RPC_URL" \
  --private-key "$DEPLOYER_KEY" \
  --broadcast -vv

popd >/dev/null

RUN_FILE="$CONTRACTS_DIR/broadcast/deploy.s.sol/$CHAIN_ID/run-latest.json"
if [ ! -f "$RUN_FILE" ]; then
  echo "Deployment artifact not found at $RUN_FILE" >&2
  exit 1
fi

CONTRACT_ADDRESS="$(jq -r '.transactions[] | select(.contractAddress != null) | .contractAddress' "$RUN_FILE" | tail -n 1)"
if [ -z "$CONTRACT_ADDRESS" ] || [ "$CONTRACT_ADDRESS" = "null" ]; then
  echo "Failed to parse contract address from deployment artifact." >&2
  exit 1
fi

echo "✅ TicketSBT deployed to $CONTRACT_ADDRESS (chain $CHAIN_ID)"

if [ -f "$ABI_SOURCE" ]; then
  ABI_JSON="$(jq '.abi' "$ABI_SOURCE")"
  cat <<EOF_TS > "$ABI_TARGET"
export const ticketAbi = $ABI_JSON as const;
EOF_TS
  echo "✅ Updated ABI at $ABI_TARGET"
else
  echo "⚠️  ABI source not found at $ABI_SOURCE. Skipping ABI export." >&2
fi

SHOULD_UPDATE_ENV="${WEB_UPDATE_ENV:-true}"
if [ "$SHOULD_UPDATE_ENV" = "false" ]; then
  echo "ℹ️  Skipping .env update because WEB_UPDATE_ENV=false"
elif [ -f "$WEB_ENV_FILE" ]; then
  if grep -q '^CONTRACT_ADDRESS=' "$WEB_ENV_FILE"; then
    if sed -i.bak "s/^CONTRACT_ADDRESS=.*/CONTRACT_ADDRESS=$CONTRACT_ADDRESS/" "$WEB_ENV_FILE"; then
      rm -f "$WEB_ENV_FILE.bak"
      echo "✅ Updated CONTRACT_ADDRESS in $WEB_ENV_FILE"
    else
      echo "⚠️  Failed to update CONTRACT_ADDRESS in $WEB_ENV_FILE" >&2
    fi
  else
    printf '\nCONTRACT_ADDRESS=%s\n' "$CONTRACT_ADDRESS" >> "$WEB_ENV_FILE"
    echo "✅ Appended CONTRACT_ADDRESS to $WEB_ENV_FILE"
  fi
else
  cat <<EOF_ENV
⚠️  web/.env.local not found.
Add the following lines to your environment configuration manually:

CONTRACT_ADDRESS=$CONTRACT_ADDRESS
CHAIN_ID=$CHAIN_ID
RPC_URL=$RPC_URL
EOF_ENV
fi

cat <<EOF_SUMMARY

📋 Deployment summary
  RPC URL: $RPC_URL
  Chain ID: $CHAIN_ID
  Contract: $CONTRACT_ADDRESS
  Broadcast log: $RUN_FILE

Remember to fund the deployer account for gas costs when using Sepolia or mainnet.
EOF_SUMMARY
