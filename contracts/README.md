# Cascade vault

Small USDC-backed ERC-1155 vault for the Arc demo. Read [DECISIONS.md](DECISIONS.md) for the accepted
spec interpretations, funded index, rounding, and limitations. No `sim/` dependency.

## Local validation

```bash
export PATH="$HOME/.foundry/bin:$PATH"
cd contracts
forge build --sizes
forge test -vv
forge test --gas-report
npm install
npm run test:scripts
npm run render
```

Solidity is pinned to 0.8.30 / Prague / optimizer 200. OpenZeppelin 5.0.2 and forge-std 1.16.2 are
vendored; no Solidity dependency download is required. Foundry needs the pinned compiler installed
or downloadable. JavaScript tools use exact direct dependency versions in `package.json`.
Rendering uses installed Chrome (`CHROME_BIN` overrides `/usr/bin/google-chrome`), through a pipe,
without a web server, browser download, or network fetch. `docs/architecture.md` is the source.

## Deployment (explicit separate step)

Provide `ARC_DEPLOYER_KEY` in the process environment using your secret manager or a shell prompt;
do not put a literal key into a command, repository file, or shell history. Deployer is checkpoint owner.

```bash
# Read-only RPC checks and simulation; no transaction is broadcast:
scripts/deploy.sh chains/testnet.json

# Actual deployment, only after funding:
scripts/deploy.sh chains/testnet.json --broadcast
scripts/verify.sh deployments/5042002.json
```

The deployment preflight validates chain ID, token bytecode, and six decimals. Build/tests never probe
the RPC. The script estimates fees with a floor of 20 Gwei and uses USDC as gas. The manifest stores
public deployment details and an artifact hash. Verification must use the same source and compiler
settings as deployment. Mainnet uses a completed copy of `chains/mainnet.example.json`; placeholder
values deliberately fail validation. Confirm mainnet addresses independently before filling it.

## Testnet story

```bash
# Offline plan: prints generated testnet accounts; no RPC calls:
node scripts/demo.mjs --amount 10

# Actual story, explicitly separate from build/test:
node scripts/demo.mjs --amount 10 --seed <testnet-seed> --broadcast
# Optional: --amount 100, --seed <testnet-seed>, --vault <deployed-address>
```

`CASCADE_DEMO_SEED` also supplies the actor seed; broadcast requires a stable seed. Actor keys are
printed for testnet only; the deployer key is never printed. All preflight checks precede actor funding.
A stale vault is refused unless `--zero-income-catch-up` explicitly authorizes permanent zero-income
checkpoints for the missed days.

Resume with the same seed, vault, amount and gas budget. Immutable journals under ignored
`.demo-runs/` (or `--state-dir`) save signed transactions before submission. Retries recover receipts
or rebroadcast the exact same transaction, never fresh funding or issuance. Keep this directory:
deleting it removes the retry protection. Failed mined transactions stop for operator review;
the script never silently replaces them. The original maturity dates remain fixed across resumptions.
No private keys or seeds are written, and demo state never writes to `deployments/`.

The deployer sends 0.1 native USDC to each of five accounts by default (`--gas-per-account` override),
then sends the principal through the ERC-20 interface to Apple. At 10 USDC principal the preflight
requires 10.7 USDC for principal, actor gas, and deployer headroom. This is a minimum budget, not a
guaranteed fee quote. Native and ERC-20 USDC are **one balance** at different precisions (18 vs 6).

Foxconn, TSMC, Corning, and the glass supplier register their invoices. Apple issues day+90 units;
Foxconn and TSMC pay onward. Corning extends to day+120 and pays the glass supplier, whose signed
M is day+120. Four invoices settle with one principal deposit. Every transaction prints an explorer
link; its hash and signed transaction are journaled and receipts are recovered from RPC. The script validates final invoice balances, holder balance, and backing.
It will not run generated actors on mainnet or accelerate the chain clock.

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

The Solidity test named `ArcIntegrationTest` tests deployment guards **offline** with mock USDC.
It is not evidence of live native-USDC execution. Live token behavior, deployment, and Blockscout
verification must be checked after funding in the explicitly separate deployment turn.

Render the browser-free SVG with `npm run render`; rasterize `docs/architecture.svg` externally.
The SVG is a hand-laid counterpart of the Mermaid source. Install demo dependencies with `npm ci`.
