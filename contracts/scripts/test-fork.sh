#!/usr/bin/env bash
set -euo pipefail
export PATH="$HOME/.foundry/bin:$PATH"
cd "$(dirname "$0")/.."
export CASCADE_FORK_RPC="${CASCADE_FORK_RPC:-http://127.0.0.1:8545}"
node --input-type=module -e '
import {JsonRpcProvider} from "ethers";
import {assertFork} from "./scripts/local.mjs";
const p = new JsonRpcProvider(process.env.CASCADE_FORK_RPC);
try { await assertFork(p,process.env.CASCADE_FORK_RPC); } finally { p.destroy(); }
'
forge test --fork-url "$CASCADE_FORK_RPC" -vv "$@"
