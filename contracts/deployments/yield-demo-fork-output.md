# `node scripts/yield-demo.mjs` — local Arc fork run, 2026-09-12

Fork: `anvil --host 127.0.0.1 --port 8545 --fork-url https://rpc.testnet.arc.io --chain-id 5042002`
(forked Arc testnet at block 61716735). `CASCADE_FORK_RPC=http://127.0.0.1:8545`.

## Result: FAILED before any balance-sheet checkpoint was produced

No `SHEET` lines were printed — the run reverted on the first real-USDC transfer, before the
first `checkpoint()`/story step. No index values, entitlements, claim amounts, reserve or
deficit figures exist for this run.

## Why

This run is downstream of a blocked step: `scripts/fund-fork.mjs` could not verify an ERC-20
storage slot for Arc testnet's native-USDC proxy (`0x3600000000000000000000000000000000000000`)
in the documented 0–255 scan range — see the exact error below. Per README/VALIDATION.md this is
the expected Arc-compatibility boundary ("Arc's native-USDC implementation is not guaranteed to
expose one [conventional mapping]"; "standard Anvil does not reproduce Arc precompiles, native
transfer logs or blocklist enforcement").

To let deploy-local.mjs/demo.mjs proceed independent of that failure, the deployer and five demo
actor accounts were given only **native** balance directly via `anvil_setBalance` (the same call
`fund-fork.mjs` would have made). No ERC-20 storage deal was applied — that requires the verified
slot fund-fork.mjs could not find.

`yield-demo.mjs`'s own USDC-balance guard (`Run fork.sh to fund owner and Apple first`) did not
trip, because reading `balanceOf()` on this proxy returned a nonzero value consistent with the
account's native balance rather than a dedicated ERC-20 ledger — matching the README's "native and
ERC-20 USDC are one balance" description. The guard therefore treated the accounts as funded. The
script went on to deploy `MockUSYC` and `CascadeVaultUSYC`, then reverted on the very first real
`usdc.transfer(...)` call (funding the mock Teller's redemption liquidity), with an empty-data
`require(false)` revert — i.e. the underlying Arc-specific transfer path isn't reproduced by plain
Anvil, exactly the limitation flagged above.

This is a real environment/chain-compatibility limitation, not a script logic bug. No Solidity or
script code was edited to force past it.

## Captured output (fund-fork.mjs)

```
$ CASCADE_FORK_RPC=http://127.0.0.1:8545 node scripts/fund-fork.mjs

file:///home/claude/code/cascade/contracts/scripts/fund-fork.mjs:37
  if (balanceSlot === undefined) throw Error('No verified balance slot in 0..255; supply ARC_USDC_BALANCE_SLOT after inspecting the proxy implementation');
                                       ^

Error: No verified balance slot in 0..255; supply ARC_USDC_BALANCE_SLOT after inspecting the proxy implementation
    at file:///home/claude/code/cascade/contracts/scripts/fund-fork.mjs:37:40
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)

Node.js v24.13.1
```

## Captured output (yield-demo.mjs, after manual native-only funding)

```
$ CASCADE_FORK_RPC=http://127.0.0.1:8545 node scripts/yield-demo.mjs

MockUSYC (local only): 0x1ee0abE0C2F564641Aae9492eDF0f1378E895B13
CascadeVaultUSYC (local only): 0x7cFBC2F607b5f9d688E2e74782caBF83E49e8Da5
file:///home/claude/code/cascade/contracts/node_modules/ethers/lib.esm/utils/errors.js:132
            error = new Error(message);
                    ^

Error: execution reverted (no data present; likely require(false) occurred (action="estimateGas", data="0x", reason="require(false)", transaction={ "data": "0xa9059cbb0000000000000000000000001ee0abe0c2f564641aae9492edf0f1378e895b130000000000000000000000000000000000000000000000000000000005f5e100", "from": "0x4E07F6E2923Df9a4949418D1d45ef8E018A4726C", "to": "0x3600000000000000000000000000000000000000" }, invocation=null, revert=null, code=CALL_EXCEPTION, version=6.17.0)
    at makeError (file:///home/claude/code/cascade/contracts/node_modules/ethers/lib.esm/utils/errors.js:132:21)
    at getBuiltinCallException (file:///home/claude/code/cascade/contracts/node_modules/ethers/lib.esm/abi/abi-coder.js:102:12)
    at AbiCoder.getBuiltinCallException (file:///home/claude/code/cascade/contracts/node_modules/ethers/lib.esm/abi/abi-coder.js:203:16)
    at JsonRpcProvider.getRpcError (file:///home/claude/code/cascade/contracts/node_modules/ethers/lib.esm/providers/provider-jsonrpc.js:691:32)
    at file:///home/claude/code/cascade/contracts/node_modules/ethers/lib.esm/providers/provider-jsonrpc.js:298:45
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5) {
  code: 'CALL_EXCEPTION',
  action: 'estimateGas',
  data: '0x',
  reason: 'require(false)',
  transaction: {
    to: '0x3600000000000000000000000000000000000000',
    data: '0xa9059cbb0000000000000000000000001ee0abe0c2f564641aae9492edf0f1378e895b130000000000000000000000000000000000000000000000000000000005f5e100',
    from: '0x4E07F6E2923Df9a4949418D1d45ef8E018A4726C'
  },
  invocation: null,
  revert: null,
  shortMessage: 'execution reverted (no data present; likely require(false) occurred',
  info: {
    error: { code: 3, message: 'execution reverted', data: '0x' },
    payload: {
      method: 'eth_estimateGas',
      params: [
        {
          nonce: '0x3',
          from: '0x4e07f6e2923df9a4949418d1d45ef8e018a4726c',
          to: '0x3600000000000000000000000000000000000000',
          data: '0xa9059cbb0000000000000000000000001ee0abe0c2f564641aae9492edf0f1378e895b130000000000000000000000000000000000000000000000000000000005f5e100'
        }
      ],
      id: 38,
      jsonrpc: '2.0'
    }
  }
}
```

## Consequence for the fork proxy forge test

`ARC_FORK_URL=http://127.0.0.1:8545 forge test --match-test testForkProxyIssueMatureWithdraw -vv`
also fails downstream of the same blocked funding step: the test reads `.local/fork.json` (only
written on fund-fork.mjs success) for the debtor address, and that file was never created.

```
[FAIL: vm.readFile: failed to open file "/home/claude/code/cascade/contracts/.local/fork.json": No such file or directory (os error 2)] testForkProxyIssueMatureWithdraw() (gas: 4602)
```
