#!/usr/bin/env bash
set +x
set -euo pipefail
export PATH="$HOME/.foundry/bin:$PATH"
cd "$(dirname "$0")/.."
# This repository has no port declaration; 8545 is the requested local fork endpoint.
fork_port=8545
if [[ -f ../.world/ports.yml ]]; then
  : "${CASCADE_FORK_PURPOSE:?Set the declared Anvil purpose for port-for}"
  fork_port="$(port-for "$CASCADE_FORK_PURPOSE")"
fi
export CASCADE_FORK_RPC="http://127.0.0.1:$fork_port"
mkdir -p .local
anvil --quiet --host 127.0.0.1 --port "$fork_port" --fork-url https://rpc.testnet.arc.io --chain-id 5042002 > .local/anvil.log 2>&1 &
fork_pid=$!
trap 'kill "$fork_pid" 2>/dev/null || true' EXIT INT TERM
ready=false
for ((attempt=0; attempt<60; attempt++)); do
  kill -0 "$fork_pid" 2>/dev/null || { cat .local/anvil.log >&2; exit 1; }
  if cast rpc --rpc-url "$CASCADE_FORK_RPC" anvil_nodeInfo >/dev/null 2>&1; then ready=true; break; fi
  sleep 0.5
done
[[ "$ready" == true ]] || { echo 'Anvil did not become ready; inspect .local/anvil.log' >&2; exit 1; }
kill -0 "$fork_pid" 2>/dev/null || { cat .local/anvil.log >&2; exit 1; }
node scripts/fund-fork.mjs
echo "Arc fork ready: $CASCADE_FORK_RPC (Ctrl-C stops it)"
wait "$fork_pid"
