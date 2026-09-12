# Cascade vault

Small USDC-backed ERC-1155 vault for the Arc demo. Read [DECISIONS.md](DECISIONS.md) for the accepted
spec interpretations, funded index, rounding, and limitations. No `sim/` dependency.

## Standard target: local Arc fork

All further contract execution targets an Anvil fork of Arc testnet, chain ID 5042002.
Builds are offline. Scripts never send live transactions unless `--live` is explicit.
The USDC-only vault remains the default.

```bash
export PATH="$HOME/.foundry/bin:$PATH"
cd contracts
npm ci
forge build --sizes

# Terminal 1: starts Anvil on 127.0.0.1:8545 and funds the local accounts.
scripts/fork.sh

# Terminal 2: contract tests, default vault and display-chain story, all on the fork.
scripts/test-fork.sh
scripts/deploy.sh --broadcast
node scripts/demo.mjs --broadcast

# Fresh local USYC variant, mock prices, five accelerated daily checkpoints.
node scripts/yield-demo.mjs
```

`fork.sh` uses `anvil --fork-url https://rpc.testnet.arc.io --chain-id 5042002`.
It sets native balances with `anvil_setBalance` and deals ERC-20 USDC by scanning mapping
slots 0–255 on the proxy. Each candidate is restored immediately and checked through
`balanceOf`; only a verified slot is used with `cast rpc anvil_setStorageAt`.
If the scan fails, it stops: inspect the implementation and supply `ARC_USDC_BALANCE_SLOT`
only if a conventional mapping actually exists. Arc's native-USDC implementation is not guaranteed
to expose one. [Circle's compatibility guide](https://www.arc.io/blog/arc-compatibility-guide-for-existing-evm-apps)
states that standard Anvil does not reproduce Arc precompiles, native transfer logs or blocklist
enforcement. The script never substitutes a mock proxy or claims native compatibility from a fork.
An Arc-aware execution engine may be required for the real-USDC smoke test and Teller transfers.
The manipulation is fork-only and does not model the token's global supply accounting.

The deployer and all five actors receive local funding. By default they are derived from public
local seeds; no literal private key is stored. `ARC_DEPLOYER_KEY` can select another locally
funded deployer, and `CASCADE_DEMO_SEED` selects actors. Use the same seed in both fork setup
and demo execution. `CASCADE_FORK_RPC` overrides the default endpoint; scripts verify loopback,
Anvil metadata and the chain ID. If a port declaration is added, `fork.sh` uses `port-for`
with `CASCADE_FORK_PURPOSE`.

Local deployment details live in ignored `.local/`, separate from `deployments/`.
The yield demo always deploys a fresh local MockUSYC and variant and refuses `--live`.
It runs Apple → Samsung Display (folding OLED panels) → Corning (ultra-thin cover glass)
→ silica supplier → freight carrier. Silica extends the date before paying freight.
It advances day+1 through day+5, raises the mock price, claims Apple's original interval at
day+3 and silica's added interval at day+5, then withdraws freight's principal as shares and
sells them through the mock Teller. Every checkpoint and story step prints a balance sheet.
These prices and accelerated dates demonstrate accounting, not real USYC income.

## Live deployment: explicit opt-in

`ARC_DEPLOYER_KEY` is read only from the environment. Never write it into repository files.

```bash
# Explicit live RPC simulation, without sending transactions:
scripts/deploy.sh chains/testnet.json --live

# Only when separately authorized and funded:
scripts/deploy.sh chains/testnet.json --live --broadcast
scripts/verify.sh deployments/5042002.json
node scripts/demo.mjs --live --broadcast --seed <testnet-seed>
```

Mainnet uses a completed copy of `chains/mainnet.example.json`; placeholders fail validation.
`demo.mjs` actors are testnet-only. Without `--broadcast`, it prints an offline plan.
Without `--live`, its RPC defaults to http://127.0.0.1:8545, regardless of the chain config's
live URL. Live preflight verifies chain, token code/decimals, ownership, backing and funding.
A stale vault is refused unless `--zero-income-catch-up` explicitly permits zero-income days.

The display-chain story uses 10 USDC by default (`--amount 100` is optional), day+90 units
and silica's extension to day+120. The deployer funds actor gas and Apple's principal on live
testnet. TSMC is not part of this display chain.

Resume with the same seed, vault, amount and gas budget. Preserve ignored `.demo-runs/`:
signed transactions are journaled before submission, and retries recover receipts or rebroadcast
identical bytes. A mined failure stops for operator review; it is never silently replaced.
Fork and live journals are separated. Use a new run/seed after changing the story or restarting
with materially different contract code. Demo state never writes to `deployments/`.

## Wallet display and local USYC backing

`uri(id)` returns base64 JSON containing a dynamic `USD+N` / `USD spot` name, ISO UTC maturity
date and base64 SVG coin. `DateMetadata` renders this outside the vault's runtime bytecode.
Wallets may cache metadata; the label is computed when they call `uri`.

The first mint of each touched date creates a deterministic CREATE2 clone of
`DatedDollarERC20`. `viewFor(date)` returns it. It exposes six decimals, a fixed creation-time
symbol (`USD+0` when first minted as spot) and calendar-date name, with balances and total supply read directly from ERC-1155.
ERC-20 allowances apply only to that date. Transfers use the same ledger and ERC-1155 receiver
checks; ERC-20 Transfer events also mirror direct ERC-1155 mint, burn and transfer operations.
This is a view, not a second supply or a wrapper deposit.

`MockUSYC` is a six-decimal mock with owner-only price and test minting. `buy` exchanges USDC
for floor-rounded shares; `sell` burns shares for floor-rounded USDC. Price scale is 1e18.
Price increases do not create cash: the demo separately funds the Teller's redemption balance.

`CascadeVaultUSYC` is local-only. Invoice amounts remain six-decimal dollars. Issue pulls
ceil-rounded USYC shares at the current mock price; withdrawal returns floor-rounded shares.
Positive income excludes capital flows and is allocated through a price-derived `checkpoint()`.
The owner-delta overload is disabled. Losses leave the index unchanged and consume reserve;
deficit and insufficient Teller liquidity suspend claims/withdrawals while other operations continue.
Recovery fills the deficit and configured dollar reserve floor before index growth resumes.
The demo chooses a zero reserve floor; tests also cover a nonzero floor. Publish each consecutive
day: one current price cannot reconstruct skipped historical checkpoints.

Solidity remains 0.8.30 / Prague / optimizer 200; OpenZeppelin 5.0.2 and forge-std 1.16.2 are
vendored. No `sim/` build dependency. Render the architecture SVG with `npm run render`.

## Index and API notes

Amounts use six decimals. Index scale is `1e18`; 1 USDC is `1_000_000` units. The owner approves
the USDC token to the vault before positive checkpoints. Calling `checkpoint(delta)` funds and publishes
the next elapsed day, not an arbitrary chosen date. Catch up with zero checkpoints if no demo yield was
assigned. Issuance and extension require the index caught up to today. Existing matured balances can
still withdraw without a checkpoint; entitlement claims require I(E) to have been published.

`pay(bytes32,uint256,uint256[],uint256)` takes expected outstanding last. Supply up to 32 unique IDs in your preferred spending order. Only future IDs must be at most M. The contract
consumes balances in that order; all supplied dates are checked, even unused trailing buckets.

`datesOf(account, offset, limit)` returns heap-order pages, up to 32 IDs. Sort client-side when displaying.
`earliestDate` returns the maximum uint256 for an empty account. `withdraw(amount)` and spot recommit
consume up to 32 matured IDs atomically. Split larger bucket counts across transactions.
`withdraw(amount, dates)` and `extendSpot(amount, toDate, dates)` select up to 32 unique mature
IDs directly, bypassing unwanted dust. `extendSpot(amount, toDate)` uses the convenience heap path.
The legacy `extend(amount, fromDate, toDate)` consumes aggregate spot only when fromDate equals
the execution day's ID; all other source dates select that exact ID. Prefer explicit spot extension
when preparing a transaction near midnight.

`balanceSheet()` exposes nominal backing, combined principal/spot, rounded-up accrued yield, reserve,
and observed deficit. `accruedValue(id)` returns rounded-down entitlement value and claimability.
Date-level supply and events support a front-end balance sheet without contract-wide holder enumeration.

The deployment-guard tests use mock tokens even when their EVM runs on the fork. They do not
replace a final real-token fork smoke run. See VALIDATION.md for executed checks and remaining limits.
