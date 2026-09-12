#!/usr/bin/env bash
set +x
set -euo pipefail
export PATH="$HOME/.foundry/bin:$PATH"
cd "$(dirname "$0")/.."
if [[ $# -lt 1 || $# -gt 2 || "${1:-}" == --help ]]; then
  echo 'Usage: scripts/deploy.sh chains/testnet.json [--broadcast] (default: RPC simulation only)'
  exit 0
fi
config="$1"
if [[ $# == 2 && "$2" != --broadcast ]]; then echo 'Only --broadcast is accepted as the second argument' >&2; exit 1; fi
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
if [[ "${2:-}" == --broadcast ]]; then args+=(--broadcast); fi
forge script script/Deploy.s.sol:Deploy --rpc-url "$rpc" --chain-id "$chain_id" \
  --with-gas-price "$fee" --slow "${args[@]}"
if [[ "${2:-}" == --broadcast ]]; then
  node scripts/deployment-manifest.mjs "$config"
fi
