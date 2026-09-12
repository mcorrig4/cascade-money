#!/usr/bin/env bash
set +x
set -euo pipefail
export PATH="$HOME/.foundry/bin:$PATH"
cd "$(dirname "$0")/.."
config=""
broadcast=false
live=false
for argument in "$@"; do
  case "$argument" in
    --live) live=true ;;
    --broadcast) broadcast=true ;;
    --help) echo 'Usage: scripts/deploy.sh [chains/testnet.json] [--broadcast] [--live]. Default: plain local MockUSDC chain.'; exit 0 ;;
    --*) echo "Unknown argument: $argument" >&2; exit 1 ;;
    *) [[ -z "$config" ]] || exit 1; config="$argument" ;;
  esac
done
if [[ "$live" == false ]]; then
  [[ "$broadcast" == true ]] || { echo 'Local mock target; start scripts/local-chain.sh or add --broadcast to set up an existing plain Anvil.'; exit 0; }
  node scripts/deploy-local.mjs
  exit 0
fi
config="${config:-chains/testnet.json}"
export CASCADE_ALLOW_LIVE=true
: "${ARC_DEPLOYER_KEY:?Set ARC_DEPLOYER_KEY in the environment}"
node scripts/config.mjs "$config"
export ARC_CHAIN_CONFIG
ARC_CHAIN_CONFIG="$(realpath "$config")"
chain_id="$(jq -er '.chainId' "$config")"
rpc="$(jq -er '.rpcUrl' "$config")"
actual="$(cast chain-id --rpc-url "$rpc")"
[[ "$actual" == "$chain_id" ]] || { echo "RPC chain mismatch: expected $chain_id, got $actual" >&2; exit 1; }
fee="$(cast gas-price --rpc-url "$rpc")"
fee="$(node -e 'const n=BigInt(process.argv[1])*2n; console.log((n<20000000000n?20000000000n:n).toString())' "$fee")"
args=()
if [[ "$broadcast" == true ]]; then args+=(--broadcast); fi
forge script script/Deploy.s.sol:Deploy --rpc-url "$rpc" --chain-id "$chain_id" \
  --with-gas-price "$fee" --slow "${args[@]}"
if [[ "$broadcast" == true ]]; then
  node scripts/deployment-manifest.mjs "$config"
fi
