# Cascade vault

Small USDC-backed ERC-1155 vault for the Arc demo. Read [DECISIONS.md](DECISIONS.md) for the accepted
spec interpretations, funded index, rounding, and limitations. No `sim/` dependency.

## Standard target: plain local Anvil + mock USDC

The default chain is **31337**, with a standard six-decimal `MockUSDC` ERC-20 and open test
minting. The vault needs the ERC-20 interface, not Arc's native gas-token implementation.
The USDC-only vault remains the default deployment. Local gas is ETH; token balances are
separate mock USDC. Scripts never send live transactions unless `--live` is explicit.

```bash
export PATH="$HOME/.foundry/bin:$PATH"
cd contracts
npm ci

# Terminal 1: build, start plain Anvil, deploy MockUSDC, fund all accounts and deploy vault.
scripts/local-chain.sh

# Terminal 2: standard tests and the display-chain story.
forge test
node scripts/demo.mjs --broadcast

# Fresh USYC variant with five accelerated daily checkpoints on the same local chain.
node scripts/yield-demo.mjs
```

The launcher binds loopback on the established port 8545 (override `CASCADE_LOCAL_PORT`).
If a port declaration is added, it resolves `CASCADE_LOCAL_PURPOSE` through `port-for`.
It sets 1,000 native ETH per account using `anvil_setBalance`, then deploys MockUSDC and mints
1,000,000 mock USDC to the deployer and each of the five actors. `--funding` changes the token
amount. No storage slot scans or Arc RPC are involved. Stop with Ctrl-C.

The deployer uses a public deterministic local seed and ignores `ARC_DEPLOYER_KEY`.
`--seed` or `CASCADE_DEMO_SEED` selects the actors; demos inherit the seed from the manifest.
Use a public test seed only. `.local/local.json` contains the RPC, chain ID, instance ID,
deployer, actor addresses, USDC and vault. It contains no private keys and is ignored by Git.
Demos read this manifest by default; `--rpc` or `CASCADE_LOCAL_RPC` can override its RPC,
but execution still checks loopback, plain Anvil and chain 31337. To bootstrap an already
running plain chain, use `node scripts/deploy-local.mjs --rpc http://127.0.0.1:8545`.
Setup creates fresh contracts each time; it is not a resumption of an old vault. A fresh instance
ID isolates the payment journal from prior chain runs, even if contract addresses repeat.

The payment demo reuses the setup funding locally. Its transaction journal makes story retries
resumable. Run it before the yield demo: the yield demo advances the entire chain five days,
so other vaults become stale. A subsequent new payment run must use a fresh setup or explicitly
accept `--zero-income-catch-up`. The yield demo creates a fresh USYC variant on every invocation;
it overwrites its NDJSON output and does not resume an interrupted yield story.

### Offline script validation

These commands parse arguments and write separate, clearly marked dry-run manifests and a
schema preview, without RPC calls, Anvil, or transactions. They never replace `local.json` or
real yield output. Run setup's dry run first so the demos can read its manifest.

```bash
scripts/local-chain.sh --dry-run
node scripts/demo.mjs --dry-run
node scripts/yield-demo.mjs --dry-run
scripts/fork.sh --dry-run
node scripts/demo.mjs --fork --dry-run
node scripts/yield-demo.mjs --fork --dry-run
npm run test:scripts
```

### Optional informational Arc fork

```bash
scripts/fork.sh
# Read-only/offline inspection of the fork configuration:
node scripts/demo.mjs --fork
```

`fork.sh` still starts `anvil --fork-url https://rpc.testnet.arc.io --chain-id 5042002` and
writes `.local/fork.json`, but **does not attempt USDC funding or storage manipulation**.
The external host run confirmed that Arc's custom native-USDC proxy has no conventional
balance mapping in slots 0–255 and its transfer path reverts on plain Anvil. The fork is
informational, not a required test target or evidence of working native-USDC transfers.
`--fork` retains the Arc configuration in both demos and prints the limitation. Executing a
story there requires a compatible execution engine and independently funded accounts; plain
Anvil will fail preflight or transfers. The optional real-proxy Foundry test runs only when
`ARC_FORK_URL` is explicitly set and requires an independently prepared account.
`CASCADE_FORK_RPC` overrides the informational fork endpoint.

### Shot 9: machine-readable yield balance sheets

The local story is Apple → Samsung Display (folding OLED panels) → Corning (ultra-thin cover
glass) → silica supplier → freight carrier. Silica extends before paying freight. The yield
demo raises prices at day+1 through day+5, claims Apple's original interval at day+3 and
silica's added interval at day+5, then withdraws freight's principal as shares and sells them
through the mock Teller. These prices demonstrate accounting, not real USYC income.

Every checkpoint and principal/claim step prints a JSON snapshot and appends the same object
to **`.local/yield-demo.ndjson`**. Transaction annotations remain on stdout; the NDJSON file
contains only JSON. Each record includes `day` (UTC epoch day), `iso_date`, `checkpoint_day`,
`index`, `active_entitlements`, `unclaimed_entitlements`, and a nested `balance_sheet`:

- `backing_asset_units`, `backing_value_cents`, `principal_cents`, `dated_cents`, `spot_cents`
- `unclaimed_accrued_cents`, `claimable_cents`, `reserve_cents`, `deficit_cents`

These names match Python core's `balance_sheet`. Fractional accounting fields and `index` use
reduced `numerator/denominator` strings, as Python does. Backing asset units are whole USYC
shares, not microshares. The numeric principal/backing/dated/spot fields are in cents and can
have four decimal places because Solidity amounts have six dollar decimals. Accrued and
claimable yield retain exact scaled fractions; `claimable_cents` is the matured, unclaimed
subset, not additional liability. Active records cover today's inclusive earning interval;
`unclaimed_entitlements` also includes future intervals and matured records awaiting claim.
Reserve/deficit reflect the contract's conservative rounded-up accrued liability, so micro-USDC
rounding can differ from the exact Python identity. This output is a local shot-9 data source,
not a complete Python event stream. Dry-run previews use `.local/yield-demo.dry-run.ndjson`
and are explicitly marked as synthetic, with no chain results.

## Live deployment: explicit opt-in

The existing live testnet deployment stands. This local-workflow change does not redeploy it
or modify `deployments/`.

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
Local, fork and live journals are separated. Use a new run/seed after changing the story or restarting
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

The standard suite runs without a fork and uses mock tokens. It does not establish Arc native-USDC compatibility. See VALIDATION.md for executed checks and remaining limits.
