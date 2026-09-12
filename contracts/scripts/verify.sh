#!/usr/bin/env bash
set +x
set -euo pipefail
export PATH="$HOME/.foundry/bin:$PATH"
cd "$(dirname "$0")/.."
if [[ $# != 1 || "${1:-}" == --help ]]; then
  echo 'Usage: scripts/verify.sh deployments/<chain-id>.json'
  exit 0
fi
manifest="$1"
address="$(jq -er '.vault' "$manifest")"
token="$(jq -er '.usdc' "$manifest")"
owner="$(jq -er '.owner' "$manifest")"
chain_id="$(jq -er '.chainId' "$manifest")"
verifier="$(jq -er '.verifierUrl' "$manifest")"
constructor_args="$(cast abi-encode 'constructor(address,address)' "$token" "$owner")"
forge verify-contract "$address" src/CascadeVault.sol:CascadeVault \
  --chain-id "$chain_id" --verifier blockscout --verifier-url "$verifier" \
  --compiler-version 0.8.30 --num-of-optimizations 200 --evm-version prague \
  --constructor-args "$constructor_args" --watch
echo "Verified source: $(jq -er '.explorer' "$manifest")/address/$address#code"
