#!/usr/bin/env bash
set -euo pipefail
export PATH="$HOME/.foundry/bin:$PATH"
cd "$(dirname "$0")/.."
# No ports declaration currently exists; retain the established Anvil endpoint.
local_port="${CASCADE_LOCAL_PORT:-8545}"
if [[ -f ../.world/ports.yml ]]; then
  : "${CASCADE_LOCAL_PURPOSE:?Set the declared Anvil purpose for port-for}"
  local_port="$(port-for "$CASCADE_LOCAL_PURPOSE")"
fi
export CASCADE_LOCAL_RPC="http://127.0.0.1:$local_port"
for argument in "$@"; do
  case "$argument" in
    --rpc|--rpc=*) echo 'Use CASCADE_LOCAL_PORT to select the launcher port; --rpc belongs to deploy-local.mjs.' >&2; exit 1 ;;
  esac
done
# Parse and validate all setup arguments before starting a process or binding a socket.
node scripts/deploy-local.mjs --dry-run "$@" >/dev/null
for argument in "$@"; do
  if [[ "$argument" == --dry-run ]]; then
    echo 'Dry run complete: .local/local.dry-run.json (no process, socket, or transaction).'
    exit 0
  fi
done
forge build
mkdir -p .local
anvil --quiet --host 127.0.0.1 --port "$local_port" --chain-id 31337 > .local/anvil-local.log 2>&1 &
local_pid=$!
trap 'kill "$local_pid" 2>/dev/null || true' EXIT INT TERM
ready=false
for ((attempt=0; attempt<60; attempt++)); do
  kill -0 "$local_pid" 2>/dev/null || { cat .local/anvil-local.log >&2; exit 1; }
  if cast rpc --rpc-url "$CASCADE_LOCAL_RPC" anvil_nodeInfo >/dev/null 2>&1; then ready=true; break; fi
  sleep 0.5
done
[[ "$ready" == true ]] || { echo 'Anvil did not become ready' >&2; exit 1; }
kill -0 "$local_pid" 2>/dev/null || exit 1
node scripts/deploy-local.mjs "$@"
echo "Mock USDC chain ready: $CASCADE_LOCAL_RPC (Ctrl-C stops it)"
wait "$local_pid"
